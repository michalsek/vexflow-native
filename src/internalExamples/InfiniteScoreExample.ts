import type { RendererConfig, RendererViewport } from '../renderer';
import type {
  Accidental,
  Duration,
  Pitch,
  Score,
  Step,
  Voice,
  VoiceItem,
} from '../state';

type NoteOptions = {
  lyric?: string;
  accidental?: Accidental;
};

type ChordPitch = Pitch;

function createNote(
  id: string,
  voiceId: string,
  step: Step,
  octave: number,
  duration: Duration,
  options: NoteOptions = {}
): VoiceItem {
  return {
    id,
    type: 'note',
    pitch: {
      step,
      octave,
      accidental: options.accidental,
    },
    duration,
    voiceId,
    lyric: options.lyric,
  };
}

function createRest(
  id: string,
  voiceId: string,
  duration: Duration
): VoiceItem {
  return {
    id,
    type: 'rest',
    duration,
    voiceId,
  };
}

function createChord(
  id: string,
  voiceId: string,
  pitches: ChordPitch[],
  duration: Duration
): VoiceItem {
  return {
    id,
    type: 'chord',
    pitches,
    duration,
    voiceId,
  };
}

function createVoice(id: string, index: number, items: VoiceItem[]): Voice {
  return {
    id,
    index,
    items,
  };
}

