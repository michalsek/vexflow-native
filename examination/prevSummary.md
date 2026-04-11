# `padadiddle-prev` Rendering Summary

## Purpose

This document is a reverse-engineering summary of the rendering stack in `prev-implementation/padadiddle-prev`. It is intended to support a clean rewrite of the rendering engine inside this repository, not to audit the full application.

The focus is limited to rendering utilities, rendering-facing data contracts, measurement and drawing logic, playback overlay geometry, and the React orchestration that sits directly around those concerns. Pure UI layers and unrelated application plumbing are intentionally excluded.

## Rendering Pipeline

The previous app renders notation through a layered pipeline:

1. `src/notationState/types.ts` defines the typed score model consumed by rendering.
2. `src/components/NotationDisplay/NotationDisplay.tsx` builds the display orchestration around one `Score`.
3. `NotationDisplay` creates a `NotationEngine` and calls `measure()` to pre-compute measure sizes, row placements, canvas bounds, and fallback playback geometry.
4. Layout hooks convert the measured result into GPU-safe canvas chunks for either row-based rendering or infinite horizontal scroll.
5. Each chunk renders through `src/skiaVexflow/VexflowCanvas.tsx`, which creates a Skia picture and hands VexFlow a compatible render context.
6. `src/skiaVexflow/SkiaVexflowContext.ts` adapts VexFlow drawing calls to React Native Skia primitives.
7. `NotationEngine.render()` draws the exact stave, note, beam, tuplet, and connector output for a chunk, and also emits exact `MeasureLayout` and `PlaybackNoteLayout` geometry.
8. Playback hooks use that geometry to drive the playhead, auto-scroll behavior, and active note highlight overlays.

That separation is important: the previous app does not treat rendering as “draw only”. The engine is also responsible for generating the geometry that playback visualization depends on.

## Core Data Contract

### `src/notationState/types.ts`

Primary role:
- Defines the rendering input model used throughout the stack.

Key interfaces:
- `Score`, `Staff`, `Measure`, `Voice`, `VoiceItem`
- `Note`, `Chord`, `Rest`
- `Duration`, `Pitch`, `Metrum`, `KeySignature`, `Tempo`

Important inputs and outputs:
- Input to rendering is always a strongly typed `Score`.
- `Measure` carries rendering-relevant metadata such as clef, metrum, key signature, directions, and barlines.
- `Staff` includes grand-staff grouping data via `systemGroupId` and `systemGroupRole`.

Rewrite-relevant behavior:
- The score model is already close to a useful engine boundary.
- Rendering code relies on the model carrying both semantic notation data and enough layout hints to resolve grouped staves, beaming, and playback timing.

Notable coupling / debt:
- The rendering layer assumes this app-owned score shape directly, with no adapter boundary between app state and engine state.
- Playback timing helpers also read directly from the same model, so timing and rendering are tightly coupled through shared score semantics.

## VexFlow-to-Skia Compatibility Layer

### `src/skiaVexflow/*`

Primary role:
- Provide a VexFlow-compatible drawing environment on top of React Native Skia.

Key classes and functions:
- `VexflowCanvas`
- `SkiaVexflowContext`
- `createTextMeasurementCanvas()`
- font and color helpers in `utils.tsx`, `constants.tsx`, `colorUtils.ts`

Important inputs and outputs:
- `VexflowCanvas` accepts `onDraw({ ctx, width, height })`.
- It loads the Bravura font, configures VexFlow text measurement, records a Skia picture, and renders that picture into a Skia canvas.
- `SkiaVexflowContext` exposes the VexFlow `RenderContext` surface needed by stave and note drawing.

Rewrite-relevant behavior:
- Text measurement is explicitly bridged for VexFlow through a fake 2D canvas object.
- The compatibility layer is intentionally narrow: it adapts drawing primitives, font parsing, line styles, and color resolution, but it does not own notation layout decisions.
- `VexflowCanvasDrawArgs` is the effective draw callback contract that the engine builds around.

