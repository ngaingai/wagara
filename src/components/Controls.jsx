// Generic, schema-driven control renderer. It knows the control *types*
// (slider, number, color, checkbox, toggle, background, row, note) but nothing
// about any specific pattern. Shared controls and pattern controls both flow
// through here.

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
    .map((c, i) => <Control key={c.key || c.type + i} control={c} values={values} onChange={onChange} shared={shared} />)
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
      return (
        <label className="ctrl">
          <span className="ctrl-label">{c.label}</span>
          <input
            type="number"
            min={min}
            max={max}
            step={c.step ?? 1}
            value={val}
            onChange={(e) => {
              const v = Number(e.target.value)
              onChange(c.key, clamp(v, min ?? -Infinity, max ?? Infinity))
            }}
          />
        </label>
      )

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
