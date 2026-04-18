# vexflow-native

Low-level React Native Skia bridge for rendering VexFlow music notation.

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

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
