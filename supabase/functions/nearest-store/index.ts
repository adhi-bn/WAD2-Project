// Compares two Le Chaton Typers locations with OneMap's driving router.
// ONEMAP_EMAIL and ONEMAP_PASSWORD are Supabase secrets. Never expose them to the browser.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const STORES = [
  { id: 'jewel', latitude: 1.3602, longitude: 103.989 },
  { id: 'mbs', latitude: 1.2834, longitude: 103.8607 },
]

let accessToken = ''
let tokenExpiresAt = 0

async function getAccessToken() {
  // Reuse OneMap's three-day token across warm Edge Function requests.
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) return accessToken
  const email = Deno.env.get('ONEMAP_EMAIL')
  const password = Deno.env.get('ONEMAP_PASSWORD')
  if (!email || !password) throw new Error('Store routing is not configured yet.')

  const response = await fetch('https://www.onemap.gov.sg/api/auth/post/getToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.access_token) throw new Error('OneMap authentication failed.')
  accessToken = data.access_token
  tokenExpiresAt = Number(data.expiry_timestamp) * 1000
  return accessToken
}

async function drivingRoute(token: string, latitude: number, longitude: number, store: typeof STORES[number]) {
  const query = new URLSearchParams({
    start: `${latitude},${longitude}`,
    end: `${store.latitude},${store.longitude}`,
    routeType: 'drive',
  })
  const response = await fetch(`https://www.onemap.gov.sg/api/public/routingsvc/route?${query}`, {
    headers: { Authorization: token },
  })
  const data = await response.json().catch(() => ({}))
  const durationSeconds = Number(data.route_summary?.total_time)
  if (!response.ok || !Number.isFinite(durationSeconds)) throw new Error('OneMap could not find a driving route.')
  return {
    ...store,
    durationSeconds,
    distanceMeters: Number(data.route_summary?.total_distance) || 0,
    routeGeometry: typeof data.route_geometry === 'string' ? data.route_geometry : '',
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  try {
    const { latitude, longitude, origin } = await req.json()
    const lat = Number(latitude)
    const lng = Number(longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 1.13 || lat > 1.5 || lng < 103.6 || lng > 104.1) {
      return json({ error: 'Store routing is available for locations in Singapore only.' }, 400)
    }

    const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((value) => value.trim()).filter(Boolean)
    if (allowedOrigins.length && !allowedOrigins.includes(origin)) return json({ error: 'Store routing is not available on this site.' }, 403)

    const token = await getAccessToken()
    const routes = await Promise.all(STORES.map((store) => drivingRoute(token, lat, lng, store)))
    const nearest = routes.reduce((best, route) => route.durationSeconds < best.durationSeconds ? route : best)
    return json({
      storeId: nearest.id,
      durationSeconds: nearest.durationSeconds,
      distanceMeters: nearest.distanceMeters,
      routeGeometry: nearest.routeGeometry,
      routes: routes.map((route) => ({
        storeId: route.id,
        durationSeconds: route.durationSeconds,
        distanceMeters: route.distanceMeters,
      })),
    })
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : 'We could not compare driving routes.' }, 502)
  }
})
