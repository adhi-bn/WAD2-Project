// Biscuit's advisor: takes a text question and/or a keyboard photo, asks TokenRouter, and returns a build
// made ONLY from parts in our catalogue. Every part id returned is checked against the catalogue
// before it reaches the visitor, so the advisor cannot suggest something we don't sell.
//
// Secrets (set with `supabase secrets set --env-file ./supabase/.env`):
//   TOKENROUTER_API_KEY   key from TokenRouter (server only, required)
//   TOKENROUTER_BASE_URL  optional, defaults to https://api.tokenrouter.com/v1
//   TOKENROUTER_MODEL     optional, defaults to z-ai/glm-5.3-flash
//   ALLOWED_ORIGINS       same list as the checkout function
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { CATS, catalog, priceIds, BASE } from '../_shared/catalog.js'

function getCorsHeaders(reqOrigin?: string | null) {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const isAllowed = reqOrigin && allowed.includes(reqOrigin)
  const allowOrigin = isAllowed
    ? reqOrigin
    : (allowed.length === 0 || allowed.includes('*') ? '*' : '')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin
  }
  return headers
}

const json = (body: unknown, status = 200, reqOrigin?: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(reqOrigin), 'Content-Type': 'application/json' },
  })

const LAYOUTS = ['60', '75', '100']
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
const MAX_MESSAGE = 500
const MAX_IMAGE_B64 = 4 * 1024 * 1024 * 1.4 // about 4 MB of image data once base64 encoded
const PER_HOUR = 10 // questions per visitor (by IP) per hour

// Summarise the catalogue for the prompt: one line per option, with the details that matter for choosing.
function catalogueText(layout: string, base: typeof BASE = BASE) {
  const options = catalog(layout, base)
  return CATS.map((c) => {
    const lines = options[c].map((o: any) => {
      const detail = { ...o }
      for (const k of ['id', 'name', 'price', 'grams', 'p', 'g', 'ps', 'pp']) delete detail[k]
      return `  ${o.id} | ${o.name} | S$${o.price} | ${JSON.stringify(detail)}`
    })
    return `${c}:\n${lines.join('\n')}`
  }).join('\n')
}

// Resilient JSON extractor: extracts JSON object with a "reply" key, stripping <think> tags and markdown fences.
function findReply(node: any): any {
  if (typeof node === 'string') {
    let clean = node.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    const fenceMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (fenceMatch) {
      clean = fenceMatch[1].trim()
    } else {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    }

    try {
      const parsed = JSON.parse(clean)
      if (parsed && typeof parsed === 'object' && 'reply' in parsed) return parsed
    } catch {
      const first = clean.indexOf('{')
      const last = clean.lastIndexOf('}')
      if (first !== -1 && last > first) {
        try {
          const parsed = JSON.parse(clean.slice(first, last + 1))
          if (parsed && typeof parsed === 'object' && 'reply' in parsed) return parsed
        } catch { /* not JSON */ }
      }
    }
    return null
  }

  if (Array.isArray(node)) {
    for (const n of node) { const f = findReply(n); if (f) return f }
  } else if (node && typeof node === 'object') {
    if ('choices' in node && Array.isArray(node.choices) && node.choices[0]?.message?.content) {
      const f = findReply(node.choices[0].message.content)
      if (f) return f
    }
    if ('reply' in node) return node
    for (const v of Object.values(node)) { const f = findReply(v); if (f) return f }
  }
  return null
}

