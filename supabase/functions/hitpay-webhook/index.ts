// Receives HitPay payment updates and marks the matching order paid.
// Register this function's URL in the HitPay dashboard under Developers > Webhook Endpoints.
//
// Secrets:
//   HITPAY_SALT   the salt shown in the HitPay dashboard for the same environment (sandbox or live)
//
// Every request is checked against the Hitpay-Signature header (HMAC-SHA256 of the raw body, keyed
// with the salt). Requests that fail the check are rejected.

import { createClient } from 'npm:@supabase/supabase-js@2'

const enc = new TextEncoder()

function sameText(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function sign(raw: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(raw))
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Use POST', { status: 405 })

  const raw = await req.text()
  const salt = Deno.env.get('HITPAY_SALT') ?? ''
  const expected = await sign(raw, salt)
  if (!salt || !sameText(expected, req.headers.get('Hitpay-Signature') ?? '')) {
    return new Response('Bad signature', { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response('Bad body', { status: 400 })
  }

  // Only a completed payment marks the order as paid.
  if (payload.status !== 'completed' || typeof payload.reference_number !== 'string') {
    return new Response('ignored', { status: 200 })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Only move pending orders to paid, so a repeated webhook does nothing.
  const { data: order } = await admin
    .from('orders')
    .update({ status: 'paid' })
    .eq('id', payload.reference_number)
    .eq('status', 'pending')
    .select('voucher_code')
    .maybeSingle()

  // The voucher is used up only once payment has gone through.
  if (order?.voucher_code) {
    await admin.from('vouchers').update({ used_at: new Date().toISOString() }).eq('code', order.voucher_code)
  }

  return new Response('ok', { status: 200 })
})
