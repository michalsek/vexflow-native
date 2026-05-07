import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFonts } from '@shopify/react-native-skia';

import { ScoreRenderer } from 'vexflow-native/renderer';
import type {
  Accidental,
  Chord,
  Direction,
  DurationValue,
  Measure,
  MeasureState,
  LyricAttachment,
  Note,
  Pitch,
  Score,
  Voice,
  VoiceItem,
} from 'vexflow-native/state';

import bravuraFont from '../../assets/fonts/Bravura.otf';
import { Column, DropDown, Row, Screen } from '../components';
import { useColorScheme } from '../hooks/useColorScheme';
import {
  getScoreRendererColorScheme,
  SCORE_RENDERER_BACKGROUND,
} from './ScoreRendererColorScheme';

type RendererMode = 'documentEven' | 'document' | 'infiniteScore';

const RENDERER_OPTIONS = [
  { label: 'Document Even', value: 'documentEven' as const },
  { label: 'Document Auto', value: 'document' as const },
  { label: 'Infinite Score', value: 'infiniteScore' as const },
];

type ScoreFixtureContext = {
  lyricAttachments: LyricAttachment[];
};

type MeasureFixtureOverrides = Pick<
  Measure,
  'state' | 'leftModifiers' | 'rightModifiers'
> & {
  directionLabel?: string;
};

let activeFixtureContext: ScoreFixtureContext | null = null;

// This file is exempt from the max lines rule
const SimpleRenderer: React.FC = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [rendererType, setRendererType] =
    useState<RendererMode>('documentEven');
  const [score] = useState<Score>(() => getInitialScore());
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
        <Row
          align="center"
          justify="space-between"
          gap={12}
          style={styles.header}
        >
          <View style={styles.modeControl}>
            <DropDown
              options={RENDERER_OPTIONS}
              value={rendererType}
              onChange={(value) => setRendererType(value as RendererMode)}
            />
          </View>
        </Row>

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
            rendererType={rendererType}
          />
        </View>
      </Column>
    </Screen>
  );
};

export default SimpleRenderer;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  modeControl: {
    flex: 1,
    maxWidth: 240,
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

function getInitialScore(): Score {
  const fixtureContext: ScoreFixtureContext = {
    lyricAttachments: [],
  };

  activeFixtureContext = fixtureContext;

  try {
    const topMeasures = createTopMeasures();
    const bottomMeasures = createBottomMeasures();
    const selectedItemIds = new Set([
      ...topMeasures.flatMap((measure) =>
        measure.voices.flatMap((voice) => voice.items.map((item) => item.id))
      ),
      ...bottomMeasures.flatMap((measure) =>
        measure.voices.flatMap((voice) => voice.items.map((item) => item.id))
      ),
    ]);

    return {
      id: 'simple-renderer-showcase',
      metadata: {
        title: 'Renderer Showcase Study',
        composer: 'vexflow-native examples',
      },
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
          id: 'showcase-top-staff',
          order: 0,
          defaultClef: 'treble',
          measures: topMeasures,
        },
        {
          id: 'showcase-bottom-staff',
          order: 1,
          defaultClef: 'bass',
          measures: bottomMeasures,
        },
      ],
      staffGroups: [
        {
          id: 'showcase-piano',
          role: 'grandStaff',
          symbol: 'brace',
          staffIds: ['showcase-top-staff', 'showcase-bottom-staff'],
        },
      ],
      attachments: fixtureContext.lyricAttachments.filter((attachment) =>
        selectedItemIds.has(attachment.ownerId)
      ),
    };
  } finally {
    activeFixtureContext = null;
  }
}

const COMMON_TIME: MeasureState['meter'] = {
  beats: 4,
  beatUnit: 4,
};

const COMPOUND_BEAM_METER: MeasureState['meter'] = {
  beats: 6,
  beatUnit: 8,
  beamGroups: [
    { num: 3, den: 8 },
    { num: 3, den: 8 },
  ],
};

