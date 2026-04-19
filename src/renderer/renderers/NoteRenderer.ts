import {
  Accidental,
  Annotation,
  AnnotationVerticalJustify,
  Articulation as VexflowArticulation,
  Dot,
  StaveNote,
} from 'vexflow';

import type { Clef, Note } from '../../state';
import {
  mapArticulationType,
  toStemDirection,
  toVexflowDuration,
  toVexflowPitch,
} from './common';

interface NoteMeasurement {
  accidentalCount: number;
  articulationCount: number;
  hasDynamic: boolean;
  hasLyric: boolean;
}

export default class NoteRenderer {
  constructor(private readonly note: Note, private readonly clef: Clef) {}

  // ------------------
  // --- Measuring ---
  // ------------------

  measure(): NoteMeasurement {
    return {
      accidentalCount: this.measureAccidentals(),
      articulationCount: this.measureArticulations(),
      hasDynamic: this.measureDynamic(),
      hasLyric: this.measureLyric(),
    };
  }

  measurePitch(): number {
    return 1;
  }

  measureDuration(): number {
    return 1;
  }

  measureAccidentals(): number {
    return this.note.pitch.accidental ? 1 : 0;
  }

  measureArticulations(): number {
    return this.note.articulations?.length ?? 0;
  }

  measureDynamic(): boolean {
    return this.note.dynamic !== undefined;
  }

  measureLyric(): boolean {
    return this.note.lyric !== undefined;
  }

  // -----------------
  // --- Layouting ---
  // -----------------

  // -----------------
  // --- Rendering ---
  // -----------------

  render(): StaveNote {
    const renderedNote = new StaveNote({
      clef: this.clef,
      keys: [this.renderPitch()],
      duration: this.renderDuration(),
      stemDirection: toStemDirection(this.note.stemDirection),
    } as ConstructorParameters<typeof StaveNote>[0]);

    this.renderDots(renderedNote);
    this.renderAccidentals(renderedNote);
    this.renderArticulations(renderedNote);
    this.renderDynamic(renderedNote);
    this.renderLyric(renderedNote);

    return renderedNote;
  }

  renderPitch(): string {
    return toVexflowPitch(this.note.pitch);
  }

  renderDuration(): string {
    return toVexflowDuration(this.note.duration, false);
  }

  renderAccidentals(renderedNote: StaveNote): void {
    if (this.note.pitch.accidental) {
      renderedNote.addModifier(new Accidental(this.note.pitch.accidental), 0);
    }
  }

  renderArticulations(renderedNote: StaveNote): void {
    this.note.articulations?.forEach((articulation) => {
      const code = mapArticulationType(articulation);

      if (!code) {
        return;
      }

      renderedNote.addModifier(new VexflowArticulation(code), 0);
    });
  }

  renderDynamic(renderedNote: StaveNote): void {
    if (!this.note.dynamic) {
      return;
    }

    renderedNote.addModifier(
      new Annotation(this.note.dynamic).setVerticalJustification(
        AnnotationVerticalJustify.TOP
      ),
      0
    );
  }

  renderLyric(renderedNote: StaveNote): void {
    if (!this.note.lyric) {
      return;
    }

    renderedNote.addModifier(
      new Annotation(this.note.lyric).setVerticalJustification(
        AnnotationVerticalJustify.BOTTOM
      ),
      0
    );
  }

  private renderDots(renderedNote: StaveNote): void {
    for (
      let dotIndex = 0;
      dotIndex < (this.note.duration.dots ?? 0);
      dotIndex += 1
    ) {
      Dot.buildAndAttach([renderedNote], { all: true });
    }
  }
}
