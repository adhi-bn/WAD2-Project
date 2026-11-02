/**
 * @fileoverview Shared WebGL capability detection seam.
 * Centralises the WebGL/WebGL2 availability probe used by the 3D scene engines so
 * jsdom and headless environments degrade gracefully without duplicating logic.
 */

/**
 * Safely checks WebGL/WebGL2 context availability in the current environment.
 * Accepts a Document, HTMLCanvasElement, or defaults to global document.
 *
 * @param {Document|HTMLCanvasElement|null} [target] - Document or canvas to test.
 * @returns {boolean} True if WebGL or WebGL2 context can be acquired.
 */
export function isWebGLAvailable(target = (typeof document !== 'undefined' ? document : null)) {
  if (!target) return false
  if (target._mockContext) return true
  try {
    let canvas
    if (typeof target.getContext === 'function') {
      canvas = target
    } else if (typeof target.createElement === 'function') {
      canvas = target.createElement('canvas')
    } else {
      return false
    }
    const win = target.defaultView || (typeof window !== 'undefined' ? window : null)
    if (win && !win.WebGLRenderingContext && !target.getContext) return false
    const gl =
      (canvas._mockContext ? canvas._mockContext : null) ||
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    return Boolean(gl)
  } catch {
    return false
  }
}
