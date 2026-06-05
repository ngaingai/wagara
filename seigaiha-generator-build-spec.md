# Seigaiha Pattern Generator: Build Spec and Hand-off

## Summary

A single-page React app that generates seigaiha (青海波) wave art from numeric inputs and exports clean, editable SVG or high-resolution PNG. It has two modes: a seamless repeating tile (for backgrounds and fills) and a positioned fan motif that can straighten its arcs into evenly spaced bars (for logo-style assets like the Hashi mark). Personal tool, no backend, function over polish. The SVG output is meant to drop straight into Illustrator for further composition.

---

## Stack and Constraints

- React via Vite. Plain JS is fine; TypeScript is optional.
- No backend, no persistence, no accounts. Client-side only.
- No UI component library needed. Plain CSS or inline styles.
- Runs with `npm run dev`, builds with `npm run build`.
- Keep dependencies minimal. No drawing libraries; everything is SVG paths.
- Exported SVG must be editable vector in Illustrator (real stroked paths, logically grouped), not a flattened raster.

---

## Two Generation Modes

A mode switch at the top of the controls toggles between:

1. **Pattern mode**: the classic seigaiha field, a seamless repeating tile. Use for backgrounds, fills, textures.
2. **Fan mode**: a single positioned concentric-arc motif with full control over center, sweep, ring count, spacing, and an optional "straighten" that turns the arc tails into evenly spaced bars. This is the mode that reproduces the Hashi logo family.

Both modes share the export pipeline.

---

## Pattern Mode Geometry

This tiles perfectly. Most online seigaiha looks subtly wrong because the stagger is off; the construction below is seamless by design.

### One scale

A scale is `n` concentric upper semicircles (top half, bulging toward smaller y) sharing a center on a baseline.

- Outer radius `R`, arc radii `r_i = R * i / n` for `i = 1..n`
- Spacing between arcs: `R / n`

### Tiling rule (y increases downward)

- Vertical spacing between rows: `R`
- Horizontal spacing within a row: `2R`
- Alternate rows offset horizontally by `R`, so a lower-row peak sits in the valley between two scales above it

The layout is periodic with period `2R` in both axes, so render it as an SVG `<pattern>` tile of `2R x 2R` and fill one `<rect>`. The SVG stays tiny and performance is flat regardless of canvas size.

### Reference generator

```js
// Concentric-arc paths for one 2R x 2R pattern tile.
// Centers drawn for a neighborhood (-1..2) so arcs crossing the tile
// edge are present; the pattern box clips the overflow.
function buildTilePaths(R, n) {
  const paths = [];
  for (let row = -1; row <= 2; row++) {
    const cy = row * R;
    const xOffset = (Math.abs(row) % 2 === 0) ? 0 : R; // stagger odd rows
    for (let k = -1; k <= 2; k++) {
      const cx = xOffset + k * 2 * R;
      for (let i = 1; i <= n; i++) {
        const r = (R * i) / n;
        // upper semicircle, left to right, bulging up (smaller y).
        // if it bulges DOWN when tested, flip the sweep flag 1 -> 0.
        paths.push(`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`);
      }
    }
  }
  return paths;
}
```

---

## Fan Mode Geometry

This is the important new part. A fan is a set of concentric arcs sharing a center, each arc optionally continuing into a straight bar.

### The fan

- Center `C = (cx, cy)`
- Ring count `N`, inner radius `r0`, ring spacing `gap`
- Ring radius `r_i = r0 + (i - 1) * gap` for `i = 1..N`
- Each ring is an arc from `startAngle` to `endAngle`

Angle convention: degrees, `0` points right, angle increases clockwise because SVG y points down. So `0` is 3 o'clock, `90` is 6 o'clock, `180` is 9 o'clock, `270` is 12 o'clock. A plain upper-semicircle fan (classic seigaiha) is `startAngle 180`, `endAngle 360`.

### The straighten (arc tail to bars)

When straighten is on, each ring continues past `endAngle` as a straight line tangent to the circle at that point, running for a set length or until it hits a chosen canvas edge.

Why this gives clean, evenly spaced bars for free: the tangent to a circle is vertical at the 3 o'clock and 9 o'clock points. Two concentric rings differing by `gap` have tangent lines at the same angle that are parallel and exactly `gap` apart. So end the arcs at 3 o'clock (`endAngle = 360`) and the tails become vertical bars at `x = cx + r_i`, spaced `gap`, with a smooth (tangent-matched) join where curve meets line. That is the Hashi tail.

For a foolproof vertical bar, draw the tail as an explicit vertical line in the chosen direction (up toward `y = 0`, or down toward `y = H`) rather than deriving it from sweep direction. At a vertical-tangent angle the line is vertical either way, and a clean vertical bar is what you want.

### Reference generator

