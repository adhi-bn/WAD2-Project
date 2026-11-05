const decodedSamples = new WeakMap()

/** Creates a browser Web Audio context, including Safari's prefixed implementation.
 * @returns {AudioContext} A fresh context for user initiated switch playback.
 */
export function createSwitchAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) throw new Error('Web Audio is unavailable')
  return new AudioContextClass()
}

/** Resumes a suspended/interrupted context and verifies that playback can proceed.
 * @param {AudioContext} context - Context to resume.
 * @returns {Promise<void>} Resolves only while the context is running.
 */
export async function resumeSwitchAudioContext(context) {
  if (context.state !== 'running') await context.resume()
  if (context.state !== 'running') throw new Error('Web Audio context did not resume')
}

/** Fetches and decodes an approved public MP3 sample, reusing completed decodes.
 * @param {AudioContext} context - Context used for decoding.
 * @param {string} url - Static sample path from the switch catalogue.
 * @param {{signal?: AbortSignal}} [options] - Optional request cancellation.
 * @returns {Promise<AudioBuffer>} Decoded sample buffer.
 */
export async function decodeSwitchSample(context, url, { signal } = {}) {
  if (!/^\/switch-audio(?:-one-press)?\/[a-z0-9-]+\.mp3$/i.test(url)) {
    throw new Error('Invalid switch sample path')
  }
  let contextSamples = decodedSamples.get(context)
  if (!contextSamples) {
    contextSamples = new Map()
    decodedSamples.set(context, contextSamples)
  }
  if (contextSamples.has(url)) return contextSamples.get(url)

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Sample request failed (${response.status})`)
  const buffer = await context.decodeAudioData(await response.arrayBuffer())
  contextSamples.set(url, buffer)
  return buffer
}
