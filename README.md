# Wagara Generator

A single-page React app that generates wagara (和柄) pattern art from numeric
inputs and exports clean, editable SVG or high-resolution PNG. The SVG output is
real stroked vector paths, logically grouped, meant to drop straight into
Illustrator.

**Seigaiha** (青海波) is the first registered pattern. More (asanoha, shippō,
kikkō, …) plug in without touching the export, preset, or UI plumbing.

```
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Architecture

Each pattern is a self-contained generator module behind a uniform interface.
Everything else is pattern-agnostic and driven off the registry.

```
src/
  core/
    registry.js   register/get/list patterns
    shared.js     common controls (canvas, stroke, color, background, PNG scale)
    svg.js        f(), escapeAttr(), strokeAttrs(shared)
    export.js     buildDocument(), outlineSvgStrokes(), downloadSvg/Png, pngWarning
  components/
    Controls.jsx  generic schema-driven control renderer
  patterns/
    index.js      registers all patterns
    seigaiha/
      index.js    the pattern module (defaults, controls, presets, build, …)
      geometry.js  pure geometry (numbers in, path-data out)
  App.jsx         wires registry → selector, controls, presets, preview, export
```

### Pattern module interface

```js
export default {
  id: 'seigaiha',            // unique key
  label: 'Seigaiha',         // shown in the pattern selector
  defaultParams: () => ({}), // pattern-specific params only (no shared controls)
  controls: [ /* ControlSchema[] */ ],          // declarative, rendered generically
  presets: [ { label, shared?, params } ],
  build: (params, shared) => ({ defs?, body }),  // SVG geometry only
  warnings: (params, shared) => string[],        // optional, pattern-specific
  randomize: (params, shared) => params,         // optional, powers the dice button
}
```

`shared` is the common layer: `{ W, H, stroke, lineThickness, background,
transparent, pngScale, outlineStrokes }`. `build` returns geometry only —
`core/export.js` wraps it in the `<svg>` document, adds the background, and
optionally outlines strokes. None of that has pattern-specific logic.

### Control schema

Controls are data, not JSX, so the panel renders them generically. Supported
types: `slider`, `number`, `color`, `checkbox`, `toggle`, `background`,
`swatches`, `sizes`, `rotate`, `row`, `note`. `min`/`max` may be a number or
`(shared) => number`. `when(params, shared)` conditionally shows a control.
A `checkbox` may carry `onEnable: (values, shared) => ({ key: value })` to seed
sibling values from the current state when it's ticked, so switching a mode on
carries the current look over instead of snapping to that mode's default.

### Canvas size and pattern scale

`sizes` (see `CANVAS_SIZES` in `core/shared.js`) sets `W`/`H` together for the
square default and the social banner shapes. Canvas size changes are clamped in
`App.jsx`, so the values bounded by the canvas (`offsetX`, `offsetY`,
`borderThickness`) can't outlive a shrink.

`offsetX` is signed — negative nudges left, positive right — while `offsetY` is
positive-only (down). `core/export.js` just translates the body by the pair; it
is the *generator's* job to extend its field to cover whichever edge the nudge
reveals, or a blank strip appears there. Seigaiha does this by tiling the union
of the nudged and unnudged canvas rects (`fx`/`fy`/`fr`/`fb` in its `build`),
taking min/max rather than assuming a sign, which is what makes a negative
offset safe. Widening `offsetY` to negative is the same one-line range change
in `sharedControls` — the field math already handles it.

Widening the canvas is separate from how big the motif is. A generator that
derives its scale from `shared.W` will enlarge its motif on a wide canvas rather
than tiling more of it — seigaiha's `patternR(W, density)` does exactly that. It
also offers `lockedR(waveSize)`, selected by the `lockWaveSize` param, which
pins the radius in px so a banner extends the field sideways at a fixed motif
size. New patterns that scale off `W` should offer the same choice.

### Adding a pattern

1. Create `src/patterns/<name>/` with a `geometry.js` (pure) and an `index.js`
   implementing the interface above.
2. Register it in `src/patterns/index.js`:
   ```js
   import asanoha from './asanoha/index.js'
   registerPattern(asanoha)
   ```

That's it — the selector, controls panel, presets, randomize, and SVG/PNG export
all pick it up with no other changes.
