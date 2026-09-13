# Percussion (`vexflow-native/percussion`)

Percussion uses the same [score model](state.md): pick the `percussion`
clef, put alternate noteheads and parentheses on pitches, and attach every
mark through `score.attachments`. `vexflow-native/percussion` exports
`ONE_LINE_STAFF_PITCH`, the pitch (B4) that sits on the single visible line
of a `lines: 1` staff (frozen — spread to derive; see
[staff lines](state.md#staff-lines)).

A single-drum part on a one-line staff, with sticking, a flam, a drag, an
accent and a ghost note:

```tsx
import { ONE_LINE_STAFF_PITCH } from 'vexflow-native/percussion';
import type { Note, NoteAttachment, Score } from 'vexflow-native/state';

const hit = (id: string, parenthesized = false): Note => ({
  id,
  type: 'note',
  voiceId: 'v1',
  pitch: { ...ONE_LINE_STAFF_PITCH, parenthesized },
  duration: { length: '8' },
});

const attachments: NoteAttachment[] = [
  { id: 'r1', ownerId: 'hit-1', type: 'annotation', text: 'R' },
  { id: 'l2', ownerId: 'hit-2', type: 'annotation', text: 'L' },
  {
    id: 'accent',
    ownerId: 'hit-1',
    type: 'articulation',
    articulation: 'accent',
  },
  {
    id: 'flam',
    ownerId: 'hit-1',
    type: 'grace',
    slash: true,
    notes: [{ pitch: ONE_LINE_STAFF_PITCH, duration: { length: '8' } }],
  },
  {
    id: 'drag',
    ownerId: 'hit-3',
    type: 'grace',
    notes: [
      { pitch: ONE_LINE_STAFF_PITCH, duration: { length: '16' } },
      { pitch: ONE_LINE_STAFF_PITCH, duration: { length: '16' } },
    ],
  },
];

const snareLine: Score = {
  id: 'snare-line',
  defaults: { meter: { beats: 2, beatUnit: 4 } },
  attachments,
  staves: [
    {
      id: 'snare',
      order: 0,
      defaultClef: 'percussion',
      lines: 1,
      measures: [
        {
          id: 'm1',
          number: 1,
          leftModifiers: { showClef: false, showMeter: true },
          voices: [
            {
              id: 'v1',
              index: 0,
              items: [
                hit('hit-1'),
                hit('hit-2'),
                hit('hit-3'),
                hit('hit-4', true),
              ],
            },
          ],
        },
      ],
    },
  ],
};
```

A flam is one slashed grace 8th; a drag is two beamed grace 16ths. Every
other mark is an ordinary [attachment](state.md#pitches-carry-notehead-data-attachments-carry-marks).

On a five-line drum-kit staff the same rules apply with kit positions as
pitches (hi-hat `{ step: 'G', octave: 5, notehead: 'x' }`, snare C5, kick
F4); `example/src/screens/DrumKitExample.tsx` shows a two-voice groove.
