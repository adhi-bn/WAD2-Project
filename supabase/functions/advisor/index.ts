// Biscuit's advisor: takes a text question and/or a keyboard photo, asks Gemini, and returns a build
// made ONLY from parts in our catalogue. Every part id Gemini returns is checked against the catalogue
// before it reaches the visitor, so the advisor cannot suggest something we don't sell.
//
// Secrets (set with `supabase secrets set --env-file ./supabase/.env`):
//   GEMINI_API_KEY   key from Google AI Studio (server only)
//   GEMINI_MODEL     optional, defaults to gemini-3.8-flash
//   ALLOWED_ORIGINS  same list as the checkout function
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { CATS, catalog, priceIds } from '../_shared/catalog.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const LAYOUTS = ['60', '75', '100']
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
const MAX_MESSAGE = 500
const MAX_IMAGE_B64 = 4 * 1024 * 1024 * 1.4 // about 4 MB of image data once base64 encoded
const PER_HOUR = 10 // questions per visitor (by IP) per hour

// Summarise the catalogue for the prompt: one line per option, with the details that matter for choosing.
function catalogueText(layout: string) {
  const options = catalog(layout)
  return CATS.map((c) => {
    const lines = options[c].map((o: any) => {
      const detail = { ...o }
      for (const k of ['id', 'name', 'price', 'grams', 'p', 'g', 'ps', 'pp']) delete detail[k]
      return `  ${o.id} | ${o.name} | S$${o.price} | ${JSON.stringify(detail)}`
    })
    return `${c}:\n${lines.join('\n')}`
  }).join('\n')
}

// Gemini's reply shape is not fixed in every API version, so find the first JSON object with a "reply" key.
function findReply(node: any): any {
  if (typeof node === 'string') {
    try {
      const parsed = JSON.parse(node)
      if (parsed && typeof parsed === 'object' && 'reply' in parsed) return parsed
    } catch { /* not JSON */ }
    return null
  }
  if (Array.isArray(node)) {
    for (const n of node) { const f = findReply(n); if (f) return f }
  } else if (node && typeof node === 'object') {
    for (const v of Object.values(node)) { const f = findReply(v); if (f) return f }
  }
  return null
}

const SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    layout: { type: 'string', enum: LAYOUTS },
    build: {
      type: ['object', 'null'],
      properties: Object.fromEntries(CATS.map((c) => [c, { type: 'string' }])),
      required: CATS,
    },
    change: {
      type: ['object', 'null'],
      properties: { category: { type: 'string', enum: CATS }, id: { type: 'string' } },
      required: ['category', 'id'],
    },
  },
  required: ['reply', 'layout', 'build', 'change'],
}

function buildPrompt(layout: string, userText: string, hasImage: boolean) {
  return `You are Biscuit, the friendly fat cat who helps people choose a custom mechanical keyboard at Le Chaton Typers.

Rules:
- Recommend ONLY part ids that appear in the catalogue below. Never invent a part.
- Choose one id per category for a full build, or set "build" to null if you are only suggesting one change.
- If the customer names a layout (60%, 75% or 100%) use it. Otherwise use "${layout}".
- If the customer gives a budget, keep the total under it.
- ${hasImage ? 'The customer sent a photo. Describe the keyboard you see (layout, case, keycaps, switch feel if visible) and pick the closest matching parts from the catalogue. Say clearly that this is an estimate from a photo.' : 'Base the build on what the customer asks for.'}
- "reply" is for the customer: friendly, plain English, under 80 words. Mention the total in S$.
- If the request has nothing to do with keyboards, say so kindly in "reply", and set both "build" and "change" to null.

Catalogue (id | name | price for ${layout}% | details):
${catalogueText(layout)}

Customer request: ${userText || '(sent a photo only)'}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  try {
    const { message, image, origin, layout: askedLayout } = await req.json()

    const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (!allowed.includes(origin)) return json({ error: 'Biscuit is not available on this site.' }, 403)

    const text = String(message ?? '').trim().slice(0, MAX_MESSAGE)
    if (!text && !image) return json({ error: 'Tell me what you are looking for, or send a photo.' }, 400)
    if (image) {
      if (!IMAGE_TYPES.includes(image.mime_type)) return json({ error: 'Please send a JPG, PNG or WEBP photo.' }, 400)
      if (typeof image.data !== 'string' || image.data.length > MAX_IMAGE_B64) return json({ error: 'That photo is too big. Try one under 4 MB.' }, 400)
    }
    const layout = LAYOUTS.includes(askedLayout) ? askedLayout : '75'

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Simple per-visitor limit, so one person can't run up the Gemini bill.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await admin.from('ai_requests').select('*', { count: 'exact', head: true }).eq('ip', ip).gte('created_at', since)
    if ((count ?? 0) >= PER_HOUR) return json({ error: 'Biscuit needs a short nap. Try again in a little while.' }, 429)
    await admin.from('ai_requests').insert({ ip })

    // Ask Gemini. Text goes first, then the image, as the docs recommend.
    const input: unknown[] = [{ type: 'text', text: buildPrompt(layout, text, !!image) }]
    if (image) input.push({ type: 'image', data: image.data, mime_type: image.mime_type })

    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash'
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input,
        response_format: { type: 'text', mime_type: 'application/json', schema: SCHEMA },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('Gemini error', res.status, JSON.stringify(data).slice(0, 500))
      return json({ error: 'Biscuit is having a moment. Please try again.' }, 502)
    }

    const ai = findReply(data)
    if (!ai) return json({ error: 'Biscuit could not make sense of that. Try asking another way.' }, 502)

    // Check everything Gemini suggested against the catalogue.
    const options = catalog(layout)
    const known = (c: string, id: string) => options[c]?.some((o: any) => o.id === id)

    let build = null
    if (ai.build && CATS.every((c) => typeof ai.build[c] === 'string' && known(c, ai.build[c]))) {
      const part_ids = Object.fromEntries(CATS.map((c) => [c, ai.build[c]]))
      const { total, lines } = priceIds(layout, part_ids)
      build = {
        layout,
        part_ids,
        total,
        names: Object.fromEntries(CATS.map((c) => [c, lines[c].name])),
      }
    }

    let change = null
    if (ai.change && known(ai.change.category, ai.change.id)) {
      const o = options[ai.change.category].find((x: any) => x.id === ai.change.id)
      change = { category: ai.change.category, id: o.id, name: o.name, price: o.price }
    }

    return json({
      reply: String(ai.reply ?? '').slice(0, 600),
      layout,
      build,
      change,
      note: image ? 'Estimate from a photo. Check the parts in the builder.' : null,
    })
  } catch (e) {
    console.error(e)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
