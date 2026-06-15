// The common control layer shared by every pattern. Defaults + declarative
// control schema. Patterns never redefine these; they only add their own.

// Hashi brand palette — offered as one-click swatches for stroke + background.
export const HASHI_COLORS = ['#1B2845', '#037171', '#8A8576', '#F2EBDD', '#B8693F']

export function defaultShared() {
  return {
    W: 1000,
    H: 1000,
    stroke: '#000000',
    lineThickness: 8,
    background: '#ffffff',
    transparent: false,
    offsetY: 0, // nudge the pattern down so a thick top wave/border isn't clipped
    border: false,
    borderThickness: 24,
    borderShape: 100, // corner roundness %: 0 = sharp rectangle, 100 = fully circular
    borderColor: '#000000',
    pngScale: 2,
    outlineStrokes: false,
  }
}

// Control schema is declarative so the UI plumbing can render it generically.
// `min`/`max` may be numbers or (shared) => number.
export const sharedControls = [
  { type: 'slider', key: 'lineThickness', label: 'Line thickness', min: 0.5, max: 24, step: 0.5, suffix: 'px' },
  { type: 'color', key: 'stroke', label: 'Stroke color' },
  { type: 'swatches', key: 'stroke', colors: HASHI_COLORS },
  { type: 'background', key: 'background', label: 'Background' }, // color + transparent checkbox
  // Picking a brand background also clears transparency so the colour shows.
  { type: 'swatches', key: 'background', colors: HASHI_COLORS, alsoSet: { transparent: false } },
  { type: 'checkbox', key: 'border', label: 'Border (clips the pattern to its shape)' },
  {
    type: 'slider',
    key: 'borderThickness',
    label: 'Border thickness',
    min: 1,
    max: (s) => Math.floor(Math.min(s.W, s.H) / 4),
    step: 1,
    suffix: 'px',
    when: (v) => v.border,
  },
  {
    type: 'slider',
    key: 'borderShape',
    label: 'Border shape',
    min: 0,
    max: 100,
    step: 1,
    suffix: '%',
    when: (v) => v.border,
  },
  {
    type: 'note',
    when: (v) => v.border,
    text: (v) =>
      v.borderShape === 0
        ? 'Sharp rectangular border.'
        : v.borderShape === 100
          ? 'Fully circular border (a stadium shape if the canvas is not square).'
          : `Rounded corners at ${v.borderShape}% of the maximum radius.`,
  },
  { type: 'color', key: 'borderColor', label: 'Border color', when: (v) => v.border },
  {
    type: 'swatches',
    key: 'borderColor',
    label: 'Match border to',
    from: [
      { label: 'Background', key: 'background' },
      { label: 'Stroke', key: 'stroke' },
    ],
    when: (v) => v.border,
  },
  {
    type: 'row',
    children: [
      { type: 'number', key: 'W', label: 'Canvas width', min: 100, max: 4000 },
      { type: 'number', key: 'H', label: 'Canvas height', min: 100, max: 4000 },
    ],
  },
  {
    type: 'slider',
    key: 'offsetY',
    label: 'Nudge down',
    min: 0,
    max: (s) => Math.round(s.H / 2),
    step: 1,
    suffix: 'px',
  },
  { type: 'slider', key: 'pngScale', label: 'PNG scale', min: 1, max: 4, step: 1, suffix: '×' },
  {
    type: 'checkbox',
    key: 'outlineStrokes',
    label: 'Outline strokes on export (filled shapes instead of strokes)',
  },
]
