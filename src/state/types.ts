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

export type NoteLength =
  | 'long'
  | 'breve'
  | 'w'
  | 'h'
  | 'q'
  | '8'
  | '16'
  | '32'
  | '64'
  | '128';

export type StemDirection = 'up' | 'down' | 'auto';

export type Notehead =
  | 'x'
  | 'circle-x'
  | 'diamond'
  | 'circle'
  | 'square'
  | 'triangle'
  | 'triangle-down'
  | 'slash';

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
  | 'fermata'
  | 'open'
  | 'stopped';

export type Dynamic =
  | 'ppp'
  | 'pp'
  | 'p'
  | 'mp'
  | 'mf'
  | 'f'
  | 'ff'
  | 'fff'
  | 'fp'
  | 'sf'
  | 'sfp'
  | 'sfz'
  | 'rf'
  | 'rfz'
  | 'fz'
  | 'n';

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
  notehead?: Notehead;
  /** Draws the notehead in parentheses (a ghost note). */
  parenthesized?: boolean;
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
  targetStaffId?: Id;
  stemDirection?: StemDirection;
}

export interface Rest {
  id: Id;
  type: 'rest';
  duration: DurationValue;
  voiceId: Id;
  targetStaffId?: Id;
  kind?: 'visible' | 'spacer' | 'hidden';
  staffLine?: number;
}

export interface Chord {
  id: Id;
  type: 'chord';
  pitches: Pitch[];
  duration: DurationValue;
  voiceId: Id;
  targetStaffId?: Id;
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
  /** undefined = shown on the first measure only; false hides it there too. */
  showClef?: boolean;
  /** undefined = hidden. */
  showMeter?: boolean;
  /** undefined = hidden; never drawn on a percussion clef. */
  showKeySignature?: boolean;
  /** undefined = 'single'; only 'single' and 'repeat-begin' render here. */
  startBarline?: Barline;
}

export interface MeasureRightModifiers {
  /** undefined = 'single'; 'repeat-begin' draws as a single line. */
  endBarline?: Barline;
}

export interface TextDirection {
  id: Id;
  type: 'text';
  text: string;
  /** undefined = 'above'; drawn on the measure's first drawn item of its
   * first voice. */
  placement?: 'above' | 'below';
}

/** Not drawn; the tempo reaches the renderer through `MeasureState`. */
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

export type StaffLines = 1 | 3 | 5;

export interface Staff {
  id: Id;
  name?: string;
  shortName?: string;
  order: number;
  defaultClef: Clef;
  /**
   * Visible staff lines (default 5). Fewer lines hide the outer lines
   * symmetrically around the middle one while notes keep the 5-line pitch
   * geometry, so a one-line staff's line is `ONE_LINE_STAFF_PITCH`.
   */
  lines?: StaffLines;
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
  /** undefined = 'above'. */
  placement?: 'above' | 'below';
  /** Chord pitches the mark belongs to, as indices into `Chord.pitches`;
   * undefined = the whole owner. Engraved once per owner either way; indices
   * on a `note` owner or out of range are tolerated and ignored. */
  pitchIndices?: number[];
}

export interface DynamicAttachment extends AttachmentBase {
  type: 'dynamic';
  dynamic: Dynamic;
  /** undefined = 'below'. */
  placement?: 'above' | 'below';
}

export interface LyricAttachment extends AttachmentBase {
  type: 'lyric';
  text: string;
  /** Verse order below the owner, ascending; undefined sorts first. */
  verse?: number;
}

/** Free text drawn above or below the owner (a note, chord or rest), e.g. a
 * sticking letter or a fingering. */
export interface AnnotationAttachment extends AttachmentBase {
  type: 'annotation';
  text: string;
  placement?: 'above' | 'below';
}

export interface GraceNote {
  pitch: Pitch;
  duration: DurationValue;
}

export interface GraceNoteAttachment extends AttachmentBase {
  type: 'grace';
  /** Played before the owner, in order. */
  notes: GraceNote[];
  /** Acciaccatura slash through the (first) stem. */
  slash?: boolean;
}

export type NoteAttachment =
  | ArticulationAttachment
  | DynamicAttachment
  | LyricAttachment
  | AnnotationAttachment
  | GraceNoteAttachment;

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
