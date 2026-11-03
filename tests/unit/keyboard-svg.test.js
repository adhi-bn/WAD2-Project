import { describe, expect, it } from 'vitest'
import { kbSVG, virtualKeyboardKeys } from '../../src/logic/builder.js'

describe('virtual keyboard SVG key identities', () => {
  it.each(['60', '75', '100'])('matches every %s layout rectangle to one unique key ID', (layout) => {
    const svg = kbSVG(layout)
    const ids = [...svg.matchAll(/data-key-id="([^"]*)"/g)].map((match) => match[1])
    const keys = virtualKeyboardKeys(layout).map(({ code }) => code)

    expect(ids).toHaveLength(keys.length)
    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(keys)
    expect(keys[0]).toBe(layout === '60' ? 'Escape' : 'Backquote')
    expect(svg).toContain('aria-hidden="true"')
    expect(svg).not.toContain('Interactive')
  })

  it('places the navigation arrows and numpad keys at their drawn coordinates on 100%', () => {
    const svg = kbSVG('100')
    const rects = [...svg.matchAll(/<rect class="k[^>]*data-key-id="([^"]+)"[^>]*x="([^"]+)" y="([^"]+)"/g)]
    const position = (code) => {
      const rect = rects.find((match) => match[1] === code)
      return rect && [Number(rect[2]), Number(rect[3])]
    }

    expect(position('ArrowUp')).toEqual([175.8, 43.3])
    expect(position('NumLock')).toEqual([205.8, 13.3])
    expect(position('Numpad7')).toEqual([205.8, 23.3])
  })

  it('separates the 100% function row into the pictured key groups', () => {
    const svg = kbSVG('100')
    const rects = [...svg.matchAll(/<rect class="k[^>]*data-key-id="([^\"]+)"[^>]*x="([^\"]+)" y="([^\"]+)"/g)]
    const position = (code) => {
      const rect = rects.find((match) => match[1] === code)
      return rect && [Number(rect[2]), Number(rect[3])]
    }

    expect(rects).toHaveLength(104)
    expect(position('Backquote')).toEqual([0.8, 13.3])
    expect(position('Digit1')).toEqual([10.8, 13.3])
    expect(position('Escape')).toEqual([0.8, 0.8])
    expect(position('F1')).toEqual([15.8, 0.8])
    expect(position('F4')).toEqual([45.8, 0.8])
    expect(position('F5')).toEqual([60.8, 0.8])
    expect(position('F8')).toEqual([90.8, 0.8])
    expect(position('F9')).toEqual([105.8, 0.8])
    expect(position('F12')).toEqual([135.8, 0.8])
    expect(position('PrintScreen')).toEqual([165.8, 0.8])
    expect(position('ScrollLock')).toEqual([175.8, 0.8])
    expect(position('Pause')).toEqual([185.8, 0.8])
  })

  it('maps the 75% number row, right navigation column, and arrow cluster to their drawn positions', () => {
    const svg = kbSVG('75')
    const rects = [...svg.matchAll(/<rect class="k[^>]*data-key-id="([^\"]+)"[^>]*x="([^\"]+)" y="([^\"]+)"/g)]
    const position = (code) => {
      const rect = rects.find((match) => match[1] === code)
      return rect && [Number(rect[2]), Number(rect[3])]
    }

    expect(rects).toHaveLength(84)
    expect(position('Backquote')).toEqual([0.8, 13.3])
    expect(position('Digit1')).toEqual([10.8, 13.3])
    expect(position('Insert')).toEqual([130.8, 0.8])
    expect(position('PrintScreen')).toEqual([140.8, 0.8])
    expect(position('Delete')).toEqual([150.8, 0.8])
    expect(position('PageUp')).toEqual([150.8, 13.3])
    expect(position('PageDown')).toEqual([150.8, 23.3])
    expect(position('Home')).toEqual([150.8, 33.3])
    expect(position('ArrowUp')).toEqual([140.8, 43.3])
    expect(position('End')).toEqual([150.8, 43.3])
    expect(position('ArrowLeft')).toEqual([130.8, 53.3])
    expect(position('ArrowDown')).toEqual([140.8, 53.3])
    expect(position('ArrowRight')).toEqual([150.8, 53.3])
  })

  it('whitelists the layout before producing SVG markup', () => {
    expect(kbSVG('75" onload="alert(1)')).toBe(kbSVG('75'))
  })
})
