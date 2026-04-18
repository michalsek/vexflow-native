import {
  Accidental,
  Annotation,
  AnnotationVerticalJustify,
  Articulation as VexflowArticulation,
  Dot,
  StaveNote,
} from 'vexflow';

import type { Chord, Clef } from '../../state';
import {
  mapArticulationType,
  toStemDirection,
  toVexflowDuration,
  toVexflowPitch,
} from './common';

interface ChordMeasurement {
  accidentalCount: number;
  articulationCount: number;
  hasDynamic: boolean;
  pitchCount: number;
}

export default class ChordRenderer {
  constructor(private readonly chord: Chord, private readonly clef: Clef) {}

  measure(): ChordMeasurement {
    return {
      accidentalCount: this.measureAccidentals(),
      articulationCount: this.measureArticulations(),
      hasDynamic: this.measureDynamic(),
      pitchCount: this.measurePitches(),
    };
  }

  render(): StaveNote {
    const renderedChord = new StaveNote({
      clef: this.clef,
      keys: this.renderPitches(),
      duration: this.renderDuration(),
      stemDirection: toStemDirection(this.chord.stemDirection),
    } as ConstructorParameters<typeof StaveNote>[0]);

    this.renderDots(renderedChord);
    this.renderAccidentals(renderedChord);
    this.renderArticulations(renderedChord);
    this.renderDynamic(renderedChord);

    return renderedChord;
  }

  measurePitches(): number {
    return this.chord.pitches.length;
  }

  renderPitches(): string[] {
    return this.chord.pitches.map((pitch) => toVexflowPitch(pitch));
  }

  measureDuration(): number {
    return 1;
  }

  renderDuration(): string {
    return toVexflowDuration(this.chord.duration, false);
  }

  measureAccidentals(): number {
    return this.chord.pitches.filter((pitch) => pitch.accidental !== undefined)
      .length;
  }

  renderAccidentals(renderedChord: StaveNote): void {
    this.chord.pitches.forEach((pitch, pitchIndex) => {
      if (pitch.accidental) {
        renderedChord.addModifier(new Accidental(pitch.accidental), pitchIndex);
      }
    });
  }

  measureArticulations(): number {
    return this.chord.articulations?.length ?? 0;
  }

  renderArticulations(renderedChord: StaveNote): void {
    this.chord.articulations?.forEach((articulation) => {
      const code = mapArticulationType(articulation);

      if (!code) {
        return;
      }

      renderedChord.addModifier(new VexflowArticulation(code), 0);
    });
  }

  measureDynamic(): boolean {
    return this.chord.dynamic !== undefined;
  }

  renderDynamic(renderedChord: StaveNote): void {
    if (!this.chord.dynamic) {
      return;
    }

    renderedChord.addModifier(
      new Annotation(this.chord.dynamic).setVerticalJustification(
        AnnotationVerticalJustify.TOP
      ),
      0
    );
  }

  private renderDots(renderedChord: StaveNote): void {
    for (
      let dotIndex = 0;
      dotIndex < (this.chord.duration.dots ?? 0);
      dotIndex += 1
    ) {
      Dot.buildAndAttach([renderedChord], { all: true });
    }
  }
}
