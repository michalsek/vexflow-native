# Draw directly with VexFlow (`vexflow-native`)

The root entry point exports `VexflowCanvas`, the low-level bridge: a Skia
canvas whose `onDraw` receives a VexFlow `RenderContext` (`ctx`) plus the
canvas `width`/`height`. Use it when you want direct VexFlow control instead
of the typed score model.

```tsx
import { useCallback } from 'react';
import { useFonts } from '@shopify/react-native-skia';
import { Formatter, Stave, StaveNote, Voice } from 'vexflow';
import { VexflowCanvas, type OnDrawParams } from 'vexflow-native';

import bravuraFont from './assets/fonts/Bravura.otf';

export function DirectVexFlow() {
  const fontManager = useFonts({ Bravura: [bravuraFont] });

  const onDraw = useCallback(({ ctx }: OnDrawParams) => {
    const stave = new Stave(10, 40, 400);

    stave.addClef('treble').addTimeSignature('4/4');

    const notes = ['c/4', 'd/4', 'e/4', 'f/4'].map(
      (key) => new StaveNote({ keys: [key], duration: 'q' })
    );

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
    <VexflowCanvas
      onDraw={onDraw}
      fontManager={fontManager}
      defaultFont="Bravura"
    />
  );
}
```

The same entry point exposes the recording layer `ScoreRenderer` is built
on: `VexflowRecordingContext` records VexFlow drawing commands,
`renderVexflowRecordingCommands` replays them into a Skia canvas with
optional per-group `VexflowStyleOverride`s, and `buildVexflowGroupIndex`
indexes the recorded commands by group id.
