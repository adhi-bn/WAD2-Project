import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CATS, catalog, priceIds } from '../../src/data/catalog.js'
import {
  askAdvisor,
  buildAdvisorPrompt,
  formatOpenAIMessages,
  isAdvisorReady,
  parseAdvisorReply,
  validateAdvisorCatalogResponse,
} from '../../src/lib/advisor.js'
import * as supabaseModule from '../../src/lib/supabase.js'

describe('Advisor prompt builder', () => {
  it('includes all catalog parts, categories, and layout specifications', () => {
    const layout = '75'
    const prompt = buildAdvisorPrompt(layout, 'Looking for something clacky')
    const options = catalog(layout)

    // Check system persona and layout
    expect(prompt).toContain('You are Biscuit')
    expect(prompt).toContain('75%')

    // Check that every category in CATS is present in the prompt
    for (const cat of CATS) {
      expect(prompt).toContain(`${cat}:`)
      // Check that at least the first part of each category is listed with ID and name
      const firstPart = options[cat][0]
      expect(prompt).toContain(firstPart.id)
      expect(prompt).toContain(firstPart.name)
    }

    // Customer text is appended
    expect(prompt).toContain('Customer request: Looking for something clacky')
  })

  it('handles 60% and 100% layouts with appropriate parts', () => {
    const prompt60 = buildAdvisorPrompt('60')
    expect(prompt60).toContain('60%')

    const prompt100 = buildAdvisorPrompt('100')
    expect(prompt100).toContain('100%')
  })

  it('includes photo notice rule and note when hasImage is true', () => {
    const prompt = buildAdvisorPrompt('75', '', true)
    expect(prompt).toContain('The customer sent a photo')
    expect(prompt).toContain('Customer request: (sent a photo only)')
  })
})

describe('OpenAI messages formatting', () => {
  it('formats text-only messages with system prompt and user text', () => {
    const messages = formatOpenAIMessages('75', 'Recommend a silent build')
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('You are Biscuit')
    expect(messages[1].role).toBe('user')
    expect(messages[1].content).toBe('Recommend a silent build')
  })

  it('formats multimodal messages with image_url data URI when image is provided', () => {
    const image = {
      mime_type: 'image/jpeg',
      data: 'aW1hZ2VkYXRh',
    }
    const messages = formatOpenAIMessages('75', 'What keyboard is this?', image)
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('The customer sent a photo')

    expect(messages[1].role).toBe('user')
    expect(Array.isArray(messages[1].content)).toBe(true)
    expect(messages[1].content).toEqual([
      { type: 'text', text: 'What keyboard is this?' },
      {
        type: 'image_url',
        image_url: {
          url: 'data:image/jpeg;base64,aW1hZ2VkYXRh',
        },
      },
    ])
  })

  it('provides fallback text when customer sends a photo without text', () => {
    const image = {
      mime_type: 'image/png',
      data: 'cG5nZGF0YQ==',
    }
    const messages = formatOpenAIMessages('75', '', image)
    expect(messages[1].content[0]).toEqual({ type: 'text', text: '(sent a photo only)' })
  })
})

