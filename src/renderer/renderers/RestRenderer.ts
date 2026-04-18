import { Dot, StaveNote } from 'vexflow';

import type { Clef, Rest } from '../../state';
import { toRestKey, toVexflowDuration } from './common';

interface RestMeasurement {
  isSpacer: boolean;
}

export default class RestRenderer {
  constructor(private readonly rest: Rest, private readonly clef: Clef) {}

  measure(): RestMeasurement {
    return {
      isSpacer: this.measureDuration(),
    };
  }

  render(): StaveNote {
    const renderedRest = new StaveNote({
      clef: this.clef,
      keys: [this.renderPitch()],
      duration: this.renderDuration(),
    } as ConstructorParameters<typeof StaveNote>[0]);

    this.renderDots(renderedRest);
    this.renderSpacerVisibility(renderedRest);

    return renderedRest;
  }

  measureDuration(): boolean {
    return this.rest.isSpacer === true;
  }

  renderDuration(): string {
    return toVexflowDuration(this.rest.duration, true);
  }

  renderPitch(): string {
    return toRestKey(this.clef);
  }

  private renderDots(renderedRest: StaveNote): void {
    for (
      let dotIndex = 0;
      dotIndex < (this.rest.duration.dots ?? 0);
      dotIndex += 1
    ) {
      Dot.buildAndAttach([renderedRest], { all: true });
    }
  }

  private renderSpacerVisibility(renderedRest: StaveNote): void {
    if (!this.rest.isSpacer) {
      return;
    }

    (
      renderedRest as StaveNote & {
        setStyle?: (style: {
          fillStyle?: string;
          strokeStyle?: string;
        }) => void;
      }
    ).setStyle?.({
      fillStyle: 'rgba(0,0,0,0)',
      strokeStyle: 'rgba(0,0,0,0)',
    });
  }
}
