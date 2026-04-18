import { Beam, Formatter, Tuplet, Voice as VexflowVoice } from 'vexflow';
import type { StaveNote } from 'vexflow';

import type SkiaVexflowContext from '../../base/SkiaVexflowContext';
import type { Clef, Meter, Voice, VoiceItem } from '../../state';
import { getDurationInQuarterBeats } from '../timing';
import type { ItemTimingPlan, VoiceMeasurementPlan } from '../types';
import { buildBeamGroups } from './common';
import ChordRenderer from './ChordRenderer';
import NoteRenderer from './NoteRenderer';
import RestRenderer from './RestRenderer';

interface TickableEntry extends ItemTimingPlan {
  tickable: StaveNote;
}

export interface VoiceRenderData {
  plan: VoiceMeasurementPlan;
  voice: VexflowVoice;
  tickables: TickableEntry[];
  beams: Beam[];
  tuplets: Tuplet[];
}

export default class VoiceRenderer {
  constructor(
    private readonly voice: Voice,
    private readonly clef: Clef,
    private readonly meter: Meter,
    private readonly measureStartBeat: number
  ) {}

  measure(): VoiceRenderData {
    return this.buildRenderData();
  }

  render(): VoiceRenderData {
    return this.buildRenderData();
  }

  measureItems(): TickableEntry[] {
    return this.renderItems();
  }

  renderItems(): TickableEntry[] {
    const tickables: TickableEntry[] = [];
    let currentBeat = this.measureStartBeat;

    this.voice.items.forEach((item) => {
      const duration = getDurationInQuarterBeats(item.duration);
      const tickable = this.renderItem(item);

      tickables.push({
        voiceItemId: item.id,
        voiceId: this.voice.id,
        type: item.type,
        startBeat: currentBeat,
        endBeat: currentBeat + duration,
        tickable,
      });
      currentBeat += duration;
    });

    return tickables;
  }

  measureBeams(tickables: StaveNote[]): Beam[] {
    return Beam.generateBeams(tickables, {
      groups: buildBeamGroups(this.meter),
    });
  }

  renderBeams(beams: Beam[], context: SkiaVexflowContext): void {
    beams.forEach((beam) => beam.setContext(context).draw());
  }

  measureTuplets(tickables: StaveNote[], items: VoiceItem[]): Tuplet[] {
    const tuplets: Tuplet[] = [];
    let activeStart = -1;
    let activeTuplet = undefined as VoiceItem['duration']['tuplet'];

    const pushTuplet = (endIndex: number) => {
      if (activeTuplet && activeStart >= 0 && endIndex - activeStart >= 2) {
        const tuplet = new Tuplet(tickables.slice(activeStart, endIndex), {
          numNotes: activeTuplet.num,
          notesOccupied: activeTuplet.den,
        });

        tickables.slice(activeStart, endIndex).forEach((tickable) =>
          (
            tickable as StaveNote & {
              setTuplet?: (tuplet: Tuplet) => void;
            }
          ).setTuplet?.(tuplet)
        );
        tuplets.push(tuplet);
      }
    };

    items.forEach((item, itemIndex) => {
      const currentTuplet = item.duration.tuplet;

      if (!currentTuplet) {
        pushTuplet(itemIndex);
        activeStart = -1;
        activeTuplet = undefined;
        return;
      }

      if (
        activeTuplet &&
        (activeTuplet.num !== currentTuplet.num ||
          activeTuplet.den !== currentTuplet.den)
      ) {
        pushTuplet(itemIndex);
        activeStart = itemIndex;
      }

      if (!activeTuplet) {
        activeStart = itemIndex;
      }

      activeTuplet = currentTuplet;
    });

    pushTuplet(items.length);

    return tuplets;
  }

  renderTuplets(tuplets: Tuplet[], context: SkiaVexflowContext): void {
    tuplets.forEach((tuplet) => tuplet.setContext(context).draw());
  }

  private buildRenderData(): VoiceRenderData {
    const tickables = this.measureItems();
    const vexflowTickables = tickables.map((entry) => entry.tickable);
    const tuplets = this.measureTuplets(vexflowTickables, this.voice.items);
    const renderedVoice = new VexflowVoice({
      numBeats: this.meter.beats,
      beatValue: this.meter.beatUnit,
    }).setMode(VexflowVoice.Mode.SOFT);

    renderedVoice.addTickables(vexflowTickables);

    const formatter = new Formatter();
    const noteAreaWidth =
      vexflowTickables.length > 0
        ? Math.max(
            formatter.preCalculateMinTotalWidth([renderedVoice]),
            formatter.getMinTotalWidth()
          )
        : 0;

    return {
      plan: {
        voiceId: this.voice.id,
        itemTimings: tickables.map(
          ({ tickable: _tickable, ...timing }) => timing
        ),
        noteAreaWidth,
      },
      voice: renderedVoice,
      tickables,
      beams: this.measureBeams(vexflowTickables),
      tuplets,
    };
  }

  private renderItem(item: VoiceItem): StaveNote {
    switch (item.type) {
      case 'note':
        return new NoteRenderer(item, this.clef).render();
      case 'rest':
        return new RestRenderer(item, this.clef).render();
      case 'chord':
        return new ChordRenderer(item, this.clef).render();
      default:
        throw new Error(
          `Unsupported voice item type: ${(item as VoiceItem).type}`
        );
    }
  }
}
