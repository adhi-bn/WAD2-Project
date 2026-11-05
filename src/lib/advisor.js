/**
 * @file advisor.js
 * Browser client seam and helpers for Biscuit the AI keyboard advisor.
 * Connects to TokenRouter OpenAI-compatible models via Supabase Edge Function 'advisor'.
 */

import { CATS, catalog, priceIds } from '../data/catalog.js'
import { getSupabase } from './supabase.js'

const LAYOUTS = ['60', '75', '100']

/**
 * Summarises the catalogue for the AI prompt: one line per option with salient specs.
 *
 * @param {string} layout Target layout ('60', '75', '100').
 * @returns {string} Formatted catalogue text grouped by category.
 */
function catalogueText(layout) {
  const options = catalog(layout)
  return CATS.map((c) => {
    const lines = options[c].map((o) => {
      const detail = { ...o }
      for (const k of ['id', 'name', 'price', 'grams', 'p', 'g', 'ps', 'pp']) delete detail[k]
      return `  ${o.id} | ${o.name} | S$${o.price} | ${JSON.stringify(detail)}`
    })
    return `${c}:\n${lines.join('\n')}`
  }).join('\n')
}

/**
 * Checks dynamically whether Supabase is configured and ready for advisor calls.
 * Returns false if getSupabase() is null or throws an error.
 *
 * @returns {boolean} True if Supabase client is available, false otherwise.
 */
export function isAdvisorReady() {
  try {
    const client = getSupabase()
    return Boolean(client)
  } catch {
    return false
  }
}

/**
 * Builds the advisor prompt with system instructions, rules, strict JSON schema,
 * and the catalogue options for the requested layout.
 *
 * @param {string} [layout='75'] Keyboard layout ('60', '75', '100').
 * @param {string} [userText=''] The customer's text request.
 * @param {boolean} [hasImage=false] Whether customer sent a reference photo.
 * @returns {string} The full prompt string.
 */
export function buildAdvisorPrompt(layout = '75', userText = '', hasImage = false) {
  const safeLayout = LAYOUTS.includes(String(layout)) ? String(layout) : '75'
  const text = String(userText ?? '').trim()
  const req = text || (hasImage ? '(sent a photo only)' : '')

  return `You are Biscuit, the friendly fat cat who helps people choose a custom mechanical keyboard at Le Chaton Typers.

Rules:
- Recommend ONLY part ids that appear in the catalogue below. Never invent a part.
- Choose one id per Component Group (category) for a full build, or set "build" to null if you are only suggesting one change.
- Refer to parts by their canonical Component Group names (Case, Plate, PCB, Switches, Keycaps, Stabilisers, Foam, Cable).
- If the customer names a layout (60%, 75% or 100%) use it. Otherwise use "${safeLayout}".
- If the customer gives a budget, keep the total under it.
- ${hasImage ? 'The customer sent a photo. Describe the keyboard you see (layout, case, keycaps, switch feel if visible) and pick the closest matching parts from the catalogue. Say clearly that this is an estimate from a photo.' : 'Base the build on what the customer asks for.'}
- "reply" is for the customer: friendly, plain English, under 80 words. Mention the total in S$.
- If the request has nothing to do with keyboards, say so kindly in "reply", and set both "build" and "change" to null.
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
${catalogueText(safeLayout)}${req ? `\n\nCustomer request: ${req}` : ''}`
}

/**
 * Formats messages array for OpenAI /chat/completions endpoint, supporting multimodal vision payloads.
 *
 * @param {string} [layout='75'] Layout identifier ('60', '75', '100').
 * @param {string} [userText=''] Customer prompt text.
 * @param {{ mime_type: string, data: string } | null} [image=null] Image object with base64 data and mime type.
 * @returns {Array<{ role: string, content: string | Array<object> }>} Formatted OpenAI messages.
 */
export function formatOpenAIMessages(layout = '75', userText = '', image = null) {
  const hasImage = Boolean(image && image.data && image.mime_type)
  const systemPrompt = buildAdvisorPrompt(layout, '', hasImage)
  const text = String(userText ?? '').trim()

  const messages = [
    { role: 'system', content: systemPrompt },
  ]

  if (hasImage) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: text || '(sent a photo only)' },
        {
          type: 'image_url',
          image_url: {
            url: `data:${image.mime_type};base64,${image.data}`,
          },
        },
      ],
    })
  } else {
    messages.push({
      role: 'user',
      content: text || 'Help me build a keyboard',
    })
  }

  return messages
}

/**
 * Resiliently extracts the JSON reply object from an OpenAI completion response, raw string, or parsed object.
 * Strips reasoning model thinking blocks (<think>...</think>) and markdown code fences.
 *
 * @param {unknown} raw Response from OpenAI completion or JSON string/object.
 * @returns {{ reply: string, layout: string, build: object|null, change: object|null } | null} Parsed payload or null.
 */
