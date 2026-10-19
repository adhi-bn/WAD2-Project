// Returns the status of one order for the confirmation page. The order id is a random UUID that
// only the customer receives, and only the fields below are returned.

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!UUID.test(id)) return json({ error: 'Unknown order.' }, 404)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await admin
    .from('orders')
    .select('status, name, items, subtotal, discount, total, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return json({ error: 'Unknown order.' }, 404)

  return json({
    status: data.status,
    name: data.name,
    items: (data.items as { name: string; price: number }[]).map((i) => ({ name: i.name, price: i.price })),
    subtotal: data.subtotal,
    discount: data.discount,
    total: data.total,
    created_at: data.created_at,
  })
})
