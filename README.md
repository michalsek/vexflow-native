# vexflow-native

React Native Skia bridge for rendering VexFlow music notation.

## Installation

Install the library and its peer dependencies:

```sh
npm install vexflow-native react react-native vexflow @shopify/react-native-skia react-native-gesture-handler react-native-reanimated react-native-worklets
```

`ScoreRenderer` uses gesture handling and Reanimated worklets for scrolling, so
configure `react-native-gesture-handler`, `react-native-reanimated`, and
`react-native-worklets` as required by your React Native app.

## Entrypoints

- `vexflow-native` exports the low-level `VexflowCanvas` bridge for drawing with
  VexFlow directly.
- `vexflow-native/renderer` exports `ScoreRenderer`, a React component that
  renders the typed score model.
- `vexflow-native/state` exports the score state types, including `Score`.
- `vexflow-native/musicxml` exports `parseMusicXmlToScore` and
  `MusicXmlParseError`.

## Fonts

Load a notation font with Skia and pass the returned font provider to the
renderer. The `defaultFont` prop must match one of the font family names passed
to `useFonts`.

```tsx
import { useFonts } from '@shopify/react-native-skia';

import bravuraFont from './assets/fonts/Bravura.otf';

const fontManager = useFonts({
  Bravura: [bravuraFont],
});

if (!fontManager) {
  return null;
}
```

## React Native Skia web patches

The example app includes a `patch-package` patch for
`@shopify/react-native-skia@2.6.2` at
`example/patches/@shopify+react-native-skia+2.6.2.patch`. The repository root
applies it after install with:

```sh
yarn workspace vexflow-native-example apply-patches
```

The patch is needed by the web example with this Skia version. It:

- lets Skia web resolve string asset sources;
- forwards `JsiSkTypefaceFontProvider.matchFamilyStyle` to CanvasKit so fonts
  registered with `useFonts` can be matched by family name;
- keeps a small diagnostic log in the web font manager patch.

Native iOS and Android usage does not need this example patch. If your own app
targets React Native Web with `@shopify/react-native-skia@2.6.2` and hits font
matching or asset source issues, apply an equivalent patch in your app with
`patch-package`. Re-check the patch when upgrading Skia, because it is tied to
that package version and may become unnecessary after upstream changes.

## Render MusicXML

Convert a MusicXML string into a `Score`, then render it with `ScoreRenderer`.

```tsx
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useFonts } from '@shopify/react-native-skia';
import { ScoreRenderer } from 'vexflow-native/renderer';
import {
  MusicXmlParseError,
  parseMusicXmlToScore,
} from 'vexflow-native/musicxml';

import bravuraFont from './assets/fonts/Bravura.otf';

type MusicXmlScoreProps = {
  xml: string;
};

export function MusicXmlScore({ xml }: MusicXmlScoreProps) {
  const fontManager = useFonts({
    Bravura: [bravuraFont],
  });
  const score = useMemo(
    () => parseMusicXmlToScore(xml, { scoreId: 'imported-score' }),
    [xml]
  );

  if (!fontManager) {
    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <ScoreRenderer
        score={score}
        defaultFont="Bravura"
        fontManager={fontManager}
      />
    </View>
  );
}

try {
  parseMusicXmlToScore('<score-timewise />');
} catch (error) {
  if (error instanceof MusicXmlParseError) {
    // The current parser targets score-partwise MusicXML.
  }
}
```

The MusicXML parser currently targets `score-partwise` documents. `score-timewise`
input throws `MusicXmlParseError`.

## Render a Plain Score Object

Use `ScoreRenderer` directly when you already have score state or want to build
it yourself.

```tsx
import React from 'react';
import { View } from 'react-native';
import { useFonts } from '@shopify/react-native-skia';
import { ScoreRenderer } from 'vexflow-native/renderer';
import type { Score } from 'vexflow-native/state';

import bravuraFont from './assets/fonts/Bravura.otf';

const score: Score = {
  id: 'plain-score',
  defaults: {
    meter: {
      beats: 4,
      beatUnit: 4,
    },
    keySignature: {
      tonic: 'C',
      mode: 'major',
    },
  },
  staves: [
    {
      id: 'staff-1',
      order: 0,
      defaultClef: 'treble',
      measures: [
        {
          id: 'measure-1',
          number: 1,
          leftModifiers: {
            showClef: true,
            showKeySignature: true,
            showMeter: true,
          },
          voices: [
            {
              id: 'voice-1',
              index: 0,
              items: [
                {
                  id: 'note-1',
                  type: 'note',
                  pitch: { step: 'C', octave: 4 },
                  duration: { length: 'q' },
                  voiceId: 'voice-1',
                },
                {
                  id: 'note-2',
                  type: 'note',
                  pitch: { step: 'D', octave: 4 },
                  duration: { length: 'q' },
                  voiceId: 'voice-1',
                },
                {
                  id: 'note-3',
                  type: 'note',
                  pitch: { step: 'E', octave: 4 },
                  duration: { length: 'q' },
                  voiceId: 'voice-1',
                },
                {
                  id: 'note-4',
                  type: 'note',
                  pitch: { step: 'F', octave: 4 },
                  duration: { length: 'q' },
                  voiceId: 'voice-1',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export function PlainScore() {
  const fontManager = useFonts({
    Bravura: [bravuraFont],
  });

  if (!fontManager) {
    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <ScoreRenderer
        score={score}
        defaultFont="Bravura"
        fontManager={fontManager}
        rendererType="document"
      />
    </View>
  );
}
```

`rendererType` is optional. The default is `document`; use `documentEven` for
even measure widths across document systems, or `infiniteScore` for a horizontal
single-system layout.

