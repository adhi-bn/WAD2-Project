/**
 * @fileoverview Pure utility for computing normalized scroll progress across a story section,
 * pinning the final progress to 1.0 when scrolled to the bottom of the document.
 */

/**
 * Computes normalized scroll progress in [0, 1] across a DOM story range.
 * Dynamically adjusts effective range based on maxScroll so that reaching the bottom of the page
 * (scrollY = maxScroll) reliably yields a progress of 1.0 across any viewport height.
 *
 * @param {object} [params={}] - Progress calculation parameters.
 * @param {number} [params.scrollY=0] - Current vertical scroll offset (e.g. window.scrollY).
 * @param {number} [params.viewportH=0] - Viewport height in pixels (e.g. window.innerHeight).
 * @param {number} [params.startY=0] - Absolute document top coordinate of the story start element.
 * @param {number} [params.endY=0] - Absolute document bottom coordinate of the story end element.
 * @param {number} [params.maxScroll] - Maximum scrollable document distance (document scrollHeight - viewportH).
 * @returns {number} Normalized progress value clamped within [0, 1].
 */
export function computeStoryProgress({
  scrollY = 0,
  viewportH = 0,
  startY = 0,
  endY = 0,
  maxScroll,
} = {}) {
  // Validate total story distance across start and end boundaries
  const total = endY - startY
  if (!Number.isFinite(total) || total <= 0) return 0

  // Calculate current story progress relative to viewport vertical midpoint
  const current = scrollY + 0.5 * viewportH - startY
  if (!Number.isFinite(current) || current <= 0) return 0

  // If maxScroll is defined, clamp effective range to the maximum reachable midpoint progress
  // to ensure reaching page bottom guarantees progress = 1.0 even if end element is near the page footer
  const maxCurrent = Number.isFinite(maxScroll)
    ? maxScroll + 0.5 * viewportH - startY
    : total

  const effectiveRange = Math.min(total, maxCurrent)
  if (!Number.isFinite(effectiveRange) || effectiveRange <= 0) return 0

  return Math.max(0, Math.min(1, current / effectiveRange))
}
