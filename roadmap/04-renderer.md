# `vexflow-native/renderer` Contract Plan

This step defines the public renderer contract for `vexflow-native/renderer` on
top of `vexflow-native/state`. It is intentionally limited to the typed API
surface and package boundary, not the renderer core implementation.

1. Define `vexflow-native/renderer` as a first-class typed public subpath,
   parallel to `vexflow-native/state`, whose job is to accept `Score`-based
   notation data and expose stable renderer-facing contracts.
2. Keep the package boundary explicit: the renderer consumes `Score` and related
   types from `vexflow-native/state` and returns typed layout and render
   geometry, but it does not own React state, scrolling behavior, playback
   transport, or MusicXML parsing.
3. Establish the top-level public contract groups up front: `RendererConfig`,
   `RendererLayoutMode`, `MeasureRequest`, `MeasureResult`, `RenderRequest`,
   `RenderResult`, `MeasureLayout`, and note-bound geometry such as
   `NoteBounds`.
4. Lock the layout mode contract to the three roadmap modes only:
   `infiniteScore`, `documentEven`, and `document`, with no extra aliases or
   partially overlapping variants.
5. Shape `RendererConfig` around stable cross-mode concerns only, including
   viewport or page dimensions, spacing and layout options, backend-neutral
   rendering options, and the feature flags needed to select layout behavior.
6. Define a two-phase public contract with `measure()` for deterministic layout
   planning and `render()` for exact draw-time execution, while leaving the
   implementation of those phases to the next roadmap step.
7. Treat renderer geometry as a first-class output by defining measure-level
   boxes and positions, staff or system placement, and note-bound geometry that
   is suitable for playback overlays and interaction layers.
8. Keep the contracts backend-neutral so the same renderer surface can work with
   React Native Skia now and other rendering backends later, while concrete
   drawing adapters remain outside this step.
9. State the non-goals directly so this step stays narrow: no engine internals,
   no chunking implementation details, no React helpers, no UI orchestration
   hooks, and no MusicXML loader behavior.
10. End the step with an implementation handoff: roadmap step 5 implements the
    declared `measure()` and `render()` contracts, step 6 fills in the
    mode-specific layout strategies, and step 7 separates engine outputs from
    React and UI orchestration concerns.
