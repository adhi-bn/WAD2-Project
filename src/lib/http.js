// Tiny JSON fetch seam for future async APIs (parts catalogue, persistence).
// ponytail: no retries/abort/typed errors yet; grow when a caller needs them.
export async function fetchJson(url, options = {}) {
  const res = await fetch(url, options)
  if (!res.ok) throw new Error(`fetchJson ${res.status} ${res.statusText}`)
  return res.json()
}