function createTopMeasures(): Measure[] {
  return [
    createMeasure(
      'top',
      1,
      1,
      [
        createVoice('top', 1, 1, 0, (voiceId) => [
          note(voiceId, 'top-s1-m1-v1-n1', 'C', 4, 'q'),
          note(voiceId, 'top-s1-m1-v1-n2', 'E', 4, 'q', { accidental: 'b' }),
          note(voiceId, 'top-s1-m1-v1-n3', 'E', 4, 'q', { accidental: 'n' }),
          note(voiceId, 'top-s1-m1-v1-n4', 'F', 4, 'q', { accidental: '#' }),
        ]),
      ],
      { directionLabel: 'Accidentals' }
    ),
    createMeasure('top', 1, 2, [
      createVoice('top', 1, 2, 0, (voiceId) => [
        note(voiceId, 'top-s1-m2-v1-n1', 'G', 4, 'q'),
        note(voiceId, 'top-s1-m2-v1-n2', 'A', 4, 'q', { accidental: 'b' }),
        note(voiceId, 'top-s1-m2-v1-n3', 'A', 4, 'q', { accidental: 'n' }),
        note(voiceId, 'top-s1-m2-v1-n4', 'B', 4, 'q', { accidental: 'b' }),
      ]),
    ]),
    createMeasure('top', 1, 3, [
      createVoice('top', 1, 3, 0, (voiceId) => [
        chord(
          voiceId,
          'top-s1-m3-v1-c1',
          [p('C', 4), p('E', 4, 'b'), p('G', 4)],
          'h'
        ),
        chord(
          voiceId,
          'top-s1-m3-v1-c2',
          [p('D', 4), p('F', 4, '#'), p('A', 4)],
          'h'
        ),
      ]),
    ]),
    createMeasure('top', 1, 4, [
      createVoice('top', 1, 4, 0, (voiceId) => [
        note(voiceId, 'top-s1-m4-v1-n1', 'B', 4, 'q', { accidental: 'n' }),
        note(voiceId, 'top-s1-m4-v1-n2', 'C', 5, 'q', { accidental: '#' }),
        note(voiceId, 'top-s1-m4-v1-n3', 'D', 5, 'q'),
        note(voiceId, 'top-s1-m4-v1-n4', 'E', 5, 'q', { accidental: 'b' }),
      ]),
    ]),
    createMeasure('top', 1, 5, [
      createVoice('top', 1, 5, 0, (voiceId) => [
        chord(
          voiceId,
          'top-s1-m5-v1-c1',
          [p('A', 3), p('C', 4, '#'), p('E', 4)],
          'h'
        ),
        note(voiceId, 'top-s1-m5-v1-n2', 'B', 4, 'q', { accidental: 'b' }),
        note(voiceId, 'top-s1-m5-v1-n3', 'A', 4, 'q', { accidental: 'n' }),
      ]),
    ]),
    createMeasure(
      'top',
      2,
      6,
      [
        createVoice('top', 2, 6, 0, (voiceId) => [
          note(voiceId, 'top-s2-m6-v1-n1', 'G', 4, 'h', { dots: 1 }),
          note(voiceId, 'top-s2-m6-v1-n2', 'C', 5, 'q'),
        ]),
      ],
      { directionLabel: 'Dotted rhythms' }
    ),
    createMeasure('top', 2, 7, [
      createVoice('top', 2, 7, 0, (voiceId) => [
        note(voiceId, 'top-s2-m7-v1-n1', 'A', 4, 'q', { dots: 1 }),
        note(voiceId, 'top-s2-m7-v1-n2', 'B', 4, '8'),
        note(voiceId, 'top-s2-m7-v1-n3', 'C', 5, 'q', { dots: 1 }),
        note(voiceId, 'top-s2-m7-v1-n4', 'D', 5, '8'),
      ]),
    ]),
    createMeasure('top', 2, 8, [
      createVoice('top', 2, 8, 0, (voiceId) => [
        note(voiceId, 'top-s2-m8-v1-n1', 'E', 5, 'h', { dots: 1 }),
        note(voiceId, 'top-s2-m8-v1-n2', 'D', 5, 'q'),
      ]),
    ]),
    createMeasure('top', 2, 9, [
      createVoice('top', 2, 9, 0, (voiceId) => [
        note(voiceId, 'top-s2-m9-v1-n2', 'B', 4, 'h', { dots: 1 }),
        note(voiceId, 'top-s2-m9-v1-n3', 'A', 4, 'q'),
      ]),
    ]),
    createMeasure('top', 2, 10, [
      createVoice('top', 2, 10, 0, (voiceId) => [
        note(voiceId, 'top-s2-m10-v1-n1', 'G', 4, 'q', { dots: 1 }),
        note(voiceId, 'top-s2-m10-v1-n2', 'A', 4, '8'),
        note(voiceId, 'top-s2-m10-v1-n3', 'B', 4, 'h'),
      ]),
    ]),
    createMeasure(
      'top',
      3,
      11,
      [
        createVoice('top', 3, 11, 0, (voiceId) => [
          note(voiceId, 'top-s3-m11-v1-n1', 'C', 5, '8'),
          note(voiceId, 'top-s3-m11-v1-n2', 'D', 5, '8'),
          note(voiceId, 'top-s3-m11-v1-n3', 'E', 5, '8'),
          note(voiceId, 'top-s3-m11-v1-n4', 'F', 5, '8'),
          note(voiceId, 'top-s3-m11-v1-n5', 'G', 5, '8'),
          note(voiceId, 'top-s3-m11-v1-n6', 'A', 5, '8'),
        ]),
      ],
      { directionLabel: 'Beams', state: { meter: COMPOUND_BEAM_METER } }
    ),
    createMeasure('top', 3, 12, [
      createVoice('top', 3, 12, 0, (voiceId) => [
        note(voiceId, 'top-s3-m12-v1-n1', 'G', 5, '8'),
        note(voiceId, 'top-s3-m12-v1-n2', 'F', 5, '8'),
        note(voiceId, 'top-s3-m12-v1-n3', 'E', 5, '8'),
        note(voiceId, 'top-s3-m12-v1-n4', 'D', 5, '8'),
        note(voiceId, 'top-s3-m12-v1-n5', 'C', 5, '8'),
        note(voiceId, 'top-s3-m12-v1-n6', 'B', 4, '8'),
      ]),
    ]),
    createMeasure('top', 3, 13, [
      createVoice('top', 3, 13, 0, (voiceId) => [
        note(voiceId, 'top-s3-m13-v1-n1', 'A', 4, '8'),
        note(voiceId, 'top-s3-m13-v1-n2', 'B', 4, '8'),
        note(voiceId, 'top-s3-m13-v1-n3', 'C', 5, '8'),
        note(voiceId, 'top-s3-m13-v1-n4', 'D', 5, '8'),
        note(voiceId, 'top-s3-m13-v1-n5', 'E', 5, '8'),
        note(voiceId, 'top-s3-m13-v1-n6', 'F', 5, '8'),
      ]),
    ]),
    createMeasure('top', 3, 14, [
      createVoice('top', 3, 14, 0, (voiceId) => [
        note(voiceId, 'top-s3-m14-v1-n1', 'E', 5, '8'),
        note(voiceId, 'top-s3-m14-v1-n2', 'D', 5, '8'),
        note(voiceId, 'top-s3-m14-v1-n3', 'C', 5, '8'),
        note(voiceId, 'top-s3-m14-v1-n4', 'B', 4, '8'),
        note(voiceId, 'top-s3-m14-v1-n5', 'A', 4, '8'),
        note(voiceId, 'top-s3-m14-v1-n6', 'G', 4, '8'),
      ]),
    ]),
    createMeasure('top', 3, 15, [
      createVoice('top', 3, 15, 0, (voiceId) => [
        note(voiceId, 'top-s3-m15-v1-n1', 'C', 5, '8'),
        note(voiceId, 'top-s3-m15-v1-n2', 'E', 5, '8'),
        note(voiceId, 'top-s3-m15-v1-n3', 'G', 5, '8'),
        note(voiceId, 'top-s3-m15-v1-n4', 'A', 5, '8'),
        note(voiceId, 'top-s3-m15-v1-n5', 'G', 5, '8'),
        note(voiceId, 'top-s3-m15-v1-n6', 'E', 5, '8'),
      ]),
    ]),
    createMeasure(
      'top',
      4,
      16,
      [
        createVoice('top', 4, 16, 0, (voiceId) => [
          note(voiceId, 'top-s4-m16-v1-n1', 'C', 5, 'q', { lyric: 'Words' }),
          note(voiceId, 'top-s4-m16-v1-n2', 'D', 5, 'q', { lyric: 'drift' }),
          note(voiceId, 'top-s4-m16-v1-n3', 'E', 5, 'q', { lyric: 'through' }),
          note(voiceId, 'top-s4-m16-v1-n4', 'F', 5, 'q', { lyric: 'this' }),
        ]),
      ],
      { directionLabel: 'Lyrics', state: { meter: COMMON_TIME } }
    ),
    createMeasure('top', 4, 17, [
      createVoice('top', 4, 17, 0, (voiceId) => [
        note(voiceId, 'top-s4-m17-v1-n1', 'G', 5, 'q', { lyric: 'score' }),
        note(voiceId, 'top-s4-m17-v1-n2', 'A', 5, 'q', { lyric: 'with' }),
        note(voiceId, 'top-s4-m17-v1-n3', 'G', 5, 'q', { lyric: 'warm' }),
        note(voiceId, 'top-s4-m17-v1-n4', 'F', 5, 'q', { lyric: 'light' }),
      ]),
    ]),
    createMeasure('top', 4, 18, [
      createVoice('top', 4, 18, 0, (voiceId) => [
        note(voiceId, 'top-s4-m18-v1-n1', 'E', 5, 'q', { lyric: 'each' }),
        note(voiceId, 'top-s4-m18-v1-n2', 'D', 5, 'q', { lyric: 'bar' }),
        note(voiceId, 'top-s4-m18-v1-n3', 'C', 5, 'q', { lyric: 'now' }),
        note(voiceId, 'top-s4-m18-v1-n4', 'D', 5, 'q', { lyric: 'sings' }),
      ]),
    ]),
    createMeasure('top', 4, 19, [
      createVoice('top', 4, 19, 0, (voiceId) => [
        note(voiceId, 'top-s4-m19-v1-n1', 'E', 5, 'q', { lyric: 'one' }),
        note(voiceId, 'top-s4-m19-v1-n2', 'F', 5, 'q', { lyric: 'plain' }),
        note(voiceId, 'top-s4-m19-v1-n3', 'G', 5, 'q', { lyric: 'tune' }),
        note(voiceId, 'top-s4-m19-v1-n4', 'A', 5, 'q', { lyric: 'for' }),
      ]),
    ]),
    createMeasure('top', 4, 20, [
      createVoice('top', 4, 20, 0, (voiceId) => [
        note(voiceId, 'top-s4-m20-v1-n1', 'G', 5, 'q', { lyric: 'the' }),
        note(voiceId, 'top-s4-m20-v1-n2', 'F', 5, 'q', { lyric: 'page' }),
        note(voiceId, 'top-s4-m20-v1-n3', 'E', 5, 'q', { lyric: 'to' }),
        note(voiceId, 'top-s4-m20-v1-n4', 'D', 5, 'q', { lyric: 'hold' }),
      ]),
    ]),
    createMeasure(
      'top',
      5,
      21,
      [
        createVoice('top', 5, 21, 0, (voiceId) => [
          note(voiceId, 'top-s5-m21-v1-n1', 'E', 5, 'q', {
            stemDirection: 'up',
          }),
          note(voiceId, 'top-s5-m21-v1-n2', 'F', 5, 'q', {
            stemDirection: 'up',
          }),
          note(voiceId, 'top-s5-m21-v1-n3', 'G', 5, 'q', {
            stemDirection: 'up',
          }),
          note(voiceId, 'top-s5-m21-v1-n4', 'A', 5, 'q', {
            stemDirection: 'up',
          }),
        ]),
        createVoice('top', 5, 21, 1, (voiceId) => [
          note(voiceId, 'top-s5-m21-v2-n1', 'C', 4, 'h', {
            stemDirection: 'down',
          }),
          note(voiceId, 'top-s5-m21-v2-n2', 'D', 4, 'h', {
            stemDirection: 'down',
          }),
        ]),
      ],
      { directionLabel: 'Two voices' }
    ),
    createMeasure('top', 5, 22, [
      createVoice('top', 5, 22, 0, (voiceId) => [
        note(voiceId, 'top-s5-m22-v1-n1', 'G', 5, 'q', { stemDirection: 'up' }),
        note(voiceId, 'top-s5-m22-v1-n2', 'F', 5, 'q', { stemDirection: 'up' }),
        note(voiceId, 'top-s5-m22-v1-n3', 'E', 5, 'q', { stemDirection: 'up' }),
        note(voiceId, 'top-s5-m22-v1-n4', 'D', 5, 'q', { stemDirection: 'up' }),
      ]),
      createVoice('top', 5, 22, 1, (voiceId) => [
        note(voiceId, 'top-s5-m22-v2-n1', 'B', 3, 'w', {
          stemDirection: 'down',
        }),
      ]),
    ]),
    createMeasure('top', 5, 23, [
      createVoice('top', 5, 23, 0, (voiceId) => [
        chord(
          voiceId,
          'top-s5-m23-v1-c1',
          [p('C', 5), p('E', 5), p('G', 5)],
          'h',
          { stemDirection: 'up' }
        ),
        note(voiceId, 'top-s5-m23-v1-n2', 'A', 5, 'q', { stemDirection: 'up' }),
        note(voiceId, 'top-s5-m23-v1-n3', 'G', 5, 'q', { stemDirection: 'up' }),
      ]),
      createVoice('top', 5, 23, 1, (voiceId) => [
        note(voiceId, 'top-s5-m23-v2-n1', 'E', 4, 'w', {
          stemDirection: 'down',
        }),
      ]),
    ]),
    createMeasure('top', 5, 24, [
      createVoice('top', 5, 24, 0, (voiceId) => [
        note(voiceId, 'top-s5-m24-v1-n1', 'F', 5, 'q'),
        note(voiceId, 'top-s5-m24-v1-n2', 'E', 5, 'q'),
        note(voiceId, 'top-s5-m24-v1-n3', 'D', 5, 'q'),
        note(voiceId, 'top-s5-m24-v1-n4', 'C', 5, 'q'),
      ]),
    ]),
    createMeasure(
      'top',
      5,
      25,
      [
        createVoice('top', 5, 25, 0, (voiceId) => [
          chord(
            voiceId,
            'top-s5-m25-v1-c1',
            [p('C', 5), p('E', 5), p('G', 5)],
            'w'
          ),
        ]),
      ],
      { rightModifiers: { endBarline: 'final' } }
    ),
  ];
}

