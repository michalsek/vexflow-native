# vexflow-native

Render VexFlow music notation in React Native using Skia.

## What This Library Provides

- `VexflowCanvas`: React component that creates a Skia canvas and gives you a VexFlow-compatible render context.
- `SkiaVexflowContext`: low-level context implementation (you usually do not need to use it directly).

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

## Notes

- `onDraw` is re-run when canvas size, color scheme, or callback identity changes.
- Keep `onDraw` wrapped in `useCallback` to avoid unnecessary redraws.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