Notable coupling / debt:
- The layer is partly app-aware through color-scheme integration and asset loading decisions.
- Some context APIs are stubbed or only partially implemented, which is acceptable for the current renderer but should be made explicit in a clean engine boundary.
- Font and text-measurement setup is tightly bound to draw execution rather than isolated as infrastructure.

## Core Rendering Engine

### `src/components/NotationDisplay/NotationEngine.ts`
### `src/components/NotationDisplay/engine/*`

Primary role:
- Measure and render the score.
- Produce both notation output and the geometry needed for playback overlays.

Key classes and functions:
- `NotationEngine`
- `NotationEngine.measure()`
- `NotationEngine.render()`
- `buildMeasurePlacements()`
- `calculateMeasureMinSize()`
- `buildVexflowVoiceLayouts()`
- `createFallbackMeasureLayout()`
- `resolveContentCompressionRatio()`
- beam helpers such as `generateBeamsWithPreservedStemDirections()` and `generateCrossStaffBeamsForNamedVoices()`

Important inputs and outputs:
- `measure()` input: `Score`, estimated canvas width, selected layout mode.
- `measure()` output: `NotationEngineMeasureResult`
  - `entries`
  - `placements`
  - `fallbackLayouts`
  - `totalRows`
  - `totalCanvasWidth`
  - `rowHeight`
- `render()` input: Skia-backed VexFlow context, chunk bounds, optional measure range, and the measured result.
- `render()` output: `NotationEngineRenderResult`
  - `layouts` (`MeasureLayout[]`)
  - `noteLayouts` (`PlaybackNoteLayout[]`)

Rewrite-relevant behavior:
- The engine has an explicit two-phase design:
  - pre-measure score structure and placement
  - draw exact chunk output and compute final geometry
- `measure()` computes stable fallback geometry before exact stave metrics exist.
- `render()` recomputes exact positions from actual VexFlow stave and tickable metrics.
- The engine supports multiple layout modes:
  - `minimal`
  - `fixedlayout`
  - `autolayout`
  - `infinitescroll`
- Measure widths can be horizontally compressed when dense content must fit the available width.
- Grand-staff rendering is built into the core engine rather than layered on externally.
- The engine handles:
  - clef changes
  - key signature changes
  - barlines
  - time signatures on first measures
  - directions text
  - tuplets
  - per-staff and cross-staff beams
  - adaptive spacing between grand-staff staves to avoid stem collisions

Notable coupling / debt:
- `NotationEngine` mixes several concerns in one class:
  - score traversal
  - measure sizing
  - placement planning
  - VexFlow object construction
  - drawing
  - playback geometry extraction
  - some display-specific debugging behavior
- Playback layout generation depends directly on draw-time VexFlow objects and tickable metrics, so the playback layer cannot be reasoned about independently.
- Some app display decisions, such as scroll anchor semantics and debug note bounds, leak into engine-facing outputs.

## Rendering Orchestration Layer

### `src/components/NotationDisplay/NotationDisplay.tsx`
### `src/components/NotationDisplay/hooks/*`
### `src/components/NotationDisplay/components/*`

Primary role:
- Own the React-side lifecycle around measurement, chunk rendering, overlay state, and playback-driven scrolling.

Key classes and functions:
- `NotationDisplay`
- `useNotationDisplayLayout()`
- `useNotationChunkRenderItems()`
- `useNotationPlayback()`
- `useNotationRenderStateReset()`
- `NotationCanvasLayer`
- `NotationCanvasChunk`
- `NotationNoteHighlightLayer`
- `NotationNoteHighlightItem`

Important inputs and outputs:
- Primary public component contract: `NotationDisplayProps`
  - `score`
  - optional `playbackTransport`
  - optional `contentTopY`
  - optional `layoutMode`
  - optional debug flag for precomputed note bounds
- Layout hook output combines:
  - measured score result
  - engine instance
  - row chunks
  - infinite-scroll chunks
  - total canvas bounds
  - estimated viewport width
- Chunk render items package chunk coordinates plus `onDraw` callbacks for `VexflowCanvas`.