function buildPrompt(layout: string, userText: string, hasImage: boolean, base: typeof BASE = BASE) {
  const safeLayout = LAYOUTS.includes(layout) ? layout : '75'
  const text = String(userText ?? '').trim()
  const req = text || (hasImage ? '(sent a photo only)' : '')

  return `You are Biscuit, the friendly fat cat who helps people choose a custom mechanical keyboard at Le Chaton Typers.

Rules:
- Recommend ONLY part ids that appear in the catalogue below. Never invent a part.
- Choose one id per slot across the Component Groups for a full build, or set "build" to null if you are only suggesting one change.
- Structure recommendations using the project's 6 Component Groups: Case, Plate, PCB, Switches, Keycaps, and Add-ons (comprising Stabilisers, Foam, Cable).
- If the customer names a layout (60%, 75% or 100%) use it. Otherwise use "${safeLayout}".
- If the customer gives a budget, keep the total under it.
- ${hasImage ? 'The customer sent a photo. Describe the keyboard you see (layout, case, keycaps, switch feel if visible) and pick the closest matching parts from the catalogue. Say clearly that this is an estimate from a photo.' : 'Base the build on what the customer asks for.'}
- "reply" is for the customer: friendly, plain English, under 80 words. Mention the total in S$.
- If the request has nothing to do with keyboards, say so kindly in "reply", and set both "build" and "change" to null.
- Keep internal reasoning concise (under 3 sentences) and emit the JSON payload immediately.
- Respond with a valid JSON object matching this schema:
{
  "reply": "string",
  "layout": "60" | "75" | "100",
  "build": {
    "case": "string",
    "plate": "string",
    "pcb": "string",
    "switches": "string",
    "keycaps": "string",
    "stabs": "string",
    "foam": "string",
    "cable": "string"
  } | null,
  "change": {
    "category": "string",
    "id": "string"
  } | null
}

Catalogue (id | name | price for ${safeLayout}% | details):
${catalogueText(safeLayout, base)}${req ? `\n\nCustomer request: ${req}` : ''}`
}

