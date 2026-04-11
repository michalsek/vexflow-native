export type Id = string;

export type Clef =
  | 'treble'
  | 'bass'
  | 'alto'
  | 'tenor'
  | 'soprano'
  | 'mezzo-soprano'
  | 'baritone-c'
  | 'baritone-f'
  | 'subbass'
  | 'french'
  | 'percussion'
  | 'tab';

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export type Accidental =
  | 'bb'
  | 'b'
  | 'n'
  | '#'
  | '##'
  | 'x'
  | 'quarter-flat'
  | 'quarter-sharp';

export type NoteLength = 'w' | 'h' | 'q' | '8' | '16' | '32' | '64' | '128';

export type StemDirection = 'up' | 'down' | 'auto';

export type Barline =
  | 'single'
  | 'double'
  | 'end'
  | 'repeat-begin'
  | 'repeat-end'
  | 'final';

export type Articulation =
  | 'staccato'
  | 'tenuto'
  | 'accent'
  | 'marcato'
  | 'staccatissimo'
  | 'fermata';

export type Dynamic =
  | 'ppp'
  | 'pp'
  | 'p'
  | 'mp'
  | 'mf'
  | 'f'
  | 'ff'
  | 'fff'
  | 'sfz';

export type KeyMode =
  | 'major'
  | 'minor'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'locrian';

export interface Fraction {
  num: number;
  den: number;
}

export interface Pitch {
  step: Step;
  octave: number;
  accidental?: Accidental;
}

export interface Duration {
  length: NoteLength;
  dots?: 0 | 1 | 2 | 3;
  tuplet?: Fraction;
}

export interface KeySignature {
  tonic: Step;
  accidental?: 'b' | '#';
  mode?: KeyMode;
}

export interface Meter {
  beats: number;
  beatUnit: number;
  beaming?: number[];
}

export interface Tempo {
  bpm: number;
  beatUnit?: NoteLength;
  text?: string;
}

export interface Note {
  id: Id;
  type: 'note';
  pitch: Pitch;
  duration: Duration;
  voiceId: Id;
  tieStart?: boolean;
  tieEnd?: boolean;
  slurStart?: boolean;
  slurEnd?: boolean;
  articulations?: Articulation[];
  dynamic?: Dynamic;
  lyric?: string;
  stemDirection?: StemDirection;
}

export interface Rest {
  id: Id;
  type: 'rest';
  duration: Duration;
  voiceId: Id;
  isSpacer?: boolean;
}

export interface Chord {
  id: Id;
  type: 'chord';
  pitches: Pitch[];
  duration: Duration;
  voiceId: Id;
  articulations?: Articulation[];
  dynamic?: Dynamic;
  stemDirection?: StemDirection;
}

export type VoiceItem = Note | Rest | Chord;

export interface Voice {
  id: Id;
  name?: string;
  index: number;
  items: VoiceItem[];
}

export interface Measure {
  id: Id;
  number: number;
  clef?: Clef;
  meter?: Meter;
  keySignature?: KeySignature;
  tempo?: Tempo;
  directions?: string[];
  voices: Voice[];
  startBarline?: Barline;
  endBarline?: Barline;
}

export interface Staff {
  id: Id;
  name?: string;
  shortName?: string;
  order: number;
  clef: Clef;
  systemGroupId?: Id;
  systemGroupRole?: 'single' | 'top' | 'bottom';
  transposition?: number;
  measures: Measure[];
}

export interface ScoreMetadata {
  title?: string;
  subtitle?: string;
  composer?: string;
  lyricist?: string;
  arranger?: string;
  copyright?: string;
}

export interface Score {
  id: Id;
  metadata?: ScoreMetadata;
  defaultMeter: Meter;
  defaultKeySignature?: KeySignature;
  tempo?: Tempo;
  staves: Staff[];
}
