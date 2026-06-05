// Pure seigaiha geometry. No DOM, no shared-control knowledge — just numbers
// in, SVG path-data strings out.

import { f } from '../../core/svg.js'

const rad = (d) => (d * Math.PI) / 180
const pt = (cx, cy, r, deg) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))]

// R for pattern mode, with the spec's minimum clamp so high density never
// collapses the field to a solid block.
export function patternR(W, density) {
  return Math.max(8, Math.round(W / (2 * Math.max(1, density))))
}

// Visible-only seigaiha pattern tile: each concentric arc is trimmed
// analytically to the angular spans NOT hidden behind a front (lower-row) scale,
// so the tile is just the line-work you actually see — no fills, no buried
// segments, transparent between the strokes on export. Order-independent and
// seam-safe: with no plates and no draw order there's no masking seam to break
// at the tile boundary.
//
// rowStep is the vertical distance between rows as set by the caller. At
// rowStep === R the lower peaks only touch the upper baseline; rowStep < R makes
// them rise into the row above so the scallops interlock. Horizontal period
// stays 2R; vertical period is two staggered rows = 2 * rowStep (the tile height).
//
// An arc point at angle θ on circle (cx,cy,r) is hidden by a front scale
// (ocx,ocy,R) exactly when cos(θ - α) < T, with α = atan2(cy-ocy, cx-ocx) and
// T = (R² - dist² - r²)/(2·r·dist). Only lower rows (ocy > cy) can occlude, and
// only the occluder's outer circle matters: every back-arc point sits at
// y ≤ cy < ocy, above the front baseline, so the below-baseline strip never
// participates.
export function buildTrimmedTilePaths(R, n, rowStep = R) {
  const TWO_PI = Math.PI * 2
  const span = Math.ceil(R / rowStep) + 1

  const centers = []
  for (let row = -span - 1; row <= span + 3; row++) {
    const cy = row * rowStep
    const xOffset = Math.abs(row) % 2 === 0 ? 0 : R
    for (let k = -1; k <= 2; k++) centers.push([xOffset + k * 2 * R, cy])
  }

  // front scales (lower rows) whose outer circle can cut an arc of radius r at (cx,cy)
  const occludersOf = (cx, cy, r) => {
    const occ = []
    for (const [ocx, ocy] of centers) {
      if (ocy <= cy) continue
      const dx = cx - ocx
      const dy = cy - ocy
      const dist = Math.hypot(dx, dy)
      if (dist <= 0 || dist >= R + r) continue
      occ.push({ alpha: Math.atan2(dy, dx), T: (R * R - dist * dist - r * r) / (2 * r * dist) })
    }
    return occ
  }

  // sub-intervals of the upper semicircle [PI, 2PI] left visible after every occluder
  const visibleSpans = (cx, cy, r) => {
    const occ = occludersOf(cx, cy, r)
    const crit = new Set([Math.PI, TWO_PI])
    for (const { alpha, T } of occ) {
      if (T > -1 && T < 1) {
        const beta = Math.acos(T)
        for (let k = -1; k <= 2; k++) {
          for (const s of [1, -1]) {
            const a = alpha + s * beta + TWO_PI * k
            if (a >= Math.PI - 1e-9 && a <= TWO_PI + 1e-9) crit.add(Math.min(Math.max(a, Math.PI), TWO_PI))
          }
        }
      }
    }
    const cs = [...crit].sort((p, q) => p - q)
    const spans = []
    for (let j = 0; j < cs.length - 1; j++) {
      const a = cs[j]
      const b = cs[j + 1]
      if (b - a < 1e-6) continue
      const mid = 0.5 * (a + b)
      const visible = occ.every(({ alpha, T }) => !(Math.cos(mid - alpha) < T))
      if (visible) {
        if (spans.length && Math.abs(spans[spans.length - 1][1] - a) < 1e-6) spans[spans.length - 1][1] = b
        else spans.push([a, b])
      }
    }
    return spans
  }

  const paths = []
  for (const [cx, cy] of centers) {
    for (let i = 1; i <= n; i++) {
      const r = (R * i) / n
      for (const [a, b] of visibleSpans(cx, cy, r)) {
        const sx = cx + r * Math.cos(a)
        const sy = cy + r * Math.sin(a)
        const ex = cx + r * Math.cos(b)
        const ey = cy + r * Math.sin(b)
        const large = b - a > Math.PI ? 1 : 0
        paths.push(`M ${f(sx)} ${f(sy)} A ${f(r)} ${f(r)} 0 ${large} 1 ${f(ex)} ${f(ey)}`)
      }
    }
  }
  return paths
}

// One fan ring. straighten: null | { dir:'up'|'down', toEdge:bool, length, H }
export function ringPath(cx, cy, r, startDeg, endDeg, straighten) {
  const [sx, sy] = pt(cx, cy, r, startDeg)

  let sweep = (((endDeg - startDeg) % 360) + 360) % 360
  let eDeg = endDeg
  // endAngle == startAngle: render an (almost) full ring rather than a
  // degenerate zero-length arc.
  if (sweep === 0) {
    eDeg = startDeg + 359.99
    sweep = 359.99
  }
  const [ex, ey] = pt(cx, cy, r, eDeg)
  const largeArc = sweep > 180 ? 1 : 0
  let d = `M ${f(sx)} ${f(sy)} A ${f(r)} ${f(r)} 0 ${largeArc} 1 ${f(ex)} ${f(ey)}`

  if (straighten) {
    // Foolproof vertical bar from the arc end point. Intended for endAngle
    // 0/360 (3 o'clock) where the tangent is vertical and the join stays smooth.
    let ty
    if (straighten.toEdge) {
      ty = straighten.dir === 'up' ? 0 : straighten.H
    } else {
      ty = straighten.dir === 'up' ? ey - straighten.length : ey + straighten.length
    }
    d += ` L ${f(ex)} ${f(ty)}`
  }
  return d
}