Deno.serve(async (req) => {
  const headerOrigin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(headerOrigin) })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405, headerOrigin)

  let reqOrigin: string | null = headerOrigin

  try {
    const { message, image, origin, layout: askedLayout } = await req.json()
    reqOrigin = req.headers.get('origin') || origin

    const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (allowed.length > 0 && !allowed.includes('*') && (!reqOrigin || !allowed.includes(reqOrigin))) {
      return json({ error: 'Biscuit is not available on this site.' }, 403, reqOrigin)
    }

    const text = String(message ?? '').trim().slice(0, MAX_MESSAGE)
    if (!text && !image) return json({ error: 'Tell me what you are looking for, or send a photo.' }, 400, reqOrigin)
    if (image) {
      if (!IMAGE_TYPES.includes(image.mime_type)) return json({ error: 'Please send a JPG, PNG or WEBP photo.' }, 400, reqOrigin)
      if (typeof image.data !== 'string' || image.data.length > MAX_IMAGE_B64) return json({ error: 'That photo is too big. Try one under 4 MB.' }, 400, reqOrigin)
    }
    const layout = LAYOUTS.includes(askedLayout) ? askedLayout : '75'

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Simple per-visitor limit, so one person can't run up the AI bill.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await admin.from('ai_requests').select('*', { count: 'exact', head: true }).eq('ip', ip).gte('created_at', since)
    if ((count ?? 0) >= PER_HOUR) return json({ error: 'Biscuit needs a short nap. Try again in a little while.' }, 429, reqOrigin)
    await admin.from('ai_requests').insert({ ip })

    // Load live catalogue from Supabase parts table (matching PR #40), falling back to static BASE
    let activeBase = BASE
    try {
      const { data: partRows, error: partsErr } = await admin.from('parts').select('category_key,data')
      if (!partsErr && partRows && partRows.length > 0) {
        const remoteCatalogue: Record<string, any[]> = {}
        for (const r of partRows) {
          if (r?.category_key && r?.data) {
            (remoteCatalogue[r.category_key] ??= []).push(r.data)
          }
        }
        if (CATS.every((c) => remoteCatalogue[c]?.length > 0)) {
          activeBase = remoteCatalogue as typeof BASE
        }
      }
    } catch {
      // Fallback to static BASE
    }

    // Check TokenRouter API key
    const apiKey = Deno.env.get('TOKENROUTER_API_KEY')
    if (!apiKey) {
      console.error('TOKENROUTER_API_KEY is not configured')
      return json({ error: 'TokenRouter API key not configured' }, 500, reqOrigin)
    }

    const baseUrl = (Deno.env.get('TOKENROUTER_BASE_URL') || 'https://api.tokenrouter.com/v1').replace(/\/+$/, '')
    const model = Deno.env.get('TOKENROUTER_MODEL') || 'z-ai/glm-5.3-flash'

    const systemPrompt = buildPrompt(layout, '', Boolean(image), activeBase)
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
    ]

    if (image) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: text || '(sent a photo only)' },
          { type: 'image_url', image_url: { url: `data:${image.mime_type};base64,${image.data}` } },
        ],
      })
    } else {
      messages.push({
        role: 'user',
        content: text || 'Help me build a keyboard',
      })
    }

    const callChatCompletions = async (msgs: any[], jsonFormat = true) => {
      const payload: Record<string, unknown> = {
        model,
        messages: msgs,
      }
      if (jsonFormat) {
        payload.response_format = { type: 'json_object' }
      }
      return await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      })
    }

    let res = await callChatCompletions(messages, true)
    let fallbackTextOnly = false

    // If image is present and upstream returns 400 or 422 (e.g. model rejects vision content),
    // automatically retry once with text-only messages and append a note explaining the estimate is from text description.
    if (!res.ok && image && (res.status === 400 || res.status === 422)) {
      console.warn(`Vision call returned ${res.status}. Retrying with text-only messages.`)
      const fallbackMessages = [
        { role: 'system', content: buildPrompt(layout, '', false, activeBase) },
        { role: 'user', content: text || 'Customer provided a photo that could not be processed. Please suggest a great starter build.' },
      ]
      const fallbackRes = await callChatCompletions(fallbackMessages, true)
      if (fallbackRes.ok) {
        res = fallbackRes
        fallbackTextOnly = true
      }
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('TokenRouter error', res.status, JSON.stringify(data).slice(0, 500))
      return json({ error: 'Biscuit is having a moment. Please try again.' }, 502, reqOrigin)
    }

    let ai = findReply(data)
    if (!ai) {
      // Retry once without response_format: { type: 'json_object' } (SPEC-02)
      console.warn('Chat completion succeeded but findReply returned null. Retrying without response_format.')
      const retryMsgs = fallbackTextOnly
        ? [
            { role: 'system', content: buildPrompt(layout, '', false, activeBase) },
            { role: 'user', content: text || 'Customer provided a photo that could not be processed. Please suggest a great starter build.' },
          ]
        : messages
      const retryRes = await callChatCompletions(retryMsgs, false)
      if (retryRes.ok) {
        const retryData = await retryRes.json().catch(() => ({}))
        ai = findReply(retryData)
      }
    }

    if (!ai) return json({ error: 'Biscuit could not make sense of that. Try asking another way.' }, 502, reqOrigin)

    // Check everything suggested against the catalogue.
    const options = catalog(layout, activeBase)
    const known = (c: string, id: string) =>
      CATS.includes(c) && Array.isArray(options[c]) && options[c].some((o: any) => o.id === id)

    let build = null
    if (ai.build && typeof ai.build === 'object' && CATS.every((c) => typeof ai.build[c] === 'string' && known(c, ai.build[c]))) {
      const part_ids = Object.fromEntries(CATS.map((c) => [c, ai.build[c]]))
      const { total, lines } = priceIds(layout, part_ids, activeBase)
      build = {
        layout,
        part_ids,
        total,
        names: Object.fromEntries(CATS.map((c) => [c, lines[c].name])),
      }
    }

    let change = null
    if (ai.change && typeof ai.change === 'object' && known(ai.change.category, ai.change.id)) {
      const o = options[ai.change.category].find((x: any) => x.id === ai.change.id)
      change = { category: ai.change.category, id: o.id, name: o.name, price: o.price }
    }

    let note: string | null = null
    if (fallbackTextOnly) {
      note = 'Photo could not be processed by AI model; estimate is based on your text description.'
    } else if (image) {
      note = 'Estimate from a photo. Check the parts in the builder.'
    }

    return json({
      reply: String(ai.reply ?? '').slice(0, 600),
      layout,
      build,
      change,
      note,
    }, 200, reqOrigin)
  } catch (e) {
    console.error(e)
    return json({ error: 'Something went wrong. Please try again.' }, 500, reqOrigin)
  }
})