```js
const rad = d => (d * Math.PI) / 180;
const pt  = (cx, cy, r, deg) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];

// straighten: null, or { dir: 'up' | 'down', toEdge: bool, length: number, H: number }
function ringPath(cx, cy, r, startDeg, endDeg, straighten) {
  const [sx, sy] = pt(cx, cy, r, startDeg);
  const [ex, ey] = pt(cx, cy, r, endDeg);
  const sweep = ((endDeg - startDeg) % 360 + 360) % 360;
  const largeArc = sweep > 180 ? 1 : 0;
  let d = `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`;

  if (straighten) {
    // vertical bar from the arc end point (intended for endDeg 0/360 or 180,
    // where the tangent is vertical and the join stays smooth)
    let ty;
    if (straighten.toEdge) {
      ty = straighten.dir === 'up' ? 0 : straighten.H;
    } else {
      ty = straighten.dir === 'up' ? ey - straighten.length : ey + straighten.length;
    }
    d += ` L ${ex} ${ty}`;
  }
  return d;
}
```

For horizontal bars instead, end the arcs at 12 or 6 o'clock and run the tail left or right; same idea, tangent is horizontal there. Expose this only if you want it; vertical covers the logo.

### Recreating the Hashi tail

Center the fan low and left. Sweep each ring up the right side to 3 o'clock (`endAngle = 360`), turn straighten on with `dir: 'up'` and `toEdge: true`. The arcs curve and then shoot up as evenly spaced vertical bars to the top of the frame. Compose two such fans and the wordmark in Illustrator using the exported SVG.

---

## Parameters

### Shared

| Parameter | Control | Range | Default | Maps to |
|---|---|---|---|---|
| Mode | toggle | pattern / fan | fan | Which generator runs |
| Line thickness | slider | 0.5 to 24 | 8 | `stroke-width` in px |
| Stroke color | color picker | any | `#000000` | stroke |
| Background | color picker + transparent checkbox | any / transparent | transparent | tile or canvas background |
| Canvas width | number | 100 to 4000 | 1000 | `W` |
| Canvas height | number | 100 to 4000 | 1000 | `H` |
| PNG scale | slider | 1 to 4 | 2 | Pixel multiplier for PNG export |

### Pattern mode

| Parameter | Control | Range | Default | Maps to |
|---|---|---|---|---|
| Wave density | slider | 2 to 40 | 10 | Wave columns across width. `R = max(8, round(W / (2 * density)))`. Higher means smaller waves. |
| Arc count | slider | 1 to 20 | 6 | `n`, concentric lines per scale |

### Fan mode

| Parameter | Control | Range | Default | Maps to |
|---|---|---|---|---|
| Center X | slider or number | 0 to W | 0.35 * W | `cx` |
| Center Y | slider or number | 0 to H | 0.55 * H | `cy` |
| Inner radius | number | 0 to W | 40 | `r0` |
| Ring count | slider | 1 to 40 | 12 | `N` |
| Ring spacing | slider | 2 to 200 | 55 | `gap`. Also the bar spacing when straightened. |
| Start angle | slider | 0 to 360 | 180 | `startAngle` |
| End angle | slider | 0 to 360 | 360 | `endAngle` |
| Rotation | slider | 0 to 360 | 0 | rotate the whole fan about its center |
| Straighten | toggle | on / off | off | Enable the bar tail |
| Bar direction | toggle | up / down | up | Tail direction (use with end angle 0/360 for vertical bars) |
| Bar length | toggle + number | to edge / fixed | to edge | Run tail to canvas edge or a set length |

Rotation can be applied with an SVG group transform `transform="rotate(angle cx cy)"` around the fan center, which keeps the math simple.

---

## Presets

Ship these as one-click buttons in a row at the top of the controls. Clicking a preset loads its values into the controls, which stay fully editable afterward (a preset is just a starting point, not a lock). Both are tuned for the default 1000 x 1000 transparent canvas; they scale with the canvas but look best near that size.

```js
const PRESETS = {
  plainFan: {
    label: 'Plain Fan',
    mode: 'fan',
    W: 1000, H: 1000,
    background: 'transparent',
    stroke: '#000000',
    lineThickness: 8,
    pngScale: 2,
    fan: {
      cx: 500, cy: 660,
      r0: 40, ringCount: 12, gap: 52,
      startAngle: 180, endAngle: 360,   // full upper semicircle
      rotation: 0,
      straighten: false,
    },
  },

  waveTail: {
    label: 'Wave Tail',
    mode: 'fan',
    W: 1000, H: 1000,
    background: 'transparent',
    stroke: '#000000',
    lineThickness: 8,
    pngScale: 2,
    fan: {
      cx: 480, cy: 700,
      r0: 50, ringCount: 10, gap: 58,
      startAngle: 180, endAngle: 360,   // upper semicircle...
      rotation: 0,
      straighten: true,                  // ...with the right tail straightened
      barDirection: 'down',
      barLength: 'toEdge',
    },
  },
};
```

