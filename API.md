## Component API

`VexflowCanvas` props:

- `onDraw: ({ ctx, width, height }) => void` (required)
- `font: require('.../Bravura.otf')` (required)
- `width?: number` (defaults to window width with internal margin)
- `height?: number` (default: `180`)
- `colorScheme?: 'light' | 'dark'` (default: `'light'`)

## Supported Public API

Runtime exports from `vexflow-native`:

- `VexflowCanvas`
- `SkiaVexflowContext`
- `VEXFLOW_SCORE_COLORS`
- `parseCssFontShorthand`
- `toPxFontSize`

Runtime exports from `vexflow-native/renderer`:

- `RendererCore`
- `createRendererEngine`

Type exports from `vexflow-native`:

- `VexflowCanvasProps`
- `VexflowCanvasDrawArgs`
- `LineCap`
- `LineJoin`
- `ParsedCssFont`

Type exports from `vexflow-native/state`:

- `Id`
- `Clef`
- `Step`
- `Accidental`
- `NoteLength`
- `StemDirection`
- `Barline`
- `Articulation`
- `Dynamic`
- `KeyMode`
- `Fraction`
- `Pitch`
- `Duration`
- `KeySignature`
- `Meter`
- `Tempo`
- `Note`
- `Rest`
- `Chord`
- `VoiceItem`
- `Voice`
- `Measure`
- `Staff`
- `ScoreMetadata`
- `Score`

Type exports from `vexflow-native/renderer`:

- `RendererScore`
- `RendererStaff`
- `RendererMeasure`
- `RendererVoice`
- `RendererVoiceItem`
- `RendererPoint`
- `RendererSize`
- `RendererRect`
- `RendererInsets`
- `RendererLayoutMode`
- `RendererViewport`
- `RendererSpacingOptions`
- `RendererRenderOptions`
- `RendererConfig`
- `InfiniteScoreRendererConfig`
- `NormalizedRendererSpacingOptions`
- `NormalizedRendererRenderOptions`
- `NormalizedRendererConfig`
- `MeasureRange`
- `PagePlan`
- `SystemPlan`
- `StaffPlan`
- `ResolvedMeasureState`
- `MeasureDisplayPlan`
- `MeasurePlan`
- `RendererPlan`
- `MeasureLayout`
- `NoteBounds`
- `MeasureRequest`
- `RenderRequest`
- `RenderResult`
- `RendererEngine`

## Notes

- `onDraw` is re-run when canvas size, color scheme, or callback identity changes.
- Keep `onDraw` wrapped in `useCallback` to avoid unnecessary redraws.
