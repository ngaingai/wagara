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

// Visible-only seigaiha line-work for ONE canonical scale at the origin: each
// concentric arc is trimmed analytically to the angular spans NOT hidden
// behind a front (lower-row) scale, so the result is just the line-work you
// actually see — no fills, no buried segments, transparent between the strokes
// on export.
//
// The scale lattice {(2Rk + (j mod 2)·R, j·rowStep)} maps onto itself under
// the glide translation (R, rowStep) as well as the tile periods (2R, 0) and
// (0, 2·rowStep). Every scale — either stagger class — therefore sees an
// identical occlusion neighbourhood and shows identical visible spans, so the
// tile needs this computed exactly once; tileUsePositions() lists the lattice
// translates to stamp it at. Identical stamps also make the tiling trivially
// seam-safe: there is no draw order or masking to break at the tile boundary.
//
// rowStep is the vertical distance between rows as set by the caller. At
// rowStep === R the lower peaks only touch the upper baseline; rowStep < R makes
// them rise into the row above so the scallops interlock.
//
// An arc point at angle θ on the radius-r circle about the origin is hidden by
// a front scale (ox,oy,R) exactly when cos(θ - α) < T, with α = atan2(-oy,-ox)
// and T = (R² - dist² - r²)/(2·r·dist). Only lower rows (oy > 0) can occlude,
// and only the occluder's outer circle matters: every back-arc point sits at
// y ≤ 0 < oy, above the front baseline, so the below-baseline strip never
// participates. A front scale whose top (oy − R) is below the baseline hides
// nothing, which bounds the occluder rows; dist < 2R bounds the columns. The
// enumeration below is slightly generous and lets the span math discard the rest.
export function buildScalePaths(R, n, rowStep = R) {
  const TWO_PI = Math.PI * 2

  const occluders = []
  const maxRow = Math.ceil(R / rowStep) + 1
  for (let j = 1; j <= maxRow; j++) {
    const oy = j * rowStep
    const xOffset = j % 2 === 0 ? 0 : R
    for (let k = -2; k <= 2; k++) {
      const ox = xOffset + k * 2 * R
      const dist = Math.hypot(ox, oy)
      if (dist > 0 && dist < 2 * R) occluders.push({ ox, oy, dist })
    }
  }

  // sub-intervals of the upper semicircle [PI, 2PI] left visible after every occluder
  const visibleSpans = (r) => {
    const occ = []
    for (const { ox, oy, dist } of occluders) {
      if (dist >= R + r) continue
      occ.push({ alpha: Math.atan2(-oy, -ox), T: (R * R - dist * dist - r * r) / (2 * r * dist) })
    }
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
  for (let i = 1; i <= n; i++) {
    const r = (R * i) / n
    for (const [a, b] of visibleSpans(r)) {
      const sx = r * Math.cos(a)
      const sy = r * Math.sin(a)
      const ex = r * Math.cos(b)
      const ey = r * Math.sin(b)
      const large = b - a > Math.PI ? 1 : 0
      paths.push(`M ${f(sx)} ${f(sy)} A ${f(r)} ${f(r)} 0 ${large} 1 ${f(ex)} ${f(ey)}`)
    }
  }
  return paths
}

// Lattice translates whose scale can paint inside the tile [0,2R] × [0,2·rowStep].
// A scale's ink occupies [x−R, x+R] × [y−R, y] grown by `pad` (half the stroke
// width, which also covers the round caps). The <pattern> clips its tile, so a
// copy that merely crosses a tile edge must still be stamped — its cut-off
// remainder reappears from the equivalent copy at the opposite edge, keeping
// the tiling seamless.
export function tileUsePositions(R, rowStep, pad = 0) {
  const tileW = 2 * R
  const tileH = 2 * rowStep
  const out = []
  const jMin = Math.ceil(-pad / rowStep) // cy + pad ≥ 0
  const jMax = Math.floor((tileH + R + pad) / rowStep) // cy − R − pad ≤ tileH
  for (let j = jMin; j <= jMax; j++) {
    const xOffset = j % 2 === 0 ? 0 : R
    const kMin = Math.ceil((-(R + pad) - xOffset) / (2 * R)) // cx + R + pad ≥ 0
    const kMax = Math.floor((tileW + R + pad - xOffset) / (2 * R)) // cx − R − pad ≤ tileW
    for (let k = kMin; k <= kMax; k++) out.push([xOffset + k * 2 * R, j * rowStep])
  }
  return out
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
