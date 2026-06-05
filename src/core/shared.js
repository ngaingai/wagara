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
