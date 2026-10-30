import { supabase, supabaseReady } from './supabase.js'

/**
 * Finds the nearer store using OneMap's server-side driving-route comparison.
 *
 * @param {number} latitude The visitor's WGS84 latitude.
 * @param {number} longitude The visitor's WGS84 longitude.
 * @returns {Promise<{storeId?: string, durationSeconds?: number, distanceMeters?: number, routeGeometry?: string, routes?: Array<{storeId: string, durationSeconds: number, distanceMeters: number}>, error?: string}>} The nearest store result or a safe error.
 */
export async function findNearestDrivingStore(latitude, longitude) {
  if (!supabaseReady || !supabase) return { error: 'Store routing is not configured yet. Choose a store on the map below.' }

  try {
    const { data, error } = await supabase.functions.invoke('nearest-store', {
      body: { latitude, longitude, origin: window.location.origin },
    })
    if (error) {
      const details = await error.context?.json?.().catch(() => null)
      return { error: details?.error || 'We could not compare driving routes. Choose a store on the map below.' }
    }
    return data?.error ? { error: data.error } : data
  } catch {
    return { error: 'We could not compare driving routes. Choose a store on the map below.' }
  }
}