export function parseAdvisorReply(raw) {
  if (!raw) return null

  // If raw has choices array (OpenAI standard chat completion response)
  if (typeof raw === 'object' && Array.isArray(raw.choices) && raw.choices[0]?.message) {
    return parseAdvisorReply(raw.choices[0].message.content)
  }

  // If raw is a string
  if (typeof raw === 'string') {
    // Strip reasoning model thinking tags
    let clean = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

    // Strip markdown code fences if wrapped
    const fenceMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (fenceMatch) {
      clean = fenceMatch[1].trim()
    } else {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    }

    try {
      const parsed = JSON.parse(clean)
      if (parsed && typeof parsed === 'object' && 'reply' in parsed) {
        return {
          reply: parsed.reply,
          layout: parsed.layout,
          build: parsed.build ?? null,
          change: parsed.change ?? null,
        }
      }
    } catch {
      // Look for first '{' and last '}' substring
      const first = clean.indexOf('{')
      const last = clean.lastIndexOf('}')
      if (first !== -1 && last > first) {
        try {
          const parsed = JSON.parse(clean.slice(first, last + 1))
          if (parsed && typeof parsed === 'object' && 'reply' in parsed) {
            return {
              reply: parsed.reply,
              layout: parsed.layout,
              build: parsed.build ?? null,
              change: parsed.change ?? null,
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
    return null
  }

  // If raw is already an object
  if (typeof raw === 'object') {
    if ('reply' in raw) {
      return {
        reply: raw.reply,
        layout: raw.layout,
        build: raw.build ?? null,
        change: raw.change ?? null,
      }
    }
    for (const v of Object.values(raw)) {
      if (v && typeof v === 'object') {
        const nested = parseAdvisorReply(v)
        if (nested) return nested
      }
    }
  }

  return null
}

/**
 * Validates AI response parts against the official catalogue for the selected layout.
 * Enforces that every part ID exists, rejecting hallucinations, and calculates total price.
 *
 * @param {object} ai Parsed AI recommendation.
 * @param {string} [defaultLayout='75'] Fallback layout if missing or invalid.
 * @returns {{ reply: string, layout: string, build: object|null, change: object|null }} Validated recommendation.
 */
export function validateAdvisorCatalogResponse(ai, defaultLayout = '75') {
  if (!ai || typeof ai !== 'object') {
    return {
      reply: '',
      layout: defaultLayout,
      build: null,
      change: null,
    }
  }

  const safeLayout = LAYOUTS.includes(String(ai.layout)) ? String(ai.layout) : defaultLayout
  const options = catalog(safeLayout)
  const known = (cat, id) =>
    Boolean(CATS.includes(cat) && Array.isArray(options[cat]) && options[cat].some((o) => o.id === id))

  let build = null
  if (
    ai.build &&
    typeof ai.build === 'object' &&
    CATS.every((cat) => typeof ai.build[cat] === 'string' && known(cat, ai.build[cat]))
  ) {
    const part_ids = Object.fromEntries(CATS.map((cat) => [cat, ai.build[cat]]))
    try {
      const { total, lines } = priceIds(safeLayout, part_ids)
      build = {
        layout: safeLayout,
        part_ids,
        total,
        names: Object.fromEntries(CATS.map((cat) => [cat, lines[cat].name])),
      }
    } catch {
      build = null
    }
  }

  let change = null
  if (
    ai.change &&
    typeof ai.change === 'object' &&
    typeof ai.change.category === 'string' &&
    typeof ai.change.id === 'string' &&
    known(ai.change.category, ai.change.id)
  ) {
    const match = options[ai.change.category].find((x) => x.id === ai.change.id)
    if (match) {
      change = {
        category: ai.change.category,
        id: match.id,
        name: match.name,
        price: match.price,
      }
    }
  }

  return {
    reply: String(ai.reply ?? '').slice(0, 600),
    layout: safeLayout,
    build,
    change,
  }
}

/**
 * Calls Biscuit's advisor Edge Function with null-safety and timeout protection.
 *
 * @param {object} [params={}]
 * @param {string} [params.message=''] The text question from the visitor.
 * @param {{ mime_type: string, data: string } | null} [params.image=null] Optional image object.
 * @param {string} [params.layout='75'] Preferred layout ('60', '75', '100').
 * @param {string} [params.origin] Calling website origin (defaults to window.location.origin or localhost).
 * @param {number} [params.timeoutMs=15000] Timeout in milliseconds.
 * @returns {Promise<{ ok: boolean, reply?: string, layout?: string, build?: object|null, change?: object|null, note?: string|null, error?: string }>}
 */
export async function askAdvisor({
  message = '',
  image = null,
  layout = '75',
  origin = undefined,
  timeoutMs = 15000,
} = {}) {
  if (!isAdvisorReady()) {
    return { ok: false, error: 'Advisor is not configured.' }
  }

  const client = getSupabase()
  if (!client || !client.functions || typeof client.functions.invoke !== 'function') {
    return { ok: false, error: 'Advisor is not configured.' }
  }

  const siteOrigin = origin || (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost:5173')

  let timerId
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error('Advisor request timed out. Please try again.'))
    }, timeoutMs)
    if (timerId?.unref) timerId.unref()
  })

  try {
    const invokePromise = client.functions.invoke('advisor', {
      body: {
        message,
        image,
        origin: siteOrigin,
        layout,
      },
    })

    const { data, error } = await Promise.race([invokePromise, timeoutPromise])

    if (error) {
      let problemText = error.message || 'Biscuit is having a moment. Please try again.'
      try {
        if (typeof error.context?.json === 'function') {
          const details = await error.context.json()
          if (details?.error) problemText = details.error
        }
      } catch {
        /* ignore parsing error details */
      }
      return { ok: false, error: problemText }
    }

    if (!data) {
      return { ok: false, error: 'Biscuit could not process your request.' }
    }

    if (data.error) {
      return { ok: false, error: data.error }
    }

    return {
      ok: true,
      reply: data.reply,
      layout: data.layout,
      build: data.build ?? null,
      change: data.change ?? null,
      note: data.note ?? null,
    }
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Something went wrong. Please try again.',
    }
  } finally {
    if (timerId) clearTimeout(timerId)
  }
}