export const INFINITE_SCORE_EXAMPLE_SCORE: Score = {
  id: 'score-infinite-example',
  metadata: {
    title: 'Infinite Score Demo',
    composer: 'vexflow-native',
  },
  defaultMeter: {
    beats: 4,
    beatUnit: 4,
    beaming: [2, 2],
  },
  defaultKeySignature: {
    tonic: 'G',
    mode: 'major',
  },
  tempo: {
    bpm: 92,
    beatUnit: 'q',
    text: 'Andante',
  },
  staves: [
    {
      id: 'staff-right-hand',
      order: 0,
      clef: 'treble',
      systemGroupId: 'grand-staff',
      systemGroupRole: 'top',
      measures: [
        {
          id: 'rh-measure-1',
          number: 1,
          directions: ['dolce'],
          voices: [
            createVoice('rh-voice-1', 0, [
              createNote('rh-1-note-1', 'rh-voice-1', 'G', 4, { length: 'q' }),
              createNote('rh-1-note-2', 'rh-voice-1', 'A', 4, { length: 'q' }),
              createNote(
                'rh-1-note-3',
                'rh-voice-1',
                'B',
                4,
                { length: 'q' },
                { lyric: 'flow' }
              ),
              createChord(
                'rh-1-chord-1',
                'rh-voice-1',
                [
                  { step: 'D', octave: 5 },
                  { step: 'G', octave: 5 },
                ],
                { length: 'q' }
              ),
            ]),
          ],
        },
        {
          id: 'rh-measure-2',
          number: 2,
          voices: [
            createVoice('rh-voice-2', 0, [
              createNote(
                'rh-2-note-1',
                'rh-voice-2',
                'F',
                5,
                { length: '8' },
                { accidental: '#' }
              ),
              createNote('rh-2-note-2', 'rh-voice-2', 'E', 5, {
                length: '8',
              }),
              createNote('rh-2-note-3', 'rh-voice-2', 'D', 5, {
                length: '8',
              }),
              createNote('rh-2-note-4', 'rh-voice-2', 'C', 5, {
                length: '8',
              }),
              createChord(
                'rh-2-chord-1',
                'rh-voice-2',
                [
                  { step: 'B', octave: 4 },
                  { step: 'D', octave: 5 },
                  { step: 'G', octave: 5 },
                ],
                { length: 'h' }
              ),
            ]),
          ],
        },
        {
          id: 'rh-measure-3',
          number: 3,
          meter: {
            beats: 3,
            beatUnit: 4,
            beaming: [3],
          },
          voices: [
            createVoice('rh-voice-3', 0, [
              createNote('rh-3-note-1', 'rh-voice-3', 'B', 4, {
                length: 'q',
              }),
              createNote(
                'rh-3-note-2',
                'rh-voice-3',
                'C',
                5,
                { length: 'q' },
                { accidental: 'n', lyric: 'keep' }
              ),
              createChord(
                'rh-3-chord-1',
                'rh-voice-3',
                [
                  { step: 'E', octave: 5 },
                  { step: 'G', octave: 5 },
                ],
                { length: 'q' }
              ),
            ]),
          ],
        },
        {
          id: 'rh-measure-4',
          number: 4,
          meter: {
            beats: 4,
            beatUnit: 4,
            beaming: [2, 2],
          },
          keySignature: {
            tonic: 'D',
            mode: 'major',
          },
          voices: [
            createVoice('rh-voice-4', 0, [
              createNote(
                'rh-4-note-1',
                'rh-voice-4',
                'D',
                5,
                { length: 'q' },
                { lyric: 'the' }
              ),
              createNote(
                'rh-4-note-2',
                'rh-voice-4',
                'E',
                5,
                { length: 'q' },
                { lyric: 'line' }
              ),
              createNote(
                'rh-4-note-3',
                'rh-voice-4',
                'F',
                5,
                { length: 'q' },
                { accidental: '#', lyric: 'move' }
              ),
              createChord(
                'rh-4-chord-1',
                'rh-voice-4',
                [
                  { step: 'A', octave: 4 },
                  { step: 'D', octave: 5 },
                ],
                { length: 'q' }
              ),
            ]),
          ],
        },
        {
          id: 'rh-measure-5',
          number: 5,
          directions: ['crescendo'],
          voices: [
            createVoice('rh-voice-5', 0, [
              createNote('rh-5-note-1', 'rh-voice-5', 'A', 4, {
                length: '8',
                tuplet: { num: 3, den: 2 },
              }),
              createNote('rh-5-note-2', 'rh-voice-5', 'B', 4, {
                length: '8',
                tuplet: { num: 3, den: 2 },
              }),
              createNote('rh-5-note-3', 'rh-voice-5', 'C', 5, {
                length: '8',
                tuplet: { num: 3, den: 2 },
              }),
              createNote('rh-5-note-4', 'rh-voice-5', 'D', 5, {
                length: 'q',
              }),
              createChord(
                'rh-5-chord-1',
                'rh-voice-5',
                [
                  { step: 'F', octave: 5, accidental: '#' },
                  { step: 'A', octave: 5 },
                ],
                { length: 'h' }
              ),
            ]),
          ],
        },
        {
          id: 'rh-measure-6',
          number: 6,
          endBarline: 'final',
          voices: [
            createVoice('rh-voice-6', 0, [
              createChord(
                'rh-6-chord-1',
                'rh-voice-6',
                [
                  { step: 'D', octave: 5 },
                  { step: 'F', octave: 5, accidental: '#' },
                  { step: 'A', octave: 5 },
                ],
                { length: 'w' }
              ),
            ]),
          ],
        },
      ],
    },
    {
      id: 'staff-left-hand',
      order: 1,
      clef: 'bass',
      systemGroupId: 'grand-staff',
      systemGroupRole: 'bottom',
      measures: [
        {
          id: 'lh-measure-1',
          number: 1,
          voices: [
            createVoice('lh-voice-1', 0, [
              createChord(
                'lh-1-chord-1',
                'lh-voice-1',
                [
                  { step: 'G', octave: 2 },
                  { step: 'D', octave: 3 },
                ],
                { length: 'h' }
              ),
              createChord(
                'lh-1-chord-2',
                'lh-voice-1',
                [
                  { step: 'G', octave: 2 },
                  { step: 'D', octave: 3 },
                ],
                { length: 'h' }
              ),
            ]),
          ],
        },
        {
          id: 'lh-measure-2',
          number: 2,
          voices: [
            createVoice('lh-voice-2', 0, [
              createNote('lh-2-note-1', 'lh-voice-2', 'G', 2, {
                length: 'q',
              }),
              createRest('lh-2-rest-1', 'lh-voice-2', { length: 'q' }),
              createChord(
                'lh-2-chord-1',
                'lh-voice-2',
                [
                  { step: 'D', octave: 3 },
                  { step: 'A', octave: 3 },
                ],
                { length: 'h' }
              ),
            ]),
          ],
        },
        {
          id: 'lh-measure-3',
          number: 3,
          voices: [
            createVoice('lh-voice-3', 0, [
              createChord(
                'lh-3-chord-1',
                'lh-voice-3',
                [
                  { step: 'G', octave: 2 },
                  { step: 'B', octave: 2 },
                ],
                { length: 'h' }
              ),
              createNote('lh-3-note-1', 'lh-voice-3', 'D', 3, {
                length: 'q',
              }),
            ]),
          ],
        },
        {
          id: 'lh-measure-4',
          number: 4,
          voices: [
            createVoice('lh-voice-4', 0, [
              createNote('lh-4-note-1', 'lh-voice-4', 'D', 3, {
                length: 'q',
              }),
              createChord(
                'lh-4-chord-1',
                'lh-voice-4',
                [
                  { step: 'A', octave: 2 },
                  { step: 'E', octave: 3 },
                ],
                { length: 'q' }
              ),
              createChord(
                'lh-4-chord-2',
                'lh-voice-4',
                [
                  { step: 'B', octave: 2 },
                  { step: 'F', octave: 3, accidental: '#' },
                ],
                { length: 'h' }
              ),
            ]),
          ],
        },
        {
          id: 'lh-measure-5',
          number: 5,
          voices: [
            createVoice('lh-voice-5', 0, [
              createNote('lh-5-note-1', 'lh-voice-5', 'G', 2, {
                length: 'q',
              }),
              createNote('lh-5-note-2', 'lh-voice-5', 'A', 2, {
                length: 'q',
              }),
              createChord(
                'lh-5-chord-1',
                'lh-voice-5',
                [
                  { step: 'B', octave: 2 },
                  { step: 'D', octave: 3 },
                ],
                { length: 'h' }
              ),
            ]),
          ],
        },
        {
          id: 'lh-measure-6',
          number: 6,
          endBarline: 'final',
          voices: [
            createVoice('lh-voice-6', 0, [
              createChord(
                'lh-6-chord-1',
                'lh-voice-6',
                [
                  { step: 'D', octave: 3 },
                  { step: 'A', octave: 3 },
                ],
                { length: 'w' }
              ),
            ]),
          ],
        },
      ],
    },
  ],
};

export function createInfiniteScoreExampleConfig(
  viewport: RendererViewport
): RendererConfig {
  return {
    layoutMode: 'infiniteScore',
    viewport,
    padding: {
      top: 24,
      right: 24,
      bottom: 24,
      left: 24,
    },
    spacing: {
      staffGap: 84,
      groupGap: 40,
      minimumMeasureWidth: 176,
    },
    render: {
      pixelRatio: 1,
      scale: 1,
      debug: false,
    },
  };
}
