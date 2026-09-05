import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFonts } from '@shopify/react-native-skia';

import { ScoreRenderer } from 'vexflow-native/renderer';
import type {
  Chord,
  DurationValue,
  Note,
  NoteAttachment,
  Pitch,
  Score,
  Voice,
  VoiceItem,
} from 'vexflow-native/state';
import bravuraFont from '../../assets/fonts/Bravura.otf';
import { Column, Screen } from '../components';
import { useColorScheme } from '../hooks/useColorScheme';
import {
  getScoreRendererColorScheme,
  SCORE_RENDERER_BACKGROUND,
} from './ScoreRendererColorScheme';

// Standard drum-kit staff positions (percussion clef):
// closed/open hi-hat above the top line, snare in the third space,
// kick in the bottom space.
const HI_HAT: Pitch = { step: 'G', octave: 5, notehead: 'x' };
const OPEN_HI_HAT: Pitch = { step: 'G', octave: 5, notehead: 'circle-x' };
const SNARE: Pitch = { step: 'C', octave: 5 };
const GHOST_SNARE: Pitch = { step: 'C', octave: 5, ghost: true };
const KICK: Pitch = { step: 'F', octave: 4 };

const SIXTEENTH: DurationValue = { length: '16' };
const EIGHTH: DurationValue = { length: '8' };
const QUARTER: DurationValue = { length: 'q' };

function note(
  id: string,
  voiceId: string,
  pitch: Pitch,
  duration: DurationValue,
  stemDirection: Note['stemDirection']
): Note {
  return { id, type: 'note', voiceId, pitch, duration, stemDirection };
}

function chord(
  id: string,
  voiceId: string,
  pitches: Pitch[],
  duration: DurationValue,
  stemDirection: Chord['stemDirection']
): Chord {
  return { id, type: 'chord', voiceId, pitches, duration, stemDirection };
}

function handsVoice(
  id: string,
  items: (voiceId: string) => VoiceItem[]
): Voice {
  return { id, index: 0, items: items(id) };
}

function feetVoice(id: string, measure: number): Voice {
  return {
    id,
    index: 1,
    items: [1, 2, 3, 4].map((beat) =>
      note(`drums-m${measure}-kick-${beat}`, id, KICK, QUARTER, 'down')
    ),
  };
}

// Two-bar rock groove: hi-hat 8ths (one open-hat accent), snare backbeat with
// a ghost note, a flam and a drag, kick quarters, and a hi-hat triplet on beat
// three. Voices use the default strict timing mode, so the 3:2 triplet
// exercises strict-mode tick scaling.
export function createDrumKitScore(): Score {
  const measureOne = {
    id: 'drums-m1',
    number: 1,
    voices: [
      handsVoice('drums-m1-hands', (voiceId) => [
        note('drums-m1-hh-1', voiceId, HI_HAT, EIGHTH, 'up'),
        note('drums-m1-hh-2', voiceId, HI_HAT, EIGHTH, 'up'),
        chord('drums-m1-sn-1', voiceId, [SNARE, HI_HAT], EIGHTH, 'up'),
        note('drums-m1-hh-3', voiceId, HI_HAT, EIGHTH, 'up'),
        // Beat three: a strict-mode 3:2 triplet with a ghost snare inside.
        note('drums-m1-trip-1', voiceId, HI_HAT, EIGHTH, 'up'),
        note('drums-m1-trip-2', voiceId, GHOST_SNARE, EIGHTH, 'up'),
        note('drums-m1-trip-3', voiceId, HI_HAT, EIGHTH, 'up'),
        chord('drums-m1-sn-2', voiceId, [SNARE, HI_HAT], EIGHTH, 'up'),
        note('drums-m1-open-hh', voiceId, OPEN_HI_HAT, EIGHTH, 'up'),
      ]),
      feetVoice('drums-m1-feet', 1),
    ],
  };

  const measureTwo = {
    id: 'drums-m2',
    number: 2,
    leftModifiers: { showMeter: true },
    voices: [
      handsVoice('drums-m2-hands', (voiceId) => [
        note('drums-m2-hh-1', voiceId, HI_HAT, EIGHTH, 'up'),
        note('drums-m2-hh-2', voiceId, HI_HAT, EIGHTH, 'up'),
        chord('drums-m2-sn-1', voiceId, [SNARE, HI_HAT], EIGHTH, 'up'),
        note('drums-m2-hh-3', voiceId, HI_HAT, EIGHTH, 'up'),
        note('drums-m2-hh-4', voiceId, HI_HAT, EIGHTH, 'up'),
        chord('drums-m2-gh-1', voiceId, [GHOST_SNARE, HI_HAT], EIGHTH, 'up'),
        chord('drums-m2-sn-2', voiceId, [SNARE, HI_HAT], EIGHTH, 'up'),
        note('drums-m2-hh-5', voiceId, HI_HAT, EIGHTH, 'up'),
      ]),
      feetVoice('drums-m2-feet', 2),
    ],
  };

  const attachments: NoteAttachment[] = [
    {
      id: 'drums-m1-open-hh-accent',
      ownerId: 'drums-m1-open-hh',
      type: 'articulation',
      articulation: 'accent',
    },
    {
      id: 'drums-m1-sn-1-flam',
      ownerId: 'drums-m1-sn-1',
      type: 'grace',
      slash: true,
      notes: [{ pitch: SNARE, duration: EIGHTH }],
    },
    {
      id: 'drums-m2-sn-2-drag',
      ownerId: 'drums-m2-sn-2',
      type: 'grace',
      notes: [
        { pitch: SNARE, duration: SIXTEENTH },
        { pitch: SNARE, duration: SIXTEENTH },
      ],
    },
  ];

  return {
    id: 'drum-kit-example',
    metadata: {
      title: 'Drum Kit Groove',
      composer: 'vexflow-native examples',
    },
    defaults: {
      meter: {
        beats: 4,
        beatUnit: 4,
      },
    },
    staves: [
      {
        id: 'drums',
        order: 0,
        defaultClef: 'percussion',
        measures: [measureOne, measureTwo],
      },
    ],
    attachments,
    tuplets: [
      {
        id: 'drums-m1-triplet',
        voiceId: 'drums-m1-hands',
        itemIds: ['drums-m1-trip-1', 'drums-m1-trip-2', 'drums-m1-trip-3'],
        ratio: { num: 3, den: 2 },
        bracketed: true,
      },
    ],
  };
}

const DrumKitExample: React.FC = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [score] = useState(() => createDrumKitScore());
  const scoreColorScheme = useMemo(
    () => getScoreRendererColorScheme(isDark),
    [isDark]
  );
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
      padding={0}
    >
      <Column gap={12} style={styles.content}>
        <View
          style={[
            styles.viewportCard,
            isDark ? styles.viewportCardDark : styles.viewportCardLight,
          ]}
        >
          <ScoreRenderer
            score={score}
            defaultFont="Bravura"
            fontManager={fontManager}
            colorScheme={scoreColorScheme}
            rendererType="documentEven"
          />
        </View>
      </Column>
    </Screen>
  );
};

export default DrumKitExample;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  viewportCard: {
    flex: 1,
    overflow: 'hidden',
  },
  viewportCardDark: {
    backgroundColor: SCORE_RENDERER_BACKGROUND.dark,
  },
  viewportCardLight: {
    backgroundColor: SCORE_RENDERER_BACKGROUND.light,
  },
});
