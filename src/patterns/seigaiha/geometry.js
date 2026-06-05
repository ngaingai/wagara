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

// Ordered scales for one 2R x (2*rowStep) pattern tile. Each scale carries an
// opaque mask (the filled scale body) plus its concentric arc paths. Scales are
// returned back-to-front (top rows first, bottom rows last) so painting them in
// order lets each front scale's fill cover the overlapping arc tails of the
// scale behind it — the masking that makes overlapped seigaiha look clean.
//
// rowStep is the vertical distance between rows. At rowStep === R the lower
// peaks only *touch* the upper baseline; rowStep < R makes them rise into the
// row above so the scallops interlock. Horizontal period stays 2R; vertical
// period is two staggered rows = 2 * rowStep (the caller's tile height).
//
// The mask extends below the baseline by d = max(0, 2*rowStep - R): the height
// of the centre valley (the crown of the scale two rows down sitting below the
// baseline). Pushing the flat bottom down by exactly d closes it. Below
// rowStep = R/2 the deeper rows already overlap past the baseline, so d == 0.
export function buildTileScales(R, n, rowStep = R) {
  const d = Math.max(0, 2 * rowStep - R)
  const span = Math.ceil(R / rowStep) + 1 // rows above/below that reach into the tile
  const scales = []
  for (let row = -span - 1; row <= span + 3; row++) {
    const cy = row * rowStep
    const xOffset = Math.abs(row) % 2 === 0 ? 0 : R // stagger odd rows
    for (let k = -1; k <= 2; k++) {
      const cx = xOffset + k * 2 * R
      // mask: outer arc, then down past the baseline by d, flat bottom, close
      const mask =
        `M ${f(cx - R)} ${f(cy)} A ${f(R)} ${f(R)} 0 0 1 ${f(cx + R)} ${f(cy)} ` +
        `L ${f(cx + R)} ${f(cy + d)} L ${f(cx - R)} ${f(cy + d)} Z`
      const arcs = []
      for (let i = 1; i <= n; i++) {
        const r = (R * i) / n
        // upper semicircle, left to right, bulging up (smaller y)
        arcs.push(`M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 0 1 ${f(cx + r)} ${f(cy)}`)
      }
      scales.push({ mask, arcs })
    }
  }
  return scales
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