Rewrite-relevant behavior:
- Rendering is split into multiple absolute-positioned chunk canvases inside a single coordinate space.
- Row chunking protects against Skia texture limits in multi-row layouts.
- Infinite-scroll mode slices horizontally by contiguous measure ranges and tracks `xOffset` per chunk.
- Jotai is used only for active note highlight rectangles, scoped to a local store per display instance.
- Playback updates are time-based and drive:
  - playhead position
  - active note highlight state
  - vertical scroll in row-based modes
  - horizontal scroll in infinite mode

Notable coupling / debt:
- React hooks and state management are intertwined with rendering engine outputs instead of sitting behind a thinner view-model layer.
- Scrolling behavior, playback state derivation, and canvas composition all live in the same feature package as the notation engine.
- The orchestration layer assumes knowledge of engine geometry internals such as row height, anchor points, and total quarter beats.

## Rendering Utilities and Playback Geometry Helpers

### `src/components/NotationDisplay/utils.ts`
### `src/components/NotationDisplay/utils/*`
### `src/components/NotationDisplay/playbackUtils.ts`

Primary role:
- Convert score data into VexFlow constructs, compute timing and duration information, split render chunks, and transform engine geometry into playback display behavior.

Key classes and functions:
- `toTickable()`
- `toVexflowPitch()`
- `toVexflowBarline()`
- `toVexflowKeySignature()`
- `buildTupletsForVoiceItems()`
- `drawBarNumber()`
- `getDurationInQuarterBeats()`
- `getMeasureQuarterBeats()`
- `getMeasureContentQuarterBeats()`
- `getScoreQuarterBeats()`
- `resolvePlaybackPhaseMs()`
- `getActivePlaybackNoteLayouts()`
- `createInfiniteCanvasChunks()`
- `findActiveMeasureLayoutIndex()`
- `resolveMeasurePlaybackRatio()`
- `PlaybackNoteHighlightsBuilder`

Important inputs and outputs:
- Score-derived timing values are normalized into quarter beats.
- Conversion helpers map notation-state items into VexFlow notes and modifiers.
- Playback utilities map transport state plus layout geometry into active measures and note highlights.
- Chunking utilities convert measure placements into renderable canvas windows.

Rewrite-relevant behavior:
- Quarter-beat timing is the shared unit across measurement, playback timing, and note highlight activation.
- Infinite-scroll chunking is deterministic and measure-range based, which is a good pattern to preserve.
- Highlight geometry is represented by `PlaybackNoteLayout`, which is a useful interface between engine output and playback UI.

Notable coupling / debt:
- Utility modules carry a mix of pure logic and display-specific assumptions.
- Some utilities are effectively engine internals but live in a shared feature-level helper area.
- Playback and rendering stay tightly linked because quarter-beat timing, measure bounds, and note rectangles are all produced and consumed inside the same package.

## Prototype / Non-Primary Sources

### `src/app/playerAlternative/other/*`

Primary role:
- Prototype or abandoned experimentation around a different rendering architecture.

Observed pieces:
- `ScoreRenderer.ts` is a stub class that iterates score measures but does not implement real rendering.
- `TextMeasurementContext.ts` is an alternative text-measurement bridge for VexFlow.

Rewrite guidance:
- Treat this directory as context only.
- It is useful for seeing earlier attempts to isolate rendering concerns, but it should not be treated as the authoritative basis for the rewrite.

## Behaviors That Matter for a Clean Rewrite

### 1. Multiple layout modes

The old renderer supports several layout behaviors, not just one canvas flow. The rewrite should decide whether these remain first-class modes or whether the engine should expose enough placement primitives for a host layer to build them.

### 2. Pre-measurement vs exact render-time layout

The explicit `measure()` then `render()` split is one of the strongest design choices in the previous implementation. It allows the app to plan chunk sizes and fallback playback geometry before exact drawing occurs. That split should be preserved.

### 3. Grand-staff pairing and adaptive spacing

