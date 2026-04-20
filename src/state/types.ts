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

export type VoiceTimingMode = 'strict' | 'soft' | 'free';

export type StaffGroupRole = 'grandStaff' | 'choir' | 'section' | 'custom';
export type StaffGroupSymbol = 'brace' | 'bracket' | 'line';

export interface Fraction {
  num: number;
  den: number;
}

export interface Pitch {
  step: Step;
  octave: number;
  accidental?: Accidental;
}

export interface DurationValue {
  length: NoteLength;
  dots?: 0 | 1 | 2 | 3;
}

export interface KeySignature {
  tonic: Step;
  accidental?: 'b' | '#';
  mode?: KeyMode;
}

export interface Meter {
  beats: number;
  beatUnit: number;
  beamGroups?: Fraction[];
}

export interface Tempo {
  bpm: number;
  beatUnit?: DurationValue;
  text?: string;
}

export interface Note {
  id: Id;
  type: 'note';
  pitch: Pitch;
  duration: DurationValue;
  voiceId: Id;
  stemDirection?: StemDirection;
}

export interface Rest {
  id: Id;
  type: 'rest';
  duration: DurationValue;
  voiceId: Id;
  kind?: 'visible' | 'spacer' | 'hidden';
  staffLine?: number;
}

export interface Chord {
  id: Id;
  type: 'chord';
  pitches: Pitch[];
  duration: DurationValue;
  voiceId: Id;
  stemDirection?: StemDirection;
}

export type VoiceItem = Note | Rest | Chord;

export interface Voice {
  id: Id;
  name?: string;
  index: number;
  timingMode?: VoiceTimingMode;
  items: VoiceItem[];
}

export interface MeasureState {
  clef?: Clef;
  meter?: Meter;
  keySignature?: KeySignature;
  tempo?: Tempo;
}

export interface MeasureLeftModifiers {
  showClef?: boolean;
  showMeter?: boolean;
  showKeySignature?: boolean;
  startBarline?: Barline;
}

export interface MeasureRightModifiers {
  endBarline?: Barline;
}

export interface TextDirection {
  id: Id;
  type: 'text';
  text: string;
  placement?: 'above' | 'below';
}

export interface TempoDirection {
  id: Id;
  type: 'tempo';
  tempo: Tempo;
  placement?: 'above' | 'below';
}

export type Direction = TextDirection | TempoDirection;

export interface Measure {
  id: Id;
  number: number;

  state?: MeasureState;

  leftModifiers?: MeasureLeftModifiers;
  rightModifiers?: MeasureRightModifiers;

  directions?: Direction[];
  voices: Voice[];
}

export interface Staff {
  id: Id;
  name?: string;
  shortName?: string;
  order: number;
  defaultClef: Clef;
  transposition?: number;
  measures: Measure[];
}

export interface StaffGroup {
  id: Id;
  staffIds?: Id[];
  role: StaffGroupRole;
  symbol?: StaffGroupSymbol;
}

export interface ScoreMetadata {
  title?: string;
  subtitle?: string;
  composer?: string;
  lyricist?: string;
  arranger?: string;
  copyright?: string;
}

export interface ScoreDefaults {
  meter: Meter;
  keySignature?: KeySignature;
  tempo?: Tempo;
}

export interface AttachmentBase {
  id: Id;
  ownerId: Id;
}

export interface ArticulationAttachment extends AttachmentBase {
  type: 'articulation';
  articulation: Articulation;
}

export interface DynamicAttachment extends AttachmentBase {
  type: 'dynamic';
  dynamic: Dynamic;
  placement?: 'above' | 'below';
}

export interface LyricAttachment extends AttachmentBase {
  type: 'lyric';
  text: string;
  verse?: number;
}

export type NoteAttachment =
  | ArticulationAttachment
  | DynamicAttachment
  | LyricAttachment;

export interface Tie {
  id: Id;
  fromNoteId: Id;
  toNoteId: Id;
}

export interface Slur {
  id: Id;
  fromNoteId: Id;
  toNoteId: Id;
}

export interface TupletGroup {
  id: Id;
  voiceId: Id;
  itemIds: Id[];
  ratio: Fraction;
  bracketed?: boolean;
  placement?: 'above' | 'below';
}

export interface Score {
  id: Id;
  metadata?: ScoreMetadata;
  defaults: ScoreDefaults;
  staves: Staff[];
  staffGroups?: StaffGroup[];
  attachments?: NoteAttachment[];
  ties?: Tie[];
  slurs?: Slur[];
  tuplets?: TupletGroup[];
}
