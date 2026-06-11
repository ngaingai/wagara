// Seigaiha (青海波) pattern module — the first registered wagara pattern.
// It carries two sub-modes of its own (a seamless tile + a positioned fan),
// but to the rest of the app it's just one generator behind the uniform
// interface described in core/registry.js.

import { strokeAttrs, f } from '../../core/svg.js'
import { patternR, buildScalePaths, tileUsePositions, waterfallCenter, ringPath } from './geometry.js'

function defaultParams() {
  return {
    mode: 'fan', // 'fan' | 'pattern'
    // pattern sub-mode
    density: 10,
    arcCount: 6,
    rowStep: 0.6, // vertical row step as a fraction of R; <1 overlaps, >1 gaps
    waterfall: false, // one wave (top-right-most) flows down over the field
    // fan sub-mode
    cx: 350, // 0.35 * default W
    cy: 550, // 0.55 * default H
    r0: 40,
    ringCount: 12,
    gap: 55,
    startAngle: 180,
    endAngle: 360,
    rotation: 0,
    straighten: false,
    barDirection: 'up',
    barLength: 'toEdge', // 'toEdge' | 'fixed'
    barFixedLength: 300,
  }
}

const isFan = (p) => p.mode === 'fan'
const isPattern = (p) => p.mode === 'pattern'
const whenStraight = (p) => p.mode === 'fan' && p.straighten

// Declarative pattern-specific controls. min/max may be (shared) => number.
const controls = [
  {
    type: 'toggle',
    key: 'mode',
    label: 'Seigaiha mode',
    options: [
      { value: 'fan', label: 'Fan' },
      { value: 'pattern', label: 'Pattern' },
    ],
  },

  // Pattern sub-mode
  { type: 'slider', key: 'density', label: 'Wave density', min: 2, max: 40, when: isPattern },
  { type: 'slider', key: 'arcCount', label: 'Arc count', min: 1, max: 20, when: isPattern },
  {
    type: 'slider',
    key: 'rowStep',
    label: 'Row step',
    min: 0.4,
    max: 1.2,
    step: 0.05,
    suffix: '× R',
    when: isPattern,
  },
  {
    type: 'note',
    when: isPattern,
    text: (p) =>
      p.rowStep < 1
        ? 'Rows overlap (lower peaks rise into the row above) — classic seigaiha.'
        : p.rowStep > 1
          ? 'Rows have a gap between them.'
          : 'Rows just touch (no overlap).',
  },
  {
    type: 'note',
    when: isPattern,
    text: (p, shared) =>
      `Tile ${2 * patternR(shared.W, p.density)} × ${(2 * patternR(shared.W, p.density) * p.rowStep).toFixed(0)} (period 2R × 2·rowStep)`,
  },
  {
    type: 'checkbox',
    key: 'waterfall',
    label: 'Waterfall (top-right wave flows down over the field)',
    when: isPattern,
  },

  // Fan sub-mode
  {
    type: 'row',
    when: isFan,
    children: [
      { type: 'slider', key: 'cx', label: 'Center X', min: 0, max: (s) => s.W },
      { type: 'slider', key: 'cy', label: 'Center Y', min: 0, max: (s) => s.H },
    ],
  },
  { type: 'number', key: 'r0', label: 'Inner radius', min: 0, max: (s) => s.W, when: isFan },
  { type: 'slider', key: 'ringCount', label: 'Ring count', min: 1, max: 40, when: isFan },
  { type: 'slider', key: 'gap', label: 'Ring spacing', min: 2, max: 200, when: isFan },
  { type: 'slider', key: 'startAngle', label: 'Start angle', min: 0, max: 360, suffix: '°', when: isFan },
  { type: 'slider', key: 'endAngle', label: 'End angle', min: 0, max: 360, suffix: '°', when: isFan },
  { type: 'slider', key: 'rotation', label: 'Rotation', min: 0, max: 360, suffix: '°', when: isFan },
  { type: 'checkbox', key: 'straighten', label: 'Waterfall (straighten arc tails into bars)', when: isFan },

  {
    type: 'toggle',
    key: 'barDirection',
    label: 'Bar direction',
    options: [
      { value: 'up', label: 'Up' },
      { value: 'down', label: 'Down' },
    ],
    when: whenStraight,
  },
  {
    type: 'toggle',
    key: 'barLength',
    label: 'Bar length',
    options: [
      { value: 'toEdge', label: 'To edge' },
      { value: 'fixed', label: 'Fixed' },
    ],
    when: whenStraight,
  },
  {
    type: 'number',
    key: 'barFixedLength',
    label: 'Bar length (px)',
    min: 1,
    max: 4000,
    when: (p) => whenStraight(p) && p.barLength === 'fixed',
  },
  {
    type: 'note',
    when: whenStraight,
    text: (p) => {
      const eff = (((p.endAngle + p.rotation) % 360) + 360) % 360
      return eff === 0
        ? "Arc tails meet the bars smoothly (end angle + rotation lands at 3 o'clock)."
        : `For smooth joins, end angle + rotation should land on 0/360° — currently ${eff}°.`
    },
  },
]