**Plain Fan.** A classic seigaiha fan: concentric upper semicircles, no straighten. A clean, full-bleed wave motif that bleeds off the left and right edges. The everyday starting point.

**Wave Tail.** The same upward fan, but the right end of every ring straightens into an evenly spaced vertical bar dropping to the bottom edge. This is the logo-family look: arcs that comb out into parallel strokes, bar spacing equal to the ring gap, smooth tangent joins.

One honesty note on the tail direction. With an upward fan, bars dropping down (as above) stay cleanly separate from the arcs. Flipping Bar direction to up makes the bars rise back through the arcs into a woven lattice, which can look good but is busier and is not a literal match for the Hashi mark. The mark itself is two fans composed together, which is a quick arrange step in Illustrator using the exported SVG. The preset gives you the core element to build from.

---

## UI Layout

No styling effort required beyond usable.

1. Preset buttons in a row at the very top: one per entry in `PRESETS`. Clicking loads that parameter set.
2. Controls panel (left or top): the mode toggle, then the shared controls, then the controls for the active mode. Show the live numeric value beside each slider.
3. Live SVG preview that updates on every change.
4. Two export buttons: "Download SVG" and "Download PNG".
5. Optional: a "Randomize" button that scrambles the active mode's parameters within sane ranges, for spinning variations fast.

---

## Export Requirements

Build one standalone SVG string and use it for both exports so preview and output never diverge.

- The SVG must declare `xmlns`, explicit `width` / `height` / `viewBox`, inline stroke attributes, and group the paths logically (for fan mode, one group per fan, ideally one subgroup per ring so rings are selectable in Illustrator).
- Strokes stay as strokes by default. Optional toggle: "outline strokes" for export, for when filled shapes are wanted instead.

### SVG

Serialize the SVG string to a Blob (`image/svg+xml`), object URL, trigger download. Must open in Illustrator or Inkscape as editable paths.

### PNG

Rasterize the same SVG string, do not redraw geometry on canvas.

```js
async function downloadPng(svgStr, W, H, scale = 2) {
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });

  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);

  canvas.toBlob((b) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'seigaiha.png';
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}
```

A transparent background means building the SVG with no background rect, so the PNG raster comes through transparent.

---

## Acceptance Criteria

1. Pattern mode tiles seamlessly: repeat the exported asset in a grid or as a CSS background, no visible seam at any edge.
2. Pattern scallops bulge upward, arcs are evenly spaced, adjacent rows interlock (lower peak in upper valley).
3. Fan mode draws concentric arcs at the set center, sweep, count, and spacing, and updates live for every control.
4. With straighten on and end angle at 3 o'clock, the tails are vertical bars at `x = cx + r_i`, spaced exactly `gap`, joining the arcs smoothly with no kink.
5. Bar direction and bar length behave: tails run up or down, to the canvas edge or the set length.
6. Transparent background produces a PNG with no opaque fill.
7. Exported SVG opens in Illustrator as editable, logically grouped stroked paths, not a raster.
8. PNG export is crisp at `W * scale` by `H * scale`.
9. Runs via `npm run dev`, builds via `npm run build`, no backend.
10. Each preset button loads its parameter set and renders the result described above, and the controls remain editable afterward.

---

## Edge Cases and Clamps

- Pattern: clamp `R` to a minimum (the formula uses `max(8, ...)`) so high density does not collapse to a solid block.
- If line thickness approaches the ring spacing, arcs merge into a filled look. Either clamp `stroke` to roughly `0.8 * gap` (and `0.8 * R / n` in pattern mode) or show a small inline note instead of silently producing mush.
- Large canvas times high PNG scale can exceed browser canvas limits (around 16k px per side). Cap `W * scale` and `H * scale`, or warn.
- Guard against zero or negative numeric inputs.
- Fan with `endAngle == startAngle`: treat as a full ring or clamp to a minimum sweep.

---

## Open Decisions

Sensible defaults are baked in so this is buildable as-is. Three worth a look:

1. **Multiple fans in-app.** The spec builds one configurable fan plus pattern mode. The logo uses two interlocking fans, but those are trivial to duplicate and arrange in Illustrator from the exported SVG. Letting the app hold a list of fans is more useful for variations but adds real UI complexity. Recommendation: ship single fan now, add a fan list later only if the Illustrator step turns out to be a drag.
2. **Straighten transition style.** Tangent continuation (used here) joins curve to line with matching tangent, so it is already smooth; no clothoid or curvature easing needed. Recommendation: keep tangent continuation, skip anything fancier.
3. **Bar termination default.** Defaulted to "run to canvas edge" since that matches the framed logo look. Fixed length is the alternative. Recommendation: keep to-edge as default, expose fixed as an option.

---

## Out of Scope

No typography or wordmark handling (done in Illustrator). No multi-fan composition in-app for the first build. No saved presets or local storage, no auth, no responsive or mobile layout work, no app theming, no animation, no pattern types beyond seigaiha. Add later if the tool earns it.
