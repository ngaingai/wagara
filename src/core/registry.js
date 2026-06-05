// Pattern registry. Each wagara pattern is a self-contained generator module
// registered here under a unique id. Everything else in the app (export,
// presets, controls UI) is driven off this map and knows nothing about any
// specific pattern.
//
// A pattern module must implement this uniform interface:
//
//   id            string, unique key
//   label         string, shown in the pattern selector
//   defaultParams () => object   pattern-specific params (no shared controls)
//   controls      Array<ControlSchema>   declarative pattern-specific controls
//   presets       Array<{ label, shared?, params }>
//   build         (params, shared) => { defs?: string, body: string }
//                 returns SVG geometry only; the export layer wraps it
//   warnings      (params, shared) => string[]   optional, pattern-specific
//
// `shared` is the common layer: { W, H, stroke, lineThickness, background,
// transparent, pngScale, outlineStrokes }.

const registry = new Map()

export function registerPattern(module) {
  if (!module || !module.id) throw new Error('Pattern module needs an id')
  if (registry.has(module.id)) throw new Error(`Pattern "${module.id}" already registered`)
  registry.set(module.id, module)
  return module
}

export function getPattern(id) {
  return registry.get(id)
}

export function listPatterns() {
  return [...registry.values()]
}