// Build SVG geometry → { defs, body }. The export layer wraps this.
function build(params, shared) {
  const sa = strokeAttrs(shared)

  if (params.mode === 'pattern') {
    const R = patternR(shared.W, params.density)
    const n = Math.max(1, Math.round(params.arcCount))
    const rowStep = R * (params.rowStep ?? 0.6) // <R overlaps rows, =R touches, >R gaps

    // Every scale in the lattice shows identical visible spans (glide
    // invariance — see geometry.js), so the trimmed line-work is computed once
    // for a canonical scale and stamped across the tile with <use> translates.
    // xlink:href duplicates href for pre-SVG2 tools (older Illustrator/Inkscape).
    const arcs = buildScalePaths(R, n, rowStep)
      .map((d) => `      <path d="${d}" />`)
      .join('\n')
    const uses = tileUsePositions(R, rowStep, shared.lineThickness / 2)
      .map(([x, y]) => `      <use href="#seigaiha-scale" xlink:href="#seigaiha-scale" x="${f(x)}" y="${f(y)}" />`)
      .join('\n')

    // Horizontal period is 2R; vertical period is two staggered rows = 2*rowStep.
    const defs = `    <g id="seigaiha-scale" ${sa}>
${arcs}
    </g>
    <pattern id="seigaiha-tile" patternUnits="userSpaceOnUse" width="${f(2 * R)}" height="${f(2 * rowStep)}">
${uses}
    </pattern>\n`
    let body = `  <rect x="0" y="0" width="${f(shared.W)}" height="${f(shared.H)}" fill="url(#seigaiha-tile)" />\n`

    // Waterfall: one wave redrawn whole in front of the field, its arcs
    // continuing as vertical falls to the bottom edge. Painted after the
    // pattern rect so it flows over the rows below it.
    if (params.waterfall) {
      const [wx, wy] = waterfallCenter(R, rowStep, shared.W)
      const straighten = { dir: 'down', toEdge: true, length: 0, H: shared.H }
      const falls = []
      for (let i = 1; i <= n; i++) {
        const d = ringPath(wx, wy, (R * i) / n, 180, 360, straighten)
        falls.push(`      <path d="${d}" />`)
      }
      body += `  <g id="seigaiha-waterfall" ${sa}>\n${falls.join('\n')}\n  </g>\n`
    }
    return { defs, body }
  }

  // Fan
  const N = Math.max(1, Math.round(params.ringCount))
  const straighten = params.straighten
    ? {
        dir: params.barDirection || 'up',
        toEdge: params.barLength !== 'fixed',
        length: params.barFixedLength ?? 300,
        H: shared.H,
      }
    : null

  // Rotation folds into the sweep angles: rotating concentric arcs about their
  // shared center IS an angle shift. A group rotate would also tilt the
  // straighten bars and break their to-edge length — these are canvas-space
  // verticals and must stay out of any rotated frame.
  const rot = params.rotation || 0
  const rings = []
  for (let i = 1; i <= N; i++) {
    const r = params.r0 + (i - 1) * params.gap
    if (r <= 0) continue
    const d = ringPath(params.cx, params.cy, r, params.startAngle + rot, params.endAngle + rot, straighten)
    rings.push(`      <g class="ring" data-ring="${i}">\n        <path d="${d}" />\n      </g>`)
  }
  const body = `  <g id="seigaiha-fan" ${sa}>\n${rings.join('\n')}\n  </g>\n`
  return { defs: '', body }
}

// Pattern-specific warnings (stroke vs spacing). Generic raster warnings live
// in the export layer.
function warnings(params, shared) {
  const out = []
  if (params.mode === 'pattern') {
    const R = patternR(shared.W, params.density)
    const n = Math.max(1, Math.round(params.arcCount))
    const spacing = R / n
    if (shared.lineThickness > 0.8 * spacing) {
      out.push(
        `Line thickness (${shared.lineThickness}) is high for the arc spacing (${spacing.toFixed(1)}); arcs may merge into a solid block.`,
      )
    }
  } else if (shared.lineThickness > 0.8 * params.gap) {
    out.push(
      `Line thickness (${shared.lineThickness}) is high for the ring spacing (${params.gap}); rings may merge into a solid block.`,
    )
  }
  return out
}

// Random params within sane ranges, for the Randomize button.
function randomize(params, shared) {
  const r = (min, max) => min + Math.random() * (max - min)
  const ri = (min, max) => Math.round(r(min, max))
  if (params.mode === 'pattern') {
    return { ...params, density: ri(4, 24), arcCount: ri(2, 12) }
  }
  return {
    ...params,
    cx: ri(0.2 * shared.W, 0.8 * shared.W),
    cy: ri(0.45 * shared.H, 0.85 * shared.H),
    r0: ri(20, 120),
    ringCount: ri(5, 24),
    gap: ri(28, 90),
    startAngle: 180,
    endAngle: 360,
    rotation: ri(0, 359),
    straighten: Math.random() < 0.5,
    barDirection: Math.random() < 0.5 ? 'up' : 'down',
    barLength: 'toEdge',
  }
}

const presets = [
  {
    label: 'Plain Fan',
    shared: { W: 1000, H: 1000, transparent: true, stroke: '#000000', lineThickness: 8, pngScale: 2 },
    params: {
      mode: 'fan',
      cx: 500,
      cy: 660,
      r0: 40,
      ringCount: 12,
      gap: 52,
      startAngle: 180,
      endAngle: 360,
      rotation: 0,
      straighten: false,
    },
  },
  {
    label: 'Waterfall',
    shared: { W: 1000, H: 1000, transparent: true, stroke: '#000000', lineThickness: 8, pngScale: 2 },
    params: {
      mode: 'fan',
      cx: 480,
      cy: 700,
      r0: 50,
      ringCount: 10,
      gap: 58,
      startAngle: 180,
      endAngle: 360,
      rotation: 0,
      straighten: true,
      barDirection: 'down',
      barLength: 'toEdge',
    },
  },
]

export default {
  id: 'seigaiha',
  label: 'Seigaiha',
  defaultParams,
  controls,
  presets,
  build,
  warnings,
  randomize,
}