## Drum Notation

Percussion scores use the same score model: pick the `percussion` clef, set
alternate noteheads and ghost flags on pitches, and attach articulations
through `score.attachments`.

```tsx
import type { NoteAttachment, Pitch } from 'vexflow-native/state';

const hiHat: Pitch = { step: 'G', octave: 5, notehead: 'x' };
const ghostSnare: Pitch = { step: 'C', octave: 5, ghost: true };
const accentedSnare: Pitch = { step: 'C', octave: 5, accent: true };

const accent: NoteAttachment = {
  id: 'accent-1',
  ownerId: 'note-1',
  type: 'articulation',
  articulation: 'accent',
  placement: 'above',
};

const flam: NoteAttachment = {
  id: 'flam-1',
  ownerId: 'note-1',
  type: 'grace',
  slash: true,
  notes: [{ pitch: { step: 'C', octave: 5 }, duration: { length: '8' } }],
};

const drag: NoteAttachment = {
  id: 'drag-1',
  ownerId: 'note-2',
  type: 'grace',
  notes: [
    { pitch: { step: 'C', octave: 5 }, duration: { length: '16' } },
    { pitch: { step: 'C', octave: 5 }, duration: { length: '16' } },
  ],
};
```

- `pitch.notehead`: `x`, `circle-x`, `diamond`, `circle`, `square`, `triangle`,
  `triangle-down`, or `slash`.
- `pitch.ghost`: wraps the notehead in parentheses.
- `pitch.accent`: draws one accent (`>`) above the note or chord, however many
  of its pitches are flagged; skipped when the owner already has an `accent`
  articulation attachment.
- Articulation attachments accept an optional `placement` of `above` (default)
  or `below`.
- Grace attachments draw their `notes` before the owner (a flam is one slashed
  grace 8th, a drag two beamed grace 16ths); `slash` adds the acciaccatura
  slash through the first stem. Grace notes stem up unless the owner's
  `stemDirection` is `down`.

See `example/src/screens/DrumKitExample.tsx` for a full drum-kit groove with
two voices, a triplet, an open hi-hat accent, a flam and a drag.

## Draw Directly with VexFlow

Use `VexflowCanvas` when you want direct VexFlow control instead of the typed
score model.

```tsx
import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useFonts } from '@shopify/react-native-skia';
import { Formatter, Stave, StaveNote, Voice } from 'vexflow';
import { VexflowCanvas, type OnDrawParams } from 'vexflow-native';

import bravuraFont from './assets/fonts/Bravura.otf';

export function DirectVexFlow() {
  const fontManager = useFonts({
    Bravura: [bravuraFont],
  });

  const onDraw = useCallback(({ ctx }: OnDrawParams) => {
    const stave = new Stave(10, 40, 400);

    stave.addClef('treble').addTimeSignature('4/4');

    const notes = [
      new StaveNote({ keys: ['c/4'], duration: 'q' }),
      new StaveNote({ keys: ['d/4'], duration: 'q' }),
      new StaveNote({ keys: ['e/4'], duration: 'q' }),
      new StaveNote({ keys: ['f/4'], duration: 'q' }),
    ];

    const voice = new Voice({ numBeats: 4, beatValue: 4 });
    voice.addTickables(notes);

    new Formatter().joinVoices([voice]).formatToStave([voice], stave);

    stave.setContext(ctx).draw();
    voice.draw(ctx, stave);
  }, []);

  if (!fontManager) {
    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <VexflowCanvas
        onDraw={onDraw}
        fontManager={fontManager}
        defaultFont="Bravura"
      />
    </View>
  );
}
```

## ScoreRenderer props

- `score`: typed score state to render.
- `defaultFont`: font family name used as the default VexFlow font.
- `fontManager`: Skia font provider returned by `useFonts`.
- `colorScheme`: optional foreground, background, and ledger line colors.
- `itemStyleOverrides`: optional Reanimated shared value mapping score item ids
  to replay-time fill/stroke color, glow, and dash overrides.
- `rendererType`: `document`, `documentEven`, or `infiniteScore`.
- `options`: optional renderer settings grouped by `insets`, `spacing`, and
  `render`; `render.scale` uniformly scales the notation without quality loss.
- `scrollEnabled`: enables or disables pan scrolling. Defaults to `true`.
- `showScrollbars`: shows scrollbars when the score overflows. Defaults to
  `true`.
- `scrollOffset`: optional controlled Reanimated shared value for the scroll
  position along the renderer's axis. The renderer reads and writes it (pan
  gesture, clamping), and external writes move the content — the seam for
  playback auto-scroll. Must stay the same shared value for the component's
  lifetime.
- `playhead`: optional Reanimated shared value positioning a playhead overlay
  (`{ x, y, height }` in `onItemsLayout` coordinates, `null` hides it). The
  overlay tracks scrolling on the UI thread without re-recording the score.
- `playheadStyle`: optional playhead appearance (`color`, `width`,
  `borderRadius`, `opacity`); defaults derive from the color scheme
  foreground.
- `onScrollGeometry`: optional callback fired when the scroll envelope
  changes (`axis`, `viewportSize`, `contentSize`, `maxScroll`) — everything a
  consumer needs to compute follow-scroll targets.
- `onItemsLayout`: optional callback fired after each recording pass with the
  view-space geometry (at scroll offset 0) of rendered items and measures,
  including each measure's system band `y`/`height`.
- `onReady`: optional callback fired once per mount, when the first score
  picture has been rasterized for a non-empty viewport. Later re-records
  (resize, option changes) do not re-fire it — the seam for hiding a loading
  indicator once the score is actually on screen.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