describe('Resilient advisor reply parsing', () => {
  it('parses plain JSON string', () => {
    const raw = JSON.stringify({
      reply: 'Here is a balanced 75% build for you!',
      layout: '75',
      build: null,
      change: null,
    })
    const parsed = parseAdvisorReply(raw)
    expect(parsed).toEqual({
      reply: 'Here is a balanced 75% build for you!',
      layout: '75',
      build: null,
      change: null,
    })
  })

  it('strips markdown code fences (```json ... ```)', () => {
    const raw = '```json\n{"reply": "Fenced reply", "layout": "75", "build": null, "change": null}\n```'
    const parsed = parseAdvisorReply(raw)
    expect(parsed?.reply).toBe('Fenced reply')
    expect(parsed?.layout).toBe('75')
  })

  it('strips <think>...</think> reasoning tags from models', () => {
    const raw = `<think>
I should check if the user wanted silent switches.
Gateron Silent Red would be great.
</think>
{"reply": "Here is a silent option.", "layout": "75", "build": null, "change": null}`
    const parsed = parseAdvisorReply(raw)
    expect(parsed?.reply).toBe('Here is a silent option.')
  })

  it('handles both <think> tags and markdown fences together', () => {
    const raw = `<think>Analyzing catalogue...</think>
\`\`\`json
{
  "reply": "Thinking done",
  "layout": "60",
  "build": null,
  "change": null
}
\`\`\``
    const parsed = parseAdvisorReply(raw)
    expect(parsed?.reply).toBe('Thinking done')
    expect(parsed?.layout).toBe('60')
  })

  it('extracts content from OpenAI chat completion response structure', () => {
    const openAiResponse = {
      choices: [
        {
          message: {
            content: '{"reply": "From choices structure", "layout": "75", "build": null, "change": null}',
          },
        },
      ],
    }
    const parsed = parseAdvisorReply(openAiResponse)
    expect(parsed?.reply).toBe('From choices structure')
  })

  it('extracts from already-parsed JS objects', () => {
    const obj = { reply: 'Direct object', layout: '100', build: null, change: null }
    const parsed = parseAdvisorReply(obj)
    expect(parsed?.reply).toBe('Direct object')
    expect(parsed?.layout).toBe('100')
  })

  it('returns null for invalid or non-JSON input', () => {
    expect(parseAdvisorReply(null)).toBeNull()
    expect(parseAdvisorReply(undefined)).toBeNull()
    expect(parseAdvisorReply('not a json string')).toBeNull()
    expect(parseAdvisorReply({})).toBeNull()
  })
})

describe('Catalog response validation & hallucination rejection', () => {
  it('validates a build with all valid part IDs and computes accurate price total', () => {
    const validParts = {
      case: 'alu',
      plate: 'pcp',
      pcb: 'hs',
      switches: 'oilking',
      keycaps: 'plainpbt',
      stabs: 'durock',
      foam: 'basic',
      cable: 'coil',
    }
    const expected = priceIds('75', validParts)

    const validated = validateAdvisorCatalogResponse({
      reply: 'Here is your build!',
      layout: '75',
      build: validParts,
      change: null,
    })

    expect(validated.layout).toBe('75')
    expect(validated.build).not.toBeNull()
    expect(validated.build?.total).toBe(expected.total)
    expect(validated.build?.part_ids).toEqual(validParts)
    expect(validated.build?.names.case).toBe(expected.lines.case.name)
  })

  it('rejects hallucinated part IDs by nulling out build', () => {
    const hallucinatedParts = {
      case: 'alu',
      plate: 'pcp',
      pcb: 'hs',
      switches: 'invented-magic-switch', // Not in catalog!
      keycaps: 'plainpbt',
      stabs: 'durock',
      foam: 'basic',
      cable: 'coil',
    }

    const validated = validateAdvisorCatalogResponse({
      reply: 'I recommend magic switches!',
      layout: '75',
      build: hallucinatedParts,
      change: null,
    })

    // Entire build is nullified because of hallucinated switch
    expect(validated.build).toBeNull()
    expect(validated.reply).toBe('I recommend magic switches!')
  })

  it('validates change suggestion against catalog and rejects unknown changes', () => {
    const validChange = validateAdvisorCatalogResponse({
      reply: 'Upgrade your switches!',
      layout: '75',
      build: null,
      change: { category: 'switches', id: 'cream' },
    })
    expect(validChange.change).toEqual({
      category: 'switches',
      id: 'cream',
      name: 'Akko V3 Cream Yellow Pro',
      price: expect.any(Number),
    })

    const invalidChange = validateAdvisorCatalogResponse({
      reply: 'Upgrade your switches!',
      layout: '75',
      build: null,
      change: { category: 'switches', id: 'nonexistent-switch-id' },
    })
    expect(invalidChange.change).toBeNull()
  })

  it('handles adversarial categories like toString or valueOf safely without throwing', () => {
    expect(() => {
      const res = validateAdvisorCatalogResponse({
        reply: 'Check this out',
        layout: '75',
        build: null,
        change: { category: 'toString', id: 'foo' },
      })
      expect(res.change).toBeNull()
    }).not.toThrow()

    expect(() => {
      const res = validateAdvisorCatalogResponse({
        reply: 'Check this out',
        layout: '75',
        build: null,
        change: { category: 'valueOf', id: 'bar' },
      })
      expect(res.change).toBeNull()
    }).not.toThrow()
  })

  it('handles null or missing inputs gracefully', () => {
    const res = validateAdvisorCatalogResponse(null)
    expect(res).toEqual({
      reply: '',
      layout: '75',
      build: null,
      change: null,
    })
  })
})

