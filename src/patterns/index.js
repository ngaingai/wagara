// Register all wagara patterns here. Adding a new pattern later (asanoha,
// shippō, kikkō, …) is a one-line import + register — no changes anywhere in
// the export, preset, or UI plumbing.
import { registerPattern } from '../core/registry.js'
import seigaiha from './seigaiha/index.js'

registerPattern(seigaiha)

// Future:
// import asanoha from './asanoha/index.js'
// registerPattern(asanoha)

export { listPatterns, getPattern } from '../core/registry.js'
