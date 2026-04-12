# vexflow-native

Low-level React Native Skia bridge for rendering VexFlow music notation.

## What This Package Is

`vexflow-native` now exposes two renderer-facing layers:

- `VexflowCanvas` creates a Skia canvas and calls your drawing callback with a VexFlow-compatible render context.
- `SkiaVexflowContext` adapts React Native Skia to the VexFlow render context contract.
- `vexflow-native/renderer` provides a renderer core with explicit `measure()` and `render()` phases for deterministic planning and playback-ready geometry.
- The package root still exports the low-level bridge types, helpers, and score color presets that are safe to consume directly.

## Non-Goals For This Step

- No document-style renderer modes yet. The current core ships `infiniteScore` only.
- No MusicXML parser or loader yet.

## Public Entry Points

The package currently exposes these top-level imports:

```ts
import { VexflowCanvas } from 'vexflow-native';
import type { Meter, Score } from 'vexflow-native/state';
import {
  RendererCore,
  createRendererEngine,
  type MeasureRequest,
  type RendererConfig,
  type RendererPlan,
} from 'vexflow-native/renderer';
import {} from 'vexflow-native/musicxml';
```

`vexflow-native/state` exposes the canonical notation data contract used by
later renderer and MusicXML layers. `vexflow-native/renderer` now exposes the
runtime renderer core on top of that state model, including explicit
measure/render phase contracts, deterministic layout-planning output, and exact
geometry output for playback/highlighting. `vexflow-native/musicxml` remains a
reserved first-class entrypoint until that contract lands in a later roadmap
step.

## Installation

Install the library and its peer dependencies:

```sh
npm install vexflow-native vexflow @shopify/react-native-skia
```

## Basic Usage

```tsx
import React, { useCallback } from 'react';
import { View } from 'react-native';
import { Formatter, Stave, StaveNote, Voice } from 'vexflow';
import { VexflowCanvas, type VexflowCanvasDrawArgs } from 'vexflow-native';

export default function ScoreExample() {
  const font = require('./assets/fonts/Bravura.otf');

  const onDraw = useCallback(({ ctx, width }: VexflowCanvasDrawArgs) => {
    const stave = new Stave(10, 40, width - 20);
    stave.addClef('treble').addTimeSignature('4/4');
    stave.setContext(ctx).draw();

    const notes = [
      new StaveNote({ clef: 'treble', keys: ['c/4'], duration: 'q' }),
      new StaveNote({ clef: 'treble', keys: ['d/4'], duration: 'q' }),
      new StaveNote({ clef: 'treble', keys: ['e/4'], duration: 'q' }),
      new StaveNote({ clef: 'treble', keys: ['f/4'], duration: 'q' }),
    ];

    const voice = new Voice({ num_beats: 4, beat_value: 4 });
    voice.addTickables(notes);

    new Formatter().joinVoices([voice]).format([voice], width - 80);
    voice.draw(ctx, stave);
  }, []);

  return (
    <View style={{ padding: 16 }}>
      <VexflowCanvas
        onDraw={onDraw}
        font={font}
        height={180}
        colorScheme="light"
      />
    </View>
  );
}
```

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

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
