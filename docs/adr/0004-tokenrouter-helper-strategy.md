# 0004. TokenRouter OpenAI-compatible Helper Strategy

**Status**: Accepted

## Context

The Biscuit Fat Cat mascot requires an AI advisor capability that can recommend keyboard builds and swap parts based on user queries and uploaded photos. This capability requires:
1. Secure handling of AI provider API keys without exposing secrets to client-side bundles.
2. Abuse prevention via rate limiting.
3. Catalog integrity — the advisor must only recommend parts that exist in our catalog and match the specified layout.
4. Robust fallback behavior when offline or unconfigured.

## Decision

We route Biscuit's conversational recommendations through a server-side Supabase Edge Function (`supabase/functions/advisor/index.ts`) calling TokenRouter's OpenAI-compatible Chat Completions API (`POST ${TOKENROUTER_BASE_URL}/chat/completions`), backed by a null-safe client seam (`src/lib/advisor.js`) and strict server-side catalog Part ID validation.

Key design points:
- **Server-Side Secrets**: `TOKENROUTER_API_KEY` is kept strictly in server-side Supabase secrets.
- **Client Seam**: `src/lib/advisor.js` exposes `askAdvisor()` and `isAdvisorReady()` with a 15-second `AbortSignal` timeout, failing gracefully if unconfigured.
- **Catalog Grounding**: Every recommended Part ID is validated against `catalog(layout)`. Any non-catalog or hallucinated Part ID is discarded before the response reaches the client.
- **Fallback Note**: Multimodal photo requests that fail upstream or cannot be parsed fall back gracefully with explanatory notes.

## Considered Options

1. **TokenRouter via Supabase Edge Function (`supabase/functions/advisor/index.ts`) + `src/lib/advisor.js` client seam (Chosen)**: Keeps `TOKENROUTER_API_KEY` strictly in server-side Supabase secrets, preserves IP-based rate limiting (`ai_requests` table), validates every recommended Part ID against the static catalog before returning to the client, and allows switching models (`TOKENROUTER_MODEL`, default `z-ai/glm-5.3-flash`) or base URLs without client code changes.
2. **Direct Browser Calls (`VITE_TOKENROUTER_API_KEY`)**: Rejected because any `VITE_*` variable is bundled into public client assets, leaking the billing API key to visitors.
3. **Rules-Only Local Helper**: Rejected as the primary strategy because Gate 6 (`D5` / `#7`) requires a real external async-HTTP integration, though local rules remain as the null-safe fallback when backend credentials are unset (`Advisor` badge vs `AI Advisor` badge).

## Consequences

### Positive
- API credentials are fully protected from client inspection.
- Users receive grounded recommendations containing only real parts from our catalog.
- If the AI service or Supabase is down or unconfigured, the app falls back smoothly to local canned rules without crashing or blocking users.
- Chat UI accurately reflects connectivity via semantic badges (`AI Advisor` vs `Advisor`).

### Negative / Trade-offs
- Requires Supabase CLI or Edge Function deployment to run the live AI path in development or production.
- IP-based rate limiting is bound to Edge Function runtime and Supabase database availability.

