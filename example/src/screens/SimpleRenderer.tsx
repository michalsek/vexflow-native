import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useFonts } from '@shopify/react-native-skia';

import { ScoreRenderer } from 'vexflow-native/renderer';
import type { Score } from 'vexflow-native/state';

import bravuraFont from '../../assets/fonts/Bravura.otf';
import { Screen } from '../components';

const SimpleRenderer: React.FC = () => {
  const [score, setScore] = useState<Score>(getInitialScore());
  const fontManager = useFonts({
    Bravura: [bravuraFont],
  });

  if (!fontManager) {
    return null;
  }

  return (
    <Screen
      safeAreaEdges={['left', 'right', 'bottom']}
      style={styles.container}
    >
      <ScoreRenderer
        score={score}
        defaultFont="Bravura"
        fontManager={fontManager}
      />
    </Screen>
  );
};

export default SimpleRenderer;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white', // TMP: until vexflow canvas supports theming
  },
});

function getInitialScore(): Score {
  return {
    id: 'score-1',
    metadata: {
      title: 'Untitled Score',
      composer: 'Unknown Composer',
    },
    defaultMeter: {
      beats: 4,
      beatUnit: 4,
    },
    defaultKeySignature: {
      tonic: 'C',
      mode: 'major',
    },
    staves: [
      {
        id: 'stave-1',
        order: 0,
        clef: 'treble',
        measures: [
          {
            id: 'measure-1',
            number: 0,
            voices: [
              {
                id: 'voice-1',
                index: 0,
                items: [
                  {
                    id: 'note-1',
                    type: 'note',
                    pitch: {
                      step: 'C',
                      octave: 4,
                    },
                    duration: {
                      length: 'q',
                    },
                    voiceId: 'voice-1',
                  },
                  {
                    id: 'note-2',
                    type: 'note',
                    pitch: {
                      step: 'D',
                      octave: 4,
                    },
                    duration: {
                      length: 'q',
                    },
                    voiceId: 'voice-1',
                  },
                  {
                    id: 'note-3',
                    type: 'note',
                    pitch: {
                      step: 'E',
                      octave: 4,
                    },
                    duration: {
                      length: 'q',
                    },
                    voiceId: 'voice-1',
                  },
                  {
                    id: 'note-4',
                    type: 'note',
                    pitch: {
                      step: 'F',
                      octave: 4,
                    },
                    duration: {
                      length: 'q',
                    },
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
}
