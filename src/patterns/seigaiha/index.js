// Seigaiha (青海波) pattern module — the first registered wagara pattern.
// It carries two sub-modes of its own (a seamless tile + a positioned fan),
// but to the rest of the app it's just one generator behind the uniform
// interface described in core/registry.js.

import { strokeAttrs, f, escapeAttr } from '../../core/svg.js'
import { patternR, buildTileScales, ringPath } from './geometry.js'

function defaultParams() {
  return {
    mode: 'fan', // 'fan' | 'pattern'
    // pattern sub-mode
    density: 10,
    arcCount: 6,
    rowStep: 0.6, // vertical row step as a fraction of R; <1 overlaps, >1 gaps
    waveFill: '#ffffff', // opaque fill behind each scale's arcs (the wave body)
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
  { type: 'color', key: 'waveFill', label: 'Wave fill', when: isPattern },
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
  { type: 'checkbox', key: 'straighten', label: 'Straighten (arc tails → bars)', when: isFan },

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
    text: () => "Use end angle 360° (3 o'clock) for clean vertical bars.",
  },
]

// Build SVG geometry → { defs, body }. The export layer wraps this.
function build(params, shared) {
  const sa = strokeAttrs(shared)

  if (params.mode === 'pattern') {
    const R = patternR(shared.W, params.density)
    const n = Math.max(1, Math.round(params.arcCount))
    const rowStep = R * (params.rowStep ?? 0.6) // <R overlaps rows, =R touches, >R gaps
    const maskFill = escapeAttr(params.waveFill ?? '#ffffff')
    // Each scale paints its opaque mask, then its arcs on top; array order is
    // back-to-front, so a front scale's fill hides the arc tails behind it.
    const inner = buildTileScales(R, n, rowStep)
      .map(({ mask, arcs }) => {
        const fill = `        <path d="${mask}" fill="${maskFill}" stroke="none" />`
        const strokes = arcs.map((d) => `          <path d="${d}" />`).join('\n')
        return `${fill}\n        <g ${sa}>\n${strokes}\n        </g>`
      })
      .join('\n')
    // Horizontal period is 2R; vertical period is two staggered rows = 2*rowStep.
    const defs = `    <pattern id="seigaiha-tile" patternUnits="userSpaceOnUse" width="${f(2 * R)}" height="${f(2 * rowStep)}">
${inner}
    </pattern>\n`
    const body = `  <rect x="0" y="0" width="${f(shared.W)}" height="${f(shared.H)}" fill="url(#seigaiha-tile)" />\n`
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

  const rings = []
  for (let i = 1; i <= N; i++) {
    const r = params.r0 + (i - 1) * params.gap
    if (r <= 0) continue
    const d = ringPath(params.cx, params.cy, r, params.startAngle, params.endAngle, straighten)
    rings.push(`      <g class="ring" data-ring="${i}">\n        <path d="${d}" />\n      </g>`)
  }
  const rotate = params.rotation
    ? ` transform="rotate(${f(params.rotation)} ${f(params.cx)} ${f(params.cy)})"`
    : ''
  const body = `  <g id="seigaiha-fan"${rotate} ${sa}>\n${rings.join('\n')}\n  </g>\n`
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
    label: 'Wave Tail',
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