Grand-staff handling is built from staff metadata, paired measure traversal, stave connectors, cross-staff beams, and adaptive secondary-staff offsets based on actual stem extents. This is specialized logic that should remain explicit and testable.

### 4. Beam and tuplet generation

Beaming respects metrum-derived grouping and attempts to preserve imported stem directions. Cross-staff beams are resolved by matching voice names across paired staves. These are meaningful musical-layout rules, not just display flourishes.

### 5. Clef, key-signature, accidental, and barline behavior

The engine owns repeated notation rules such as:
- when clefs and key signatures repeat
- how accidentals are applied
- how measure starts and ends choose barline types
- how first measures receive time signatures

Those rules should stay in engine-level logic rather than in UI composition.

### 6. Note-bound geometry for playback

Playback highlighting depends on exact note-head positions and vertical spans extracted from draw-time tickables. The rewrite should preserve playback geometry as a first-class engine output, even if the extraction mechanism changes.

### 7. GPU-safe chunked rendering

Canvas chunking is a structural requirement, not an optimization detail. The old app is designed around texture limits and absolute-positioned chunk composition. Any rewrite targeting mobile Skia should preserve this concern.

### 8. Scroll and playhead synchronization

The current implementation tightly synchronizes playback time, active measure detection, playhead motion, and viewport scrolling. That behavior is product-relevant, but it does not need to live in the same layer as raw notation drawing.

## Effective Interfaces Used by the Old Renderer

These are the key interfaces worth preserving or re-expressing cleanly:

- `Score`, `Measure`, `VoiceItem` from `src/notationState/types.ts`
- `NotationDisplayProps` from `src/components/NotationDisplay/types.ts`
- `NotationEngine.measure()` returning `NotationEngineMeasureResult`
- `NotationEngine.render()` returning `NotationEngineRenderResult`
- `VexflowCanvasDrawArgs` from `src/skiaVexflow/VexflowCanvas.tsx`
- `MeasureLayout` and `PlaybackNoteLayout` from `src/components/NotationDisplay/types.ts`

These interfaces describe the real boundaries in the previous system: score input, engine measurement output, draw-time execution, and playback/display geometry.

## What to Keep vs Rethink

Keep:
- The typed score contract as the rendering input.
- The explicit separation between `measure()` and `render()`.
- Chunked rendering as a first-class responsibility of the rendering stack.
- Playback geometry such as `MeasureLayout` and `PlaybackNoteLayout` as explicit engine outputs.
- Grand-staff handling as explicit logic rather than incidental layout behavior.

Rethink:
- The amount of responsibility concentrated in `NotationEngine`.
- The React/hook/Jotai coupling inside rendering orchestration.
- The current mixing of engine logic, playback overlay derivation, and scroll behavior in one feature area.
- App-specific display assumptions leaking into engine-facing structures.
- Utility placement, especially where pure engine logic and view-layer helpers are mixed together.

## Rewrite-Oriented Takeaways

The previous implementation already contains the outline of a solid rendering architecture:
- typed score input
- explicit measure phase
- explicit render phase
- compatibility layer for Skia-backed VexFlow
- geometry outputs for playback and interaction

The main rewrite opportunity is not to discard that shape, but to separate responsibilities more cleanly:
- isolate a pure rendering core from React orchestration
- keep playback geometry as an engine contract
- move scrolling and UI state out of engine-adjacent code
- treat chunk planning as infrastructure
- preserve specialized musical-layout rules as explicit, testable units

The clean rewrite should aim for a smaller core with clearer boundaries, while preserving the previous system’s strongest ideas: typed musical input, deterministic measurement, chunk-aware rendering, and playback-ready geometry.

## Exclusions

The following areas were intentionally ignored except where they directly touch rendering behavior:

- pure UI screens and navigation
- generic UI primitives in `src/ui/*`
- toasts, dropdowns, buttons, layout helpers, and text components
- editor controls and non-rendering notation editor workflows
- application storage, localization, and unrelated app plumbing
- audio playback implementation details outside the transport shape consumed by notation display
