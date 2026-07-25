// Generic, schema-driven control renderer. It knows the control *types*
// (slider, number, color, checkbox, toggle, background, row, note) but nothing
// about any specific pattern. Shared controls and pattern controls both flow
// through here.

import { useState } from 'react'

const resolve = (v, shared) => (typeof v === 'function' ? v(shared) : v)

function clamp(v, min, max) {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, v))
}

// Render a list of control schemas against a value bag `values`.
// `onChange(key, value)` writes back. `shared` resolves dynamic min/max.
export function ControlList({ controls, values, onChange, shared }) {
  return controls
    .filter((c) => !c.when || c.when(values, shared))
    .map((c, i) => (
      <Control key={`${c.type}-${c.key ?? i}`} control={c} values={values} onChange={onChange} shared={shared} />
    ))
}

function Control({ control, values, onChange, shared }) {
  const c = control
  const val = values[c.key]
  const min = resolve(c.min, shared)
  const max = resolve(c.max, shared)

  switch (c.type) {
    case 'row':
      return (
        <div className="row">
          <ControlList controls={c.children} values={values} onChange={onChange} shared={shared} />
        </div>
      )

    case 'slider':
      return (
        <label className="ctrl">
          <span className="ctrl-label">
            {c.label}
            <em>
              {val}
              {c.suffix || ''}
            </em>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={c.step ?? 1}
            value={val}
            onChange={(e) => onChange(c.key, Number(e.target.value))}
          />
        </label>
      )

    case 'number':
      return <NumberControl c={c} val={val} min={min} max={max} onChange={onChange} />

    case 'color':
      return (
        <label className="ctrl">
          <span className="ctrl-label">{c.label}</span>
          <input type="color" value={val} onChange={(e) => onChange(c.key, e.target.value)} />
        </label>
      )

    case 'background':
      // color picker + transparent checkbox, both writing shared keys
      return (
        <label className="ctrl">
          <span className="ctrl-label">
            {c.label}
            <em>
              <input
                type="checkbox"
                checked={values.transparent}
                onChange={(e) => onChange('transparent', e.target.checked)}
              />{' '}
              transparent
            </em>
          </span>
          <input
            type="color"
            value={val}
            disabled={values.transparent}
            onChange={(e) => onChange(c.key, e.target.value)}
          />
        </label>
      )

    case 'swatches': {
      // Clickable colour chips (c.colors → fixed colours) and/or copy buttons
      // (c.from → read another shared key's current value). All write c.key.
      const apply = (value) => {
        onChange(c.key, value)
        if (c.alsoSet) for (const [k, v] of Object.entries(c.alsoSet)) onChange(k, v)
      }
      const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase()
      return (
        <div className="ctrl">
          {c.label && <span className="ctrl-label">{c.label}</span>}
          <div className="swatches">
            {c.colors?.map((color) => (
              <button
                key={color}
                type="button"
                className={same(val, color) ? 'swatch active' : 'swatch'}
                style={{ background: color }}
                title={color}
                aria-label={color}
                onClick={() => apply(color)}
              />
            ))}
            {c.from?.map((src) => (
              <button key={src.key} type="button" className="swatch-copy" onClick={() => apply(values[src.key])}>
                {src.label}
              </button>
            ))}
          </div>
        </div>
      )
    }

    case 'rotate': {
      // Two buttons stepping the angle by ±step° (default 90), wrapped to 0–359.
      const step = c.step || 90
      const cur = (((val || 0) % 360) + 360) % 360
      const turn = (d) => onChange(c.key, (((cur + d) % 360) + 360) % 360)
      return (
        <div className="ctrl">
          <span className="ctrl-label">
            {c.label}
            <em>{cur}°</em>
          </span>
          <div className="seg">
            <button type="button" className="seg-btn" title="Rotate counter-clockwise" onClick={() => turn(-step)}>
              ⟲ Left
            </button>
            <button type="button" className="seg-btn" title="Rotate clockwise" onClick={() => turn(step)}>
              ⟳ Right
            </button>
          </div>
        </div>
      )
    }

    case 'checkbox':
      return (
        <label className="ctrl inline">
          <input type="checkbox" checked={!!val} onChange={(e) => onChange(c.key, e.target.checked)} />
          <span>{c.label}</span>
        </label>
      )

    case 'toggle':
      return (
        <div className="ctrl">
          <span className="ctrl-label">{c.label}</span>
          <div className="seg">
            {c.options.map((o) => (
              <button
                key={o.value}
                type="button"
                className={val === o.value ? 'seg-btn active' : 'seg-btn'}
                onClick={() => onChange(c.key, o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )

    case 'note':
      return <p className="hint">{c.text(values, shared)}</p>

    default:
      return null
  }
}

// Numbers buffer keystrokes locally and only clamp + commit on blur/Enter, so
// clearing "1000" to type "800" doesn't snap the value to min mid-edit.
function NumberControl({ c, val, min, max, onChange }) {
  const [draft, setDraft] = useState(null) // null = not editing
  const commit = () => {
    if (draft === null) return
    const v = Number(draft)
    if (draft.trim() !== '' && Number.isFinite(v)) {
      onChange(c.key, clamp(v, min ?? -Infinity, max ?? Infinity))
    }
    setDraft(null)
  }
  return (
    <label className="ctrl">
      <span className="ctrl-label">{c.label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={c.step ?? 1}
        value={draft ?? val}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </label>
  )
}