describe('isAdvisorReady seam', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when getSupabase returns null', () => {
    vi.spyOn(supabaseModule, 'getSupabase').mockReturnValue(null)
    expect(isAdvisorReady()).toBe(false)
  })

  it('returns true when getSupabase returns an active client', () => {
    vi.spyOn(supabaseModule, 'getSupabase').mockReturnValue({ functions: {} })
    expect(isAdvisorReady()).toBe(true)
  })

  it('returns false when getSupabase throws an error', () => {
    vi.spyOn(supabaseModule, 'getSupabase').mockImplementation(() => {
      throw new Error('Supabase client error')
    })
    expect(isAdvisorReady()).toBe(false)
  })
})

describe('askAdvisor caller seam', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns ok: false error immediately when advisor is not ready', async () => {
    vi.spyOn(supabaseModule, 'getSupabase').mockReturnValue(null)

    const res = await askAdvisor({ message: 'Need a recommendation' })
    expect(res).toEqual({
      ok: false,
      error: 'Advisor is not configured.',
    })
  })

  it('invokes Edge Function and returns success data', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: {
        reply: 'Biscuit recommends this 75% setup.',
        layout: '75',
        build: { total: 350 },
        change: null,
        note: null,
      },
      error: null,
    })

    vi.spyOn(supabaseModule, 'getSupabase').mockReturnValue({
      functions: { invoke: mockInvoke },
    })

    const res = await askAdvisor({
      message: 'Quiet keyboard please',
      layout: '75',
      origin: 'http://localhost:5173',
    })

    expect(mockInvoke).toHaveBeenCalledWith('advisor', {
      body: {
        message: 'Quiet keyboard please',
        image: null,
        origin: 'http://localhost:5173',
        layout: '75',
      },
    })
    expect(res).toEqual({
      ok: true,
      reply: 'Biscuit recommends this 75% setup.',
      layout: '75',
      build: { total: 350 },
      change: null,
      note: null,
    })
  })

  it('handles function error response with details', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'HTTP error',
        context: {
          json: async () => ({ error: 'Biscuit needs a short nap. Try again in a little while.' }),
        },
      },
    })

    vi.spyOn(supabaseModule, 'getSupabase').mockReturnValue({
      functions: { invoke: mockInvoke },
    })

    const res = await askAdvisor({ message: 'spam' })
    expect(res).toEqual({
      ok: false,
      error: 'Biscuit needs a short nap. Try again in a little while.',
    })
  })

  it('handles timeouts cleanly without throwing unhandled rejection', async () => {
    // Return a promise that hangs longer than timeoutMs
    const mockInvoke = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 200)))

    vi.spyOn(supabaseModule, 'getSupabase').mockReturnValue({
      functions: { invoke: mockInvoke },
    })

    const res = await askAdvisor({ message: 'Hello', timeoutMs: 20 })
    expect(res).toEqual({
      ok: false,
      error: 'Advisor request timed out. Please try again.',
    })
  })
})
