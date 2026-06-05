// Small SVG string helpers shared by every pattern generator. Nothing here is
// specific to any one wagara pattern.

// Trim floating noise so exported path data stays readable in Illustrator.
export const f = (n) => {
  const r = Math.round(n * 1000) / 1000
  return Object.is(r, -0) ? 0 : r
}

export const escapeAttr = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// Standard stroke styling derived from the SHARED controls. Generators apply
// this wherever they nest their geometry (group, <pattern>, etc.).
export function strokeAttrs(shared) {
  return (
    `fill="none" stroke="${escapeAttr(shared.stroke)}" ` +
    `stroke-width="${f(shared.lineThickness)}" ` +
    `stroke-linecap="round" stroke-linejoin="round"`
  )
}
