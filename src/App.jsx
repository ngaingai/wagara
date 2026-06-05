import { useMemo, useState } from 'react'
import { listPatterns, getPattern } from './patterns/index.js'
import { defaultShared, sharedControls } from './core/shared.js'
import { buildDocument, downloadSvg, downloadPng, pngWarning } from './core/export.js'
import { ControlList } from './components/Controls.jsx'

// Seed per-pattern params so edits survive switching patterns.
function initParams() {
  const out = {}
  for (const p of listPatterns()) out[p.id] = p.defaultParams()
  return out
}

export default function App() {
  const patterns = listPatterns()
  const [patternId, setPatternId] = useState(patterns[0]?.id)
  const [shared, setShared] = useState(defaultShared)
  const [paramsByPattern, setParamsByPattern] = useState(initParams)
  const [busy, setBusy] = useState(false)

  const module = getPattern(patternId)
  const params = paramsByPattern[patternId]

  const setSharedKey = (key, value) => setShared((s) => ({ ...s, [key]: value }))
  const setParamKey = (key, value) =>
    setParamsByPattern((m) => ({ ...m, [patternId]: { ...m[patternId], [key]: value } }))

  // Geometry from the active generator; rebuilt only when its inputs change.
  const geom = useMemo(() => module.build(params, shared), [module, params, shared])

  // Preview never outlines strokes (only matters for the exported file).
  const previewSvg = useMemo(
    () => buildDocument({ ...shared, outlineStrokes: false }, geom),
    [shared, geom],
  )

  const warnings = [...(module.warnings?.(params, shared) || [])]
  const pWarn = pngWarning(shared)
  if (pWarn) warnings.push(pWarn)

  const applyPreset = (preset) => {
    setShared((s) => ({ ...s, ...(preset.shared || {}) }))
    setParamsByPattern((m) => ({
      ...m,
      [patternId]: { ...module.defaultParams(), ...(preset.params || {}) },
    }))
  }

  const onRandomize = () => {
    if (!module.randomize) return
    setParamsByPattern((m) => ({ ...m, [patternId]: module.randomize(params, shared) }))
  }

  const onExportSvg = () => downloadSvg(buildDocument(shared, geom), `${patternId}.svg`)
  const onExportPng = async () => {
    setBusy(true)
    try {
      await downloadPng(buildDocument(shared, geom), shared.W, shared.H, shared.pngScale, `${patternId}.png`)
    } catch (e) {
      alert('PNG export failed: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <div className="panel">
        <h1>Wagara Generator</h1>

        {/* Pattern selector — driven by the registry */}
        {patterns.length > 1 && (
          <div className="patterns">
            {patterns.map((p) => (
              <button
                key={p.id}
                type="button"
                className={p.id === patternId ? 'active' : ''}
                onClick={() => setPatternId(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Presets for the active pattern */}
        <div className="presets">
          {module.presets?.map((preset, i) => (
            <button key={i} type="button" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
          {module.randomize && (
            <button type="button" className="ghost" onClick={onRandomize}>
              🎲 Randomize
            </button>
          )}
        </div>

        {/* Pattern-specific controls (from the module's schema) */}
        <h2>{module.label}</h2>
        <ControlList controls={module.controls} values={params} onChange={setParamKey} shared={shared} />

        {/* Shared controls (common layer) */}
        <h2>Shared</h2>
        <ControlList controls={sharedControls} values={shared} onChange={setSharedKey} shared={shared} />

        {warnings.map((w, i) => (
          <p key={i} className="warn">
            {w}
          </p>
        ))}

        <div className="exports">
          <button type="button" onClick={onExportSvg}>
            Download SVG
          </button>
          <button type="button" onClick={onExportPng} disabled={busy}>
            {busy ? 'Rendering…' : 'Download PNG'}
          </button>
        </div>
      </div>

      <div className="preview">
        <div
          className={`preview-stage ${shared.transparent ? 'checkerboard' : ''}`}
          dangerouslySetInnerHTML={{ __html: previewSvg }}
        />
      </div>
    </div>
  )
}
