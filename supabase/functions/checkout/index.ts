// Creates an order from the cart and starts a HitPay payment request. Returns the HitPay checkout URL.
// Prices are recalculated here from the part ids, so the browser cannot change what it pays.
//
// Secrets (set with `supabase secrets set`):
//   HITPAY_API_KEY   sandbox API key from the HitPay dashboard
//   HITPAY_BASE      https://api.sandbox.hit-pay.com (use https://api.hit-pay.com in production)
//   ALLOWED_ORIGINS  comma-separated sites the customer may be sent back to, e.g. https://yoursite.example
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { priceIds } from '../_shared/catalog.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const LAYOUTS = ['60', '75', '100']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  try {
    const { items, customer, voucher, origin } = await req.json()

    // Basic input checks.
    if (!Array.isArray(items) || items.length === 0 || items.length > 10) return json({ error: 'Your cart is empty or too large.' }, 400)
    if (!customer?.name || !EMAIL.test(customer?.email ?? '')) return json({ error: 'Please enter your name and a valid email.' }, 400)
    const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (!allowed.includes(origin)) return json({ error: 'This site is not allowed to take payments.' }, 403)

    // Price every item on the server. priceIds throws if a part id is unknown.
    let subtotal = 0
    const lines = items.map((it) => {
      if (!LAYOUTS.includes(it.layout)) throw new Error('Unknown layout.')
      const { total } = priceIds(it.layout, it.part_ids)
      subtotal += total
      return { name: String(it.name ?? 'Custom keyboard').slice(0, 120), layout: it.layout, part_ids: it.part_ids, price: total }
    })

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Optional voucher: must exist, be unused and not expired.
    let discount = 0
    let voucherCode: string | null = null
    if (voucher) {
      const code = String(voucher).trim().toUpperCase()
      const { data: v } = await admin.from('vouchers').select('*').eq('code', code).is('used_at', null).maybeSingle()
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
    const base = Deno.env.get('HITPAY_BASE') ?? 'https://api.sandbox.hit-pay.com'
    const form = new URLSearchParams({
      amount: total.toFixed(2),
      currency: 'SGD',
      email: customer.email,
      name: customer.name,
      reference_number: order.id,
      redirect_url: `${origin}/#/order/${order.id}`,
      purpose: 'Le Chaton Typers custom keyboard',
    })
    const res = await fetch(`${base}/v1/payment-requests`, {
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
    const msg = e instanceof Error && /Unknown|layout/.test(e.message) ? 'Some parts in your cart are no longer available.' : 'Something went wrong. Please try again.'
    return json({ error: msg }, 400)
  }
})
