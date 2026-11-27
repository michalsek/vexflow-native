import { Element, StaveModifierPosition, TimeSignature } from 'vexflow';
import type { Stave } from 'vexflow';

import type { VexflowRecordingContext } from '../base';
import type { Direction, NoteLength, Tempo, TempoDirection } from '../state';
import type { GroupLayoutContext, MeasureLayoutPlan } from './layout';
import type { ScoreItemBounds, ScoreTempoMarkLayout } from './types';

/** Sizes in VexFlow font points, gaps in content units. */
const TEMPO_MARK = {
  textFont: { size: 12, weight: 'bold' },
  glyphFontSize: 20,
  wordGap: 5,
  dotGap: 2,
  equalsGap: 4,
  baselineGap: 8,
};

/** SMuFL metronome note glyphs, drawn with the music font. */
const METRONOME_GLYPHS: Record<NoteLength, string> = {
  long: '\uECA1',
  breve: '\uECA0',
  w: '\uECA2',
  h: '\uECA3',
  q: '\uECA5',
  8: '\uECA7',
  16: '\uECA9',
  32: '\uECAB',
  64: '\uECAD',
  128: '\uECAF',
};

const METRONOME_AUGMENTATION_DOT = '\uECB7';

interface TempoMarkPart {
  element: Element;
  /** Left edge relative to the mark's left edge. */
  x: number;
  width: number;
  ascent: number;
  descent: number;
}

interface TempoMarkParts {
  parts: TempoMarkPart[];
  bpm: TempoMarkPart;
  width: number;
  ascent: number;
  descent: number;
}

/** Only the first tempo direction of a measure is drawn. */
export function firstTempoDirection(
  directions: readonly Direction[] | undefined
): TempoDirection | undefined {
  return directions?.find(
    (direction): direction is TempoDirection => direction.type === 'tempo'
  );
}

/**
 * Baseline and top of the mark relative to the stave origin, placed so its
 * lowest point clears the staff's measured content top (same space) by a gap.
 */
export function reserveTempoMark(
  stave: Stave,
  contentTop: number,
  tempo: Tempo,
  textFontFamily: string
): { baseline: number; top: number } {
  const { ascent, descent } = layoutTempoMarkParts(tempo, textFontFamily);
  const baseline =
    Math.min(stave.getYForTopText() - stave.getY(), contentTop) -
    TEMPO_MARK.baselineGap -
    descent;

  return { baseline, top: baseline - ascent };
}

/**
 * Draws the first tempo direction of each stave of the measure at the
 * baseline the measure pass reserved, inside the direction's color group.
 */
export function drawTempoMarks(
  ctx: VexflowRecordingContext,
  group: GroupLayoutContext,
  measurePlan: MeasureLayoutPlan,
  renderedStaves: Stave[],
  textFontFamily: string,
  tempoMarks: ScoreTempoMarkLayout[]
) {
  const { measureIndex, systemIndex } = measurePlan;
  const baselines = group.measures.find(
    (measure) => measure.measureIndex === measureIndex
  )?.tempoMarkBaselines;

  group.staves.forEach((staff, staffIndex) => {
    const baseline = baselines?.[staff.id];
    const direction = firstTempoDirection(
      staff.measures[measureIndex]?.directions
    );
    const stave = renderedStaves[staffIndex];

    if (baseline === undefined || !direction || !stave) {
      return;
    }

    const mark = layoutTempoMarkParts(direction.tempo, textFontFamily);
    const left = markLeft(stave);
    const baselineY = stave.getY() + baseline;

    ctx.beginColorGroup(direction.id);

    try {
      mark.parts.forEach(({ element, x }) =>
        element.renderText(ctx, left + x, baselineY)
      );
    } finally {
      ctx.endColorGroup();
    }

    tempoMarks.push({
      directionId: direction.id,
      staffId: staff.id,
      measureIndex,
      systemIndex,
      bounds: boundsAt(left, baselineY, mark),
      bpmBounds: boundsAt(left + mark.bpm.x, baselineY, mark.bpm),
    });
  });
}

/** Left edge of the time signature when shown, else the note start. */
function markLeft(stave: Stave): number {
  const [timeSignature] = stave.getModifiers(
    StaveModifierPosition.BEGIN,
    TimeSignature.CATEGORY
  );

  return timeSignature?.getX() ?? stave.getNoteStartX();
}

function boundsAt(
  left: number,
  baselineY: number,
  {
    width,
    ascent,
    descent,
  }: Pick<TempoMarkPart, 'width' | 'ascent' | 'descent'>
): ScoreItemBounds {
  return {
    left,
    right: left + width,
    top: baselineY - ascent,
    bottom: baselineY + descent,
  };
}

/** `[text] <note glyph><dots> = <bpm>`; a missing beat unit is a quarter. */
function layoutTempoMarkParts(
  { bpm, beatUnit, text }: Tempo,
  textFontFamily: string
): TempoMarkParts {
  const parts: TempoMarkPart[] = [];
  let x = 0;
  const append = (element: Element, gapBefore: number) => {
    const { actualBoundingBoxAscent, actualBoundingBoxDescent } =
      element.getTextMetrics();
    const part = {
      element,
      x: parts.length > 0 ? x + gapBefore : x,
      width: element.getWidth(),
      ascent: actualBoundingBoxAscent,
      descent: actualBoundingBoxDescent,
    };

    parts.push(part);
    x = part.x + part.width;

    return part;
  };

  if (text) {
    append(textElement(text, textFontFamily), 0);
  }

  append(
    glyphElement(METRONOME_GLYPHS[beatUnit?.length ?? 'q']),
    TEMPO_MARK.wordGap
  );

  for (let dot = 0; dot < (beatUnit?.dots ?? 0); dot++) {
    append(glyphElement(METRONOME_AUGMENTATION_DOT), TEMPO_MARK.dotGap);
  }

  append(textElement('=', textFontFamily), TEMPO_MARK.equalsGap);

  const bpmPart = append(
    textElement(String(bpm), textFontFamily),
    TEMPO_MARK.equalsGap
  );

  return {
    parts,
    bpm: bpmPart,
    width: x,
    ascent: Math.max(...parts.map((part) => part.ascent)),
    descent: Math.max(...parts.map((part) => part.descent)),
  };
}

function textElement(text: string, textFontFamily: string): Element {
  return new Element('StaveTempo')
    .setFont({ family: textFontFamily, ...TEMPO_MARK.textFont })
    .setText(text);
}

/** Music-font glyph; the family comes from VexFlow's configured fonts. */
function glyphElement(glyph: string): Element {
  return new Element('StaveTempo.glyph')
    .setFontSize(TEMPO_MARK.glyphFontSize)
    .setText(glyph);
}
