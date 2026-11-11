// Creates an order from the cart and starts a HitPay payment request. Returns the HitPay checkout URL.
// Prices are recalculated here from the part ids, so the browser cannot change what it pays.
//
// Secrets (set with `supabase secrets set`):
//   HITPAY_API_KEY   sandbox API key from the HitPay dashboard
//   HITPAY_BASE      https://api.sandbox.hit-pay.com (use https://api.hit-pay.com in production)
//   ALLOWED_ORIGINS  comma-separated sites the customer may be sent back to, e.g. https://yoursite.example
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { priceIds, CATS } from '../_shared/catalog.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const LAYOUTS = ['60', '75', '100']
// The price field for each category. Every other category is priced with `p`.
const PRICE_FIELD: Record<string, string> = { switches: 'ps', stabs: 'pp' }

// A mistake in the customer's cart, answered with 400. Anything else is a server or database fault, answered with 503.
class CustomerError extends Error {}

// Prices and weights must be finite, non-negative numbers before anything is charged.
const isAmount = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  try {
    const { items, customer, voucher, origin, expectedSubtotal } = await req.json()

    // Basic input checks.
    if (!Array.isArray(items) || items.length === 0 || items.length > 10) return json({ error: 'Your cart is empty or too large.' }, 400)
    if (!customer?.name || !EMAIL.test(customer?.email ?? '')) return json({ error: 'Please enter your name and a valid email.' }, 400)
    const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (!allowed.includes(origin)) return json({ error: 'This site is not allowed to take payments.' }, 403)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Prices come from the Supabase parts table, the same table the app loads.
    // If the table cannot be read, checkout stops rather than charging from a stale copy.
    const { data: partRows, error: partsErr } = await admin.from('parts').select('category_key,data')
    if (partsErr) throw partsErr
    const catalogue: Record<string, unknown[]> = {}
    for (const r of partRows ?? []) {
      const field = PRICE_FIELD[r.category_key] ?? 'p'
      if (!isAmount(r.data?.[field]) || (r.data.g !== undefined && !isAmount(r.data.g))) {
        throw new Error(`Catalogue price is invalid: ${r.category_key}/${r.data?.id}`)
      }
      (catalogue[r.category_key] ??= []).push(r.data)
    }
    for (const c of CATS) if (!catalogue[c]?.length) throw new Error(`Catalogue is missing ${c}`)

    // Price every item on the server. priceIds throws if a part id is unknown.
    let subtotal = 0
    const lines = items.map((it) => {
      if (!LAYOUTS.includes(it.layout)) throw new CustomerError('Unknown layout.')
      let line: number
      try {
        line = priceIds(it.layout, it.part_ids, catalogue).total
      } catch {
        throw new CustomerError('Some parts in your cart are no longer available.')
      }
      subtotal += line
      return { name: String(it.name ?? 'Custom keyboard').slice(0, 120), layout: it.layout, part_ids: it.part_ids, price: line }
    })

    // The browser sends the subtotal the customer was shown. If the prices have changed, stop and ask them to confirm.
    if (expectedSubtotal != null) {
      const shown = Number(expectedSubtotal)
      if (!Number.isFinite(shown) || Math.abs(shown - subtotal) > 0.005) {
        return json({ error: 'Prices have changed since you added these parts. Review the new subtotal before paying.', priceChanged: true, subtotal }, 409)
      }
    }

    // Optional voucher: must exist, be unused and not expired.
    let discount = 0
    let voucherCode: string | null = null
    if (voucher) {
      const code = String(voucher).trim().toUpperCase()
      const { data: v, error: voucherErr } = await admin.from('vouchers').select('*').eq('code', code).is('used_at', null).maybeSingle()
      if (voucherErr) throw voucherErr
      if (!v || new Date(v.expires_at) < new Date()) return json({ error: 'That voucher is not valid any more.' }, 400)
      discount = v.type === 'pct' ? Math.round((subtotal * v.value) / 100) : Math.min(v.value, subtotal)
      voucherCode = v.code
    }
    const total = subtotal - discount

    // Signed-in customers get their order linked to their account.
    let userId: string | null = null
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (token) {
      const { data } = await admin.auth.getUser(token)
      userId = data?.user?.id ?? null
    }

    const { data: order, error: insErr } = await admin
      .from('orders')
      .insert({ user_id: userId, email: customer.email, name: customer.name, items: lines, subtotal, discount, total, voucher_code: voucherCode })
      .select('id')
      .single()
    if (insErr) throw insErr

    // Start the HitPay payment request (form-encoded, as HitPay expects).
    const hitpayBase = Deno.env.get('HITPAY_BASE') ?? 'https://api.sandbox.hit-pay.com'
    const form = new URLSearchParams({
      amount: total.toFixed(2),
      currency: 'SGD',
      email: customer.email,
      name: customer.name,
      reference_number: order.id,
      redirect_url: `${origin}/order/${order.id}`,
      purpose: 'Le Chaton Typers custom keyboard',
    })
    const res = await fetch(`${hitpayBase}/v1/payment-requests`, {
      method: 'POST',
      headers: {
        'X-BUSINESS-API-KEY': Deno.env.get('HITPAY_API_KEY')!,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    })
    const pr = await res.json().catch(() => ({}))
    if (!res.ok || !pr.url) {
      await admin.from('orders').update({ status: 'failed' }).eq('id', order.id)
      return json({ error: 'The payment could not be started. Please try again.' }, 502)
    }

    await admin.from('orders').update({ hitpay_request_id: pr.id }).eq('id', order.id)
    return json({ orderId: order.id, url: pr.url, subtotal, discount, total })
  } catch (e) {
    console.error(e)
    if (e instanceof CustomerError) return json({ error: e.message }, 400)
    return json({ error: 'Something went wrong. Please try again.' }, 503)
  }
})
