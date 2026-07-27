// Seigaiha (青海波) pattern module — the first registered wagara pattern.
// It carries two sub-modes of its own (a seamless tile + a positioned fan),
// but to the rest of the app it's just one generator behind the uniform
// interface described in core/registry.js.

import { strokeAttrs, f, escapeAttr } from '../../core/svg.js'
import { patternR, lockedR, buildScalePaths, tileUsePositions, waterfallCenter, waterfallPaths, ringPath } from './geometry.js'

function defaultParams() {
  return {
    mode: 'pattern', // 'fan' | 'pattern'
    // pattern sub-mode
    density: 3,
    lockWaveSize: false, // pin R in px so a wider canvas adds waves, not size
    waveSize: 167, // R in px when locked; 167 = patternR(1000, 3), the default
    arcCount: 6,
    rowStep: 0.5, // vertical row step as a fraction of R; <1 overlaps, >1 gaps
    waveRotation: 0, // free rotation of the wave field only; waterfall stays vertical
    waterfall: false, // one wave (top-right-most) flows down over the field
    hideRight: false, // fill everything right of the waterfall with the background
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

// The one place pattern-mode R is decided: scaled to the canvas width by
// density, or pinned in px when locked. Everything downstream (tile, waterfall,
// warnings, notes) reads R from here so the two modes can't drift apart.
const waveRadius = (p, shared) => (p.lockWaveSize ? lockedR(p.waveSize) : patternR(shared.W, p.density))

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

  // Pattern sub-mode. Wave size is set either by density (waves across the
  // canvas width) or, when locked, directly in px — see waveRadius.
  {
    type: 'slider',
    key: 'density',
    label: 'Wave density',
    min: 2,
    max: 40,
    when: (p) => isPattern(p) && !p.lockWaveSize,
  },
  {
    type: 'checkbox',
    key: 'lockWaveSize',
    label: 'Lock wave size (a wider canvas adds waves instead of enlarging them)',
    // Seed the px value from the density-derived R so ticking the box doesn't
    // jump the design — it just freezes what's already on screen.
    onEnable: (p, shared) => ({ waveSize: patternR(shared.W, p.density) }),
    when: isPattern,
  },
  {
    type: 'slider',
    key: 'waveSize',
    label: 'Wave size (radius)',
    min: 8,
    max: (s) => Math.max(100, Math.round(s.W / 2)),
    step: 1,
    suffix: 'px',
    when: (p) => isPattern(p) && p.lockWaveSize,
  },
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
    text: (p, shared) => {
      const R = waveRadius(p, shared)
      const across = Math.round((shared.W / (2 * R)) * 10) / 10
      return `Tile ${2 * R} × ${(2 * R * p.rowStep).toFixed(0)} (period 2R × 2·rowStep) — R ${R}px, ${across} waves across.`
    },
  },
  {
    type: 'slider',
    key: 'waveRotation',
    label: 'Wave rotation (free)',
    min: 0,
    max: 360,
    step: 1,
    suffix: '°',
    when: isPattern,
  },
  {
    type: 'note',
    when: (p) => isPattern(p) && p.waveRotation && p.waterfall,
    text: () => 'The wave field spins freely; the waterfall stays vertical. Use the shared 90° buttons to turn the whole canvas.',
  },
  {
    type: 'checkbox',
    key: 'waterfall',
    label: 'Waterfall (top-right wave flows down over the field)',
    when: isPattern,
  },
  {
    type: 'checkbox',
    key: 'hideRight',
    label: 'Hide waves to the right of the waterfall',
    when: (p) => isPattern(p) && p.waterfall,
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
    const R = waveRadius(params, shared)
    const n = Math.max(1, Math.round(params.arcCount))
    const rowStep = R * (params.rowStep ?? 0.6) // <R overlaps rows, =R touches, >R gaps
    // The whole body is shifted by offsetX/offsetY in export.js, so in this
    // local frame the canvas sits at [-ox, W-ox] × [-oy, H-oy]. Extend the field
    // (and the waterfall's hide-right blank) to the union of that with the
    // unnudged canvas, so the tiling keeps filling whichever edge the nudge
    // reveals instead of leaving a blank strip — the nudge just re-phases the
    // pattern, e.g. so a previously-clipped top wave drops fully into view.
    // Taking min/max rather than assuming a sign is what lets the offsets go
    // negative (nudge left) without dragging the field off the opposite edge.
    const ox = shared.offsetX || 0
    const oy = shared.offsetY || 0
    const fx = Math.min(0, -ox) // field left  (local)
    const fy = Math.min(0, -oy) // field top   (local)
    const fr = Math.max(shared.W, shared.W - ox) // field right
    const fb = Math.max(shared.H, shared.H - oy) // field bottom
    // Free rotation of the wave field only. Rotate the tile grid via
    // patternTransform about the waterfall centre (wx, wy) — a lattice scale
    // centre — so that scale stays put while the field turns around it. The
    // waterfall crest, built from the same occlusion spans and rotated by the
    // same angle about the same point, then blends seamlessly into the field;
    // only the vertical falls stay locked. (No waterfall → any centre looks the
    // same, since the tiling is infinite.)
    const wr = (((params.waveRotation || 0) % 360) + 360) % 360
    const [wx, wy] = waterfallCenter(R, rowStep, shared.W)
    const patternRot = wr ? ` patternTransform="rotate(${f(wr)}, ${f(wx)}, ${f(wy)})"` : ''

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
    <pattern id="seigaiha-tile" patternUnits="userSpaceOnUse"${patternRot} width="${f(2 * R)}" height="${f(2 * rowStep)}">
${uses}
    </pattern>\n`
    let body = `  <rect x="${f(fx)}" y="${f(fy)}" width="${f(fr - fx)}" height="${f(fb - fy)}" fill="url(#seigaiha-tile)" />\n`

    // Waterfall: one wave redrawn in front of the field, its arcs continuing as
    // vertical falls to the bottom edge. Painted after the pattern rect so it
    // flows over the rows below it. The crest is trimmed to the field's visible
    // spans so it blends in (no overlap onto neighbours); a background-filled
    // silhouette behind the falls hides the field so the column reads as solid.
    if (params.waterfall) {
      // The crest turns with the field (see waterfallPaths); the falls stay
      // vertical. wx, wy computed above (the field's rotation centre).
      // Falls run to the field bottom, not shared.H, so a nudge up doesn't
      // leave them ending short of the canvas edge.
      const { arcs, fill } = waterfallPaths(R, n, rowStep, wx, wy, fb, wr)
      // Optionally blank the field to the right of the waterfall.
      if (params.hideRight) {
        let blank
        if (wr) {
          // Rotated: blank everything right of the inner wall (wx). The rotated
          // crest cap fill + arcs are redrawn on top, and the crest's left half
          // (x < wx) still blends into the field on the left.
          blank = `M ${f(wx)} ${f(fy)} L ${f(fr)} ${f(fy)} L ${f(fr)} ${f(fb)} L ${f(wx)} ${f(fb)} Z`
        } else {
          // Trace the upright waterfall's silhouette — up the outer wall (wx+R),
          // around the outer crest arc, then straight up the inner wall (wx).
          // That inner-wall line lands on the seam between the staggered scales
          // in the row above, so the field above the crest is cut cleanly.
          const rx = wx + R
          const ty = wy - R
          blank =
            `M ${f(wx)} ${f(fy)} L ${f(fr)} ${f(fy)} L ${f(fr)} ${f(fb)} ` +
            `L ${f(rx)} ${f(fb)} L ${f(rx)} ${f(wy)} ` +
            `A ${f(R)} ${f(R)} 0 0 0 ${f(wx)} ${f(ty)} Z`
        }
        body += `  <path d="${blank}" fill="${escapeAttr(shared.background)}" stroke="none" />\n`
      }
      const falls = arcs.map((d) => `      <path d="${d}" />`).join('\n')
      body +=
        `  <g id="seigaiha-waterfall">\n` +
        `    <path d="${fill}" fill="${escapeAttr(shared.background)}" stroke="none" />\n` +
        `    <g ${sa}>\n${falls}\n    </g>\n` +
        `  </g>\n`
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
    const R = waveRadius(params, shared)
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
