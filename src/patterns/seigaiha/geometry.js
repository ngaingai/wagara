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

// Concentric-arc paths for one 2R x 2R pattern tile. Centers drawn for a
// neighborhood so arcs crossing the tile edge are present; the pattern box
// clips the overflow, which is what makes the repeat seamless.
export function buildTilePaths(R, n) {
  const paths = []
  for (let row = -1; row <= 2; row++) {
    const cy = row * R
    const xOffset = Math.abs(row) % 2 === 0 ? 0 : R // stagger odd rows
    for (let k = -1; k <= 2; k++) {
      const cx = xOffset + k * 2 * R
      for (let i = 1; i <= n; i++) {
        const r = (R * i) / n
        // upper semicircle, left to right, bulging up (smaller y)
        paths.push(`M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 0 1 ${f(cx + r)} ${f(cy)}`)
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
