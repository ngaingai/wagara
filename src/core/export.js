// Pattern-agnostic export pipeline: SVG document assembly + PNG rasterization.
// It operates on whatever geometry the active generator emits ({ defs, body })
// and the shared controls. No pattern-specific logic lives here.

import { f, escapeAttr } from './svg.js'

// Output dimensions after a 90°-increment canvas rotation: 90°/270° swap W↔H,
// 0°/180° keep them. The rest of the app sizes previews + PNGs from this.
export function outputSize(shared) {
  const rot = (((shared.rotation || 0) % 360) + 360) % 360
  return rot === 90 || rot === 270 ? { W: shared.H, H: shared.W } : { W: shared.W, H: shared.H }
}

// Group transform that rotates the W×H canvas clockwise by rot° into the
// (already swapped) output box, then translates it back into view.
function rotateTransform(rot, W, H) {
  if (rot === 90) return `translate(${f(H)}, 0) rotate(90)`
  if (rot === 180) return `translate(${f(W)}, ${f(H)}) rotate(180)`
  if (rot === 270) return `translate(0, ${f(W)}) rotate(270)`
  return ''
}

// Wrap a generator's geometry in a standalone, editable SVG document.
// `geom` = { defs?: string, body: string }. Shared owns dimensions + background.
export function buildDocument(shared, geom) {
  const { W, H, background, transparent, outlineStrokes } = shared
  const rot = (((shared.rotation || 0) % 360) + 360) % 360
  const out = outputSize(shared)
  const bgRect =
    !transparent && background
      ? `  <rect x="0" y="0" width="${f(W)}" height="${f(H)}" fill="${escapeAttr(background)}" />\n`
      : ''

  // Nudge only the pattern; the background + border stay as the fixed frame.
  // The generator extends its field to fill the revealed edge (see seigaiha),
  // so the offset re-phases the pattern rather than leaving a blank strip.
  const ox = shared.offsetX || 0
  const oy = shared.offsetY || 0
  const bodyContent =
    ox || oy ? `  <g transform="translate(${f(ox)}, ${f(oy)})">\n${geom.body}  </g>\n` : geom.body

  let extraDefs = ''
  let content = bgRect + bodyContent
  if (shared.border) {
    const b = borderGeometry(shared)
    // Background + pattern are clipped to the border's outer shape, so a
    // circular border leaves the corners genuinely empty (transparent in PNG).
    extraDefs = `    <clipPath id="border-clip"><path d="${b.outer}" /></clipPath>\n`
    content = `  <g clip-path="url(#border-clip)">\n${content}  </g>\n${b.ring}`
  }

  // Rotate the entire canvas (background, pattern, border) as one unit.
  if (rot) content = `  <g transform="${rotateTransform(rot, W, H)}">\n${content}  </g>\n`

  const defs =
    geom.defs || extraDefs ? `  <defs>\n${geom.defs || ''}${extraDefs}  </defs>\n` : ''

  // xmlns:xlink lets generators emit xlink:href fallbacks for pre-SVG2 tools.
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${f(out.W)}" height="${f(out.H)}" viewBox="0 0 ${f(out.W)} ${f(out.H)}">
${defs}${content}</svg>`

  if (outlineStrokes) svg = outlineSvgStrokes(svg)
  return svg
}

// Border = a filled annulus (outer ring minus inner ring, evenodd), not a
// stroked rect: it passes through the outline-strokes export untouched and
// reaches Illustrator as a closed shape. `borderShape` morphs the corner
// radius from 0% (sharp rectangle) to 100% (fully circular / stadium).
function borderGeometry(shared) {
  const { W, H, borderShape, borderColor } = shared
  const t = Math.min(shared.borderThickness, Math.min(W, H) / 2)
  const r = ((borderShape ?? 0) / 100) * (Math.min(W, H) / 2)
  const outer = roundedRectPath(0, 0, W, H, r)
  const iw = W - 2 * t
  const ih = H - 2 * t
  // Inner radius shrinks with thickness so the rim has constant width.
  const inner = iw > 0 && ih > 0 ? roundedRectPath(t, t, iw, ih, Math.max(0, r - t)) : ''
  const ring = `  <path d="${outer}${inner ? ' ' + inner : ''}" fill-rule="evenodd" fill="${escapeAttr(borderColor)}" />\n`
  return { outer, ring }
}

// Rounded-rect path data with radius clamped to the half-extent; r = 0 emits
// a plain rectangle (no zero-radius arc segments).
function roundedRectPath(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  if (r === 0) {
    return `M ${f(x)} ${f(y)} H ${f(x + w)} V ${f(y + h)} H ${f(x)} Z`
  }
  const A = `A ${f(r)} ${f(r)} 0 0 1`
  // Drop zero-length edge segments (fully-round sides) to keep path data clean.
  const seg = (cmd, from, to) => (f(from) === f(to) ? '' : ` ${cmd} ${f(to)}`)
  return (
    `M ${f(x + r)} ${f(y)}${seg('H', x + r, x + w - r)} ${A} ${f(x + w)} ${f(y + r)}` +
    `${seg('V', y + r, y + h - r)} ${A} ${f(x + w - r)} ${f(y + h)}${seg('H', x + w - r, x + r)} ` +
    `${A} ${f(x)} ${f(y + h - r)}${seg('V', y + h - r, y + r)} ${A} ${f(x + r)} ${f(y)} Z`
  )
}

// Convert stroked <path> centerlines into filled outline shapes so Illustrator
// receives closed vectors instead of strokes. Reads each path's resolved
// stroke + stroke-width from itself or an ancestor, so it works for any
// pattern's nesting. Browser-only; returns the input unchanged on failure.
export function outlineSvgStrokes(svgStr) {
  if (typeof document === 'undefined') return svgStr
  const NS = 'http://www.w3.org/2000/svg'
  const measure = document.createElementNS(NS, 'svg')
  measure.style.cssText = 'position:absolute;left:-99999px;width:10px;height:10px'
  document.body.appendChild(measure)
  try {
    const doc = new DOMParser().parseFromString(svgStr, 'image/svg+xml')
    const root = doc.documentElement

    const probe = document.createElementNS(NS, 'path')
    measure.appendChild(probe)

    const resolve = (el, attr, fallback) => {
      let node = el
      while (node && node.getAttribute) {
        const v = node.getAttribute(attr)
        if (v != null && v !== '') return v
        node = node.parentNode
      }
      return fallback
    }

    root.querySelectorAll('path').forEach((p) => {
      const d = p.getAttribute('d')
      if (!d) return
      // Skip fill-only paths (e.g. seigaiha wave masks): they're already closed
      // shapes, not strokes, and offsetting them would wreck the geometry.
      const color = resolve(p, 'stroke', null)
      if (!color || color === 'none') return
      const sw = parseFloat(resolve(p, 'stroke-width', '1'))
      const outline = outlinePathData(d, sw / 2, probe)
      if (!outline) return
      p.setAttribute('d', outline)
      p.setAttribute('fill', color)
      p.setAttribute('stroke', 'none')
      p.removeAttribute('stroke-width')
    })

    // Demote stroke styling on container groups/patterns to a fill.
    root.querySelectorAll('[stroke]').forEach((g) => {
      if (g.tagName.toLowerCase() === 'path') return
      g.removeAttribute('stroke')
      g.removeAttribute('stroke-width')
      g.removeAttribute('stroke-linecap')
      g.removeAttribute('stroke-linejoin')
      g.removeAttribute('fill')
    })

    return new XMLSerializer().serializeToString(doc)
  } catch {
    return svgStr
  } finally {
    measure.remove()
  }
}

// Sample one open path into a polyline and build a closed outline polygon
// offset by `half` on each side, with round caps at both ends.
function outlinePathData(d, half, probe) {
  probe.setAttribute('d', d)
  const total = probe.getTotalLength()
  if (!total || !isFinite(total)) return null

  const step = Math.max(0.75, total / 600)
  const pts = []
  for (let s = 0; s <= total; s += step) {
    const { x, y } = probe.getPointAtLength(Math.min(s, total))
    pts.push([x, y])
  }
  if (pts.length < 2) return null

  const norm = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    let tx = b[0] - a[0]
    let ty = b[1] - a[1]
    const len = Math.hypot(tx, ty) || 1
    return [-ty / len, tx / len]
  })

  const left = pts.map((p, i) => [p[0] + norm[i][0] * half, p[1] + norm[i][1] * half])
  const right = pts.map((p, i) => [p[0] - norm[i][0] * half, p[1] - norm[i][1] * half])
  const M = (p) => `${f(p[0])} ${f(p[1])}`

  let out = `M ${M(left[0])}`
  for (let i = 1; i < left.length; i++) out += ` L ${M(left[i])}`
  out += ` A ${f(half)} ${f(half)} 0 0 1 ${M(right[right.length - 1])}`
  for (let i = right.length - 2; i >= 0; i--) out += ` L ${M(right[i])}`
  out += ` A ${f(half)} ${f(half)} 0 0 1 ${M(left[0])} Z`
  return out
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

export function downloadSvg(svgStr, filename = 'wagara.svg') {
  const blob = new Blob([svgStr], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadPng(svgStr, W, H, scale = 2, filename = 'wagara.png') {
  const blob = new Blob([svgStr], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  try {
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = () => rej(new Error('Failed to rasterize SVG'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(W * scale)
    canvas.height = Math.round(H * scale)
    // Transparent by default: no fillRect. drawImage scales the vector crisply.
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    await new Promise((res, rej) => {
      canvas.toBlob((b) => {
        if (!b) return rej(new Error('PNG encode failed'))
        const a = document.createElement('a')
        a.href = URL.createObjectURL(b)
        a.download = filename
        a.click()
        URL.revokeObjectURL(a.href)
        res()
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Generic (pattern-independent) raster-size guard.
export const MAX_CANVAS_PX = 16000
export function pngWarning(shared) {
  const w = shared.W * shared.pngScale
  const h = shared.H * shared.pngScale
  if (w > MAX_CANVAS_PX || h > MAX_CANVAS_PX) {
    return `PNG output ${w}×${h}px exceeds the ~${MAX_CANVAS_PX}px browser canvas limit and may fail. Lower canvas size or PNG scale.`
  }
  return null
}
