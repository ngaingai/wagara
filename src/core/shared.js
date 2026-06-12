// The common control layer shared by every pattern. Defaults + declarative
// control schema. Patterns never redefine these; they only add their own.

export function defaultShared() {
  return {
    W: 1000,
    H: 1000,
    stroke: '#000000',
    lineThickness: 8,
    background: '#ffffff',
    transparent: true,
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
  { type: 'background', key: 'background', label: 'Background' }, // color + transparent checkbox
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
    type: 'row',
    children: [
      { type: 'number', key: 'W', label: 'Canvas width', min: 100, max: 4000 },
      { type: 'number', key: 'H', label: 'Canvas height', min: 100, max: 4000 },
    ],
  },
  { type: 'slider', key: 'pngScale', label: 'PNG scale', min: 1, max: 4, step: 1, suffix: '×' },
  {
    type: 'checkbox',
    key: 'outlineStrokes',
    label: 'Outline strokes on export (filled shapes instead of strokes)',
  },
]
