import React, { useCallback } from 'react';
import { useFonts } from '@shopify/react-native-skia';

import { Formatter, Stave, StaveNote, Voice } from 'vexflow';
import { VexflowCanvas, type OnDrawParams } from 'vexflow-native';

import bravuraFont from '../../assets/fonts/Bravura.otf';
import { Screen } from '../components';

const SimpleExample: React.FC = () => {
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
    <Screen
      safeAreaEdges={['left', 'right', 'bottom']}
      style={{ backgroundColor: 'white' }}
    >
      <VexflowCanvas
        onDraw={onDraw}
        fontManager={fontManager}
        defaultFont="Bravura"
      />
    </Screen>
  );
};

export default SimpleExample;