function createBottomMeasures(): Measure[] {
  return [
    createMeasure(
      'bottom',
      1,
      1,
      [
        createVoice('bottom', 1, 1, 0, (voiceId) => [
          chord(voiceId, 'bottom-s1-m1-v1-c1', [p('C', 3), p('G', 3)], 'w'),
        ]),
      ],
      { directionLabel: 'Accidentals' }
    ),
    createMeasure('bottom', 1, 2, [
      createVoice('bottom', 1, 2, 0, (voiceId) => [
        chord(voiceId, 'bottom-s1-m2-v1-c1', [p('B', 2, 'b'), p('F', 3)], 'h'),
        chord(voiceId, 'bottom-s1-m2-v1-c2', [p('A', 2), p('E', 3)], 'h'),
      ]),
    ]),
    createMeasure('bottom', 1, 3, [
      createVoice('bottom', 1, 3, 0, (voiceId) => [
        chord(
          voiceId,
          'bottom-s1-m3-v1-c1',
          [p('E', 3, 'b'), p('G', 3), p('B', 3, 'b')],
          'w'
        ),
      ]),
    ]),
    createMeasure('bottom', 1, 4, [
      createVoice('bottom', 1, 4, 0, (voiceId) => [
        note(voiceId, 'bottom-s1-m4-v1-n1', 'F', 2, 'h', { accidental: '#' }),
        note(voiceId, 'bottom-s1-m4-v1-n2', 'G', 2, 'h'),
      ]),
    ]),
    createMeasure('bottom', 1, 5, [
      createVoice('bottom', 1, 5, 0, (voiceId) => [
        chord(voiceId, 'bottom-s1-m5-v1-c1', [p('D', 3), p('A', 3)], 'w'),
      ]),
    ]),
    createMeasure(
      'bottom',
      2,
      6,
      [
        createVoice('bottom', 2, 6, 0, (voiceId) => [
          note(voiceId, 'bottom-s2-m6-v1-n1', 'C', 3, 'h', { dots: 1 }),
          note(voiceId, 'bottom-s2-m6-v1-n2', 'G', 2, 'q'),
        ]),
      ],
      { directionLabel: 'Dotted rhythms' }
    ),
    createMeasure('bottom', 2, 7, [
      createVoice('bottom', 2, 7, 0, (voiceId) => [
        note(voiceId, 'bottom-s2-m7-v1-n1', 'F', 2, 'h', { dots: 1 }),
        note(voiceId, 'bottom-s2-m7-v1-n2', 'C', 3, 'q'),
      ]),
    ]),
    createMeasure('bottom', 2, 8, [
      createVoice('bottom', 2, 8, 0, (voiceId) => [
        note(voiceId, 'bottom-s2-m8-v1-n1', 'A', 2, 'h', { dots: 1 }),
        note(voiceId, 'bottom-s2-m8-v1-n2', 'E', 3, 'q'),
      ]),
    ]),
    createMeasure('bottom', 2, 9, [
      createVoice('bottom', 2, 9, 0, (voiceId) => [
        note(voiceId, 'bottom-s2-m9-v1-n1', 'D', 3, 'q', { dots: 1 }),
        note(voiceId, 'bottom-s2-m9-v1-n2', 'E', 3, '8'),
        note(voiceId, 'bottom-s2-m9-v1-n3', 'A', 2, 'h'),
      ]),
    ]),
    createMeasure('bottom', 2, 10, [
      createVoice('bottom', 2, 10, 0, (voiceId) => [
        note(voiceId, 'bottom-s2-m10-v1-n1', 'G', 2, 'h', { dots: 1 }),
        note(voiceId, 'bottom-s2-m10-v1-n2', 'D', 3, 'q'),
      ]),
    ]),
    createMeasure(
      'bottom',
      3,
      11,
      [
        createVoice('bottom', 3, 11, 0, (voiceId) => [
          note(voiceId, 'bottom-s3-m11-v1-n1', 'C', 3, '8'),
          note(voiceId, 'bottom-s3-m11-v1-n2', 'G', 2, '8'),
          note(voiceId, 'bottom-s3-m11-v1-n3', 'A', 2, '8'),
          note(voiceId, 'bottom-s3-m11-v1-n4', 'F', 2, '8'),
          note(voiceId, 'bottom-s3-m11-v1-n5', 'G', 2, '8'),
          note(voiceId, 'bottom-s3-m11-v1-n6', 'E', 2, '8'),
        ]),
      ],
      { directionLabel: 'Beams', state: { meter: COMPOUND_BEAM_METER } }
    ),
    createMeasure('bottom', 3, 12, [
      createVoice('bottom', 3, 12, 0, (voiceId) => [
        note(voiceId, 'bottom-s3-m12-v1-n1', 'F', 2, '8'),
        note(voiceId, 'bottom-s3-m12-v1-n2', 'C', 3, '8'),
        note(voiceId, 'bottom-s3-m12-v1-n3', 'D', 3, '8'),
        note(voiceId, 'bottom-s3-m12-v1-n4', 'B', 2, '8'),
        note(voiceId, 'bottom-s3-m12-v1-n5', 'C', 3, '8'),
        note(voiceId, 'bottom-s3-m12-v1-n6', 'G', 2, '8'),
      ]),
    ]),
    createMeasure('bottom', 3, 13, [
      createVoice('bottom', 3, 13, 0, (voiceId) => [
        note(voiceId, 'bottom-s3-m13-v1-n1', 'A', 2, '8'),
        note(voiceId, 'bottom-s3-m13-v1-n2', 'E', 3, '8'),
        note(voiceId, 'bottom-s3-m13-v1-n3', 'F', 3, '8'),
        note(voiceId, 'bottom-s3-m13-v1-n4', 'D', 3, '8'),
        note(voiceId, 'bottom-s3-m13-v1-n5', 'E', 3, '8'),
        note(voiceId, 'bottom-s3-m13-v1-n6', 'C', 3, '8'),
      ]),
    ]),
    createMeasure('bottom', 3, 14, [
      createVoice('bottom', 3, 14, 0, (voiceId) => [
        note(voiceId, 'bottom-s3-m14-v1-n1', 'D', 3, '8'),
        note(voiceId, 'bottom-s3-m14-v1-n2', 'A', 2, '8'),
        note(voiceId, 'bottom-s3-m14-v1-n3', 'B', 2, '8'),
        note(voiceId, 'bottom-s3-m14-v1-n4', 'G', 2, '8'),
        note(voiceId, 'bottom-s3-m14-v1-n5', 'A', 2, '8'),
        note(voiceId, 'bottom-s3-m14-v1-n6', 'F', 2, '8'),
      ]),
    ]),
    createMeasure('bottom', 3, 15, [
      createVoice('bottom', 3, 15, 0, (voiceId) => [
        note(voiceId, 'bottom-s3-m15-v1-n1', 'C', 3, '8'),
        note(voiceId, 'bottom-s3-m15-v1-n2', 'G', 2, '8'),
        note(voiceId, 'bottom-s3-m15-v1-n3', 'E', 3, '8'),
        note(voiceId, 'bottom-s3-m15-v1-n4', 'F', 3, '8'),
        note(voiceId, 'bottom-s3-m15-v1-n5', 'G', 3, '8'),
        note(voiceId, 'bottom-s3-m15-v1-n6', 'C', 3, '8'),
      ]),
    ]),
    createMeasure(
      'bottom',
      4,
      16,
      [
        createVoice('bottom', 4, 16, 0, (voiceId) => [
          chord(voiceId, 'bottom-s4-m16-v1-c1', [p('C', 3), p('G', 3)], 'h'),
          chord(voiceId, 'bottom-s4-m16-v1-c2', [p('F', 2), p('C', 3)], 'h'),
        ]),
      ],
      { directionLabel: 'Lyrics', state: { meter: COMMON_TIME } }
    ),
    createMeasure('bottom', 4, 17, [
      createVoice('bottom', 4, 17, 0, (voiceId) => [
        chord(voiceId, 'bottom-s4-m17-v1-c1', [p('G', 2), p('D', 3)], 'h'),
        chord(voiceId, 'bottom-s4-m17-v1-c2', [p('E', 2), p('B', 2)], 'h'),
      ]),
    ]),
    createMeasure('bottom', 4, 18, [
      createVoice('bottom', 4, 18, 0, (voiceId) => [
        chord(voiceId, 'bottom-s4-m18-v1-c1', [p('A', 2), p('E', 3)], 'h'),
        chord(voiceId, 'bottom-s4-m18-v1-c2', [p('D', 3), p('A', 3)], 'h'),
      ]),
    ]),
    createMeasure('bottom', 4, 19, [
      createVoice('bottom', 4, 19, 0, (voiceId) => [
        chord(voiceId, 'bottom-s4-m19-v1-c1', [p('G', 2), p('D', 3)], 'h'),
        chord(voiceId, 'bottom-s4-m19-v1-c2', [p('C', 3), p('G', 3)], 'h'),
      ]),
    ]),
    createMeasure('bottom', 4, 20, [
      createVoice('bottom', 4, 20, 0, (voiceId) => [
        chord(voiceId, 'bottom-s4-m20-v1-c1', [p('F', 2), p('C', 3)], 'h'),
        chord(voiceId, 'bottom-s4-m20-v1-c2', [p('G', 2), p('D', 3)], 'h'),
      ]),
    ]),
    createMeasure(
      'bottom',
      5,
      21,
      [
        createVoice('bottom', 5, 21, 0, (voiceId) => [
          chord(voiceId, 'bottom-s5-m21-v1-c1', [p('C', 3), p('G', 3)], 'w'),
        ]),
      ],
      { directionLabel: 'Two voices' }
    ),
    createMeasure('bottom', 5, 22, [
      createVoice('bottom', 5, 22, 0, (voiceId) => [
        chord(voiceId, 'bottom-s5-m22-v1-c1', [p('B', 2), p('F', 3)], 'w'),
      ]),
    ]),
    createMeasure('bottom', 5, 23, [
      createVoice('bottom', 5, 23, 0, (voiceId) => [
        chord(voiceId, 'bottom-s5-m23-v1-c1', [p('E', 3), p('B', 3)], 'w'),
      ]),
    ]),
    createMeasure('bottom', 5, 24, [
      createVoice('bottom', 5, 24, 0, (voiceId) => [
        chord(voiceId, 'bottom-s5-m24-v1-c1', [p('F', 3), p('C', 4)], 'w'),
      ]),
    ]),
    createMeasure(
      'bottom',
      5,
      25,
      [
        createVoice('bottom', 5, 25, 0, (voiceId) => [
          chord(
            voiceId,
            'bottom-s5-m25-v1-c1',
            [p('C', 3), p('G', 3), p('C', 4)],
            'w'
          ),
        ]),
      ],
      { rightModifiers: { endBarline: 'final' } }
    ),
  ];
}

