import type {
  Dynamic,
  Measure,
  NoteAttachment,
  ScoreDefaults,
  Slur,
  Staff,
  Tie,
  TupletGroup,
} from '../../state';

export type PartInfo = {
  id: string;
  name?: string;
};

export type StaffBuild = {
  id: string;
  name?: string;
  order: number;
  defaultClef?: Staff['defaultClef'];
  measures: Measure[];
};

type ActiveSpanner = {
  itemId: string;
};

export type ParserState = {
  scoreId: string;
  divisions: number;
  defaults: ScoreDefaults;
  attachments: NoteAttachment[];
  ties: Tie[];
  slurs: Slur[];
  tuplets: TupletGroup[];
  pendingDynamics: Map<string, Dynamic[]>;
  activeTies: Map<string, ActiveSpanner>;
  activeSlurs: Map<string, ActiveSpanner>;
  activeTuplets: Map<string, TupletGroup>;
};
