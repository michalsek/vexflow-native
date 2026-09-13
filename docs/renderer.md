# Rendering (`vexflow-native/renderer`)

`ScoreRenderer` renders a [`Score`](state.md) with VexFlow into a Skia
canvas, with pan scrolling, scrollbars, a playhead overlay and per-item style
overrides driven from the UI thread.

## Props

- `score`: typed score state to render.
- `defaultFont`: font family name used as the default VexFlow font; must
  match a family passed to `useFonts`.
- `fontManager`: Skia font provider returned by `useFonts`.
- `colorScheme`: optional `foreground`, `background` and `ledgerLine`
  colors. VexFlow's black strokes/fills map to `foreground`, its `#444`
  ledger lines to `ledgerLine` (falling back to `foreground`).
- `itemStyleOverrides`: optional Reanimated shared value mapping score item
  ids to replay-time overrides (`fillColor`, `strokeColor`, `shadowColor`,
  `shadowBlur`, `lineDash`). Applied without re-recording the score.
- `decorateItem` / `onDrawItem`: per-item hooks, see
  [Escape hatch](#escape-hatch-per-item-hooks).
- `rendererType`: `document` (default; systems wrap vertically),
  `documentEven` (even measure widths across document systems) or
  `infiniteScore` (one horizontal system, pans horizontally).
- `options`: partial settings merged over the defaults —
  `insets` (`top`/`right`/`bottom`/`left`, default 24),
  `spacing` (`staffGap` between systems, default 96;
  `minIntrinsicSizeMultiplier`, default 2) and `render`:
  - `scale`: uniform notation scale, default 1. Lossless — the notation is
    re-rasterized at the final size; non-finite or non-positive values are
    treated as 1.
  - `fixedNoteSpacing`: positions every tick context at its
    time-proportional x inside the note area instead of VexFlow's
    duration-weighted spacing, so with a `spacer` voice covering each lattice
    tick engraved x positions are a pure function of time. Default `false`.
- `scrollEnabled` / `showScrollbars`: pan scrolling and overflow scrollbars,
  both default `true`.
- `scrollOffset`: optional controlled Reanimated shared value for the scroll
  position along the renderer's axis. The renderer reads and writes it (pan
  gesture, decay, clamping) and external writes move the content — the seam
  for playback auto-scroll. Must stay the same shared value for the
  component's lifetime.
- `playhead`: optional Reanimated shared value positioning a playhead overlay
  (`{ x, y, height }` in `onItemsLayout` coordinates, `null` hides it). `x`
  is the playhead's center line; `y`/`height` bound the system band it spans.
  The overlay tracks scrolling on the UI thread without re-recording.
- `playheadStyle`: `color` (default: color scheme foreground), `width`
  (default 2), `borderRadius` (default half the width), `opacity`
  (default 0.9).
- `onScrollGeometry`: fired when the scroll envelope changes — `axis`,
  `viewportSize`, `contentSize`, `maxScroll` (0 when the content fits).
- `onItemsLayout`: fired after each recording pass, see
  [Layout contract](#layout-contract).
- `onReady`: fired once per mount, when the first score picture has been
  rasterized for a non-empty viewport. Later re-records (resize, option
  changes) do not re-fire it — the seam for hiding a loading indicator.

## Layout contract

`onItemsLayout` receives a `ScoreItemsLayout`: `items` keyed by item id,
`measures` (one entry per rendered stave of a measure) and `contentSize`.
Coordinates are **view-space points at scroll offset 0** — after
`render.scale`, not tracking scrolling; subtract the current scroll offset
along the scroll axis for on-screen positions.

Item entry (`ScoreItemLayout`):

- `x`, `width`: the formatted note block. Glyphs draw to the right of `x`.
- `headCenterX`: center of the notehead span — the coordinate to align
  external UI to. Hidden and spacer rests fall back to the center of a
  notional notehead at the block's left edge, so they agree with a real note
  on the same tick.
- `measureIndex`.
- `modifierBounds`: union box (`left`/`right`/`top`/`bottom`) of the item's
  drawn modifiers — articulations, annotations, dynamics, lyrics, grace
  notes, parentheses, accidentals, dots; absent without modifiers.

Measure entry (`ScoreMeasureItemsLayout`):

- `groupId`, `staffId`, `measureIndex`, `systemIndex`.
- `x`, `width`: stave origin and width; `staveNoteStartX`/`staveNoteEndX`
  bound the note area (after clef and meter).
- `y`, `height`: the measure's system band (all staves of the group).
- `staveLineTopY`/`staveLineBottomY`: top edge of the top line and bottom
  edge of the bottom line, spanning the full five-line geometry even when
  `Staff.lines` hides lines.
- `visibleLineYs`: stroke centre y of each drawn staff line, top to bottom
  (5, 3 or 1 entries). On a five-line staff `visibleLineYs[0] ===
staveLineTopY` and the last entry is `staveLineBottomY − lineWidth`; with
  hidden lines `staveLineTopY`/`staveLineBottomY` still span the five-line
  geometry, so read the drawn line from `visibleLineYs`.

## Escape hatch: per-item hooks

When the score model has no attachment for a mark you need, `ScoreRenderer`
lets you reach the VexFlow note of every item without leaving the typed
score. Both hooks are optional and keep the item's layout, style overrides
and `onItemsLayout` entry intact.

- `decorateItem(item, note, { clef, staff, measureIndex, attachments })` runs
  once per drawable item (never for `hidden`/`spacer` rests) in **both** the
  measurement and the drawing pass, after the item's own attachments are
  applied, before the measure's text directions and before formatting — so
  any modifier you add (`Articulation`, `Ornament`,
  `Annotation`, …) counts in the intrinsic width and in the vertical staff
  bounds. It must be deterministic in its inputs and free of side effects:
  the VexFlow objects are rebuilt on every pass, so never cache by note
  identity.
- `onDrawItem(ctx, item, note, layout)` runs in the drawing pass only, right
  after the note and its modifiers are drawn and inside the item's color
  group (so `itemStyleOverrides` apply to what you draw). `layout` is the
  item's geometry in **content space** — the space `ctx` draws in, VexFlow
  units before `options.render.scale`; `onItemsLayout` receives the same
  entry multiplied by the scale.

The VexFlow classes the hooks need are re-exported from
`vexflow-native/renderer` (`StaveNote`, `Modifier`, `Articulation`,
`Annotation`, `Ornament`, `RenderContext`); `vexflow` is a peer dependency,
so these are your own copy of the classes and `instanceof` checks against
them hold. Define the hooks outside the component (or wrap them in
`useCallback` inside it) — a new function identity re-records the score.

```tsx
import {
  Articulation,
  ScoreRenderer,
  type DecorateItem,
  type DrawItem,
} from 'vexflow-native/renderer';

const decorateItem: DecorateItem = (item, note) => {
  if (item.type === 'note' && item.id.startsWith('snap-')) {
    note.addModifier(new Articulation('ao')); // snap pizzicato
  }
};

const onDrawItem: DrawItem = (ctx, item, _note, layout) => {
  if (item.id === 'target') {
    const top = layout.modifierBounds?.top ?? 0;

    ctx.beginPath();
    ctx.arc(layout.headCenterX, top, 6, 0, 2 * Math.PI, false);
    ctx.stroke();
  }
};

<ScoreRenderer
  score={score}
  defaultFont="Bravura"
  fontManager={fontManager}
  decorateItem={decorateItem}
  onDrawItem={onDrawItem}
/>;
```