function createMeasure(
  staffPrefix: 'top' | 'bottom',
  section: number,
  measureNumber: number,
  voices: Voice[],
  overrides: MeasureFixtureOverrides = {}
): Measure {
  const id = `${staffPrefix}-s${section}-m${measureNumber}`;
  const { directionLabel, ...measureOverrides } = overrides;

  return {
    id,
    number: measureNumber,
    voices,
    ...(directionLabel
      ? {
          directions: createTextDirections(id, directionLabel),
        }
      : {}),
    ...measureOverrides,
  };
}

function createVoice(
  staffPrefix: 'top' | 'bottom',
  section: number,
  measureNumber: number,
  index: number,
  buildItems: (voiceId: string) => VoiceItem[],
  name?: string
): Voice {
  const id = `${staffPrefix}-s${section}-m${measureNumber}-v${index + 1}`;

  return {
    id,
    ...(name ? { name } : {}),
    index,
    items: buildItems(id),
  };
}

function p(
  step: Pitch['step'],
  octave: number,
  accidental?: Accidental
): Pitch {
  return {
    step,
    octave,
    ...(accidental ? { accidental } : {}),
  };
}

function note(
  voiceId: string,
  id: string,
  step: Pitch['step'],
  octave: number,
  length: DurationValue['length'],
  options: {
    accidental?: Accidental;
    dots?: DurationValue['dots'];
    lyric?: string;
    stemDirection?: Note['stemDirection'];
  } = {}
): Note {
  if (options.lyric) {
    activeFixtureContext?.lyricAttachments.push({
      id: `${id}-lyric`,
      ownerId: id,
      type: 'lyric',
      text: options.lyric,
      verse: 1,
    });
  }

  return {
    id,
    type: 'note',
    voiceId,
    pitch: p(step, octave, options.accidental),
    duration: duration(length, options.dots),
    ...(options.stemDirection ? { stemDirection: options.stemDirection } : {}),
  };
}

function chord(
  voiceId: string,
  id: string,
  pitches: Pitch[],
  length: DurationValue['length'],
  options: {
    dots?: DurationValue['dots'];
    stemDirection?: Chord['stemDirection'];
  } = {}
): Chord {
  return {
    id,
    type: 'chord',
    voiceId,
    pitches,
    duration: duration(length, options.dots),
    ...(options.stemDirection ? { stemDirection: options.stemDirection } : {}),
  };
}

function duration(
  length: DurationValue['length'],
  dots?: DurationValue['dots']
): DurationValue {
  return {
    length,
    ...(dots ? { dots } : {}),
  };
}

function createTextDirections(measureId: string, text: string): Direction[] {
  return [
    {
      id: `${measureId}-direction-1`,
      type: 'text',
      text,
      placement: 'above',
    },
  ];
}
