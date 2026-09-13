import type { Direction, Tempo } from '../../state';
import type { ParserState, PendingDynamic } from './InternalTypes';
import { dynamicsFromElement, otherDynamicsText } from './mappers';
import {
  attr,
  childText,
  childrenNamed,
  optionalChild,
  textOf,
  type XmlElement,
} from './XmlOrder';

export type ParsedDirection = {
  /** 0-based; unvalidated, NaN for a non-numeric `<staff>`. */
  staffIndex: number;
  directions: Direction[];
};

export function parseDirection(
  direction: XmlElement,
  state: ParserState
): ParsedDirection {
  const explicitPlacement = attr(direction, 'placement');
  const dynamicPlacement =
    explicitPlacement === 'above' || explicitPlacement === 'below'
      ? explicitPlacement
      : undefined;
  const placement = dynamicPlacement ?? 'above';
  const staffNumber = childText(direction, 'staff') ?? '1';
  const directions: Direction[] = [];
  const soundTempo = optionalChild(direction, 'sound')?.attributes.tempo;
  const tempo = soundTempo ? parseTempo(soundTempo) : undefined;

  childrenNamed(direction, 'direction-type').forEach((type) => {
    childrenNamed(type, 'words').forEach((words, index) => {
      const text = textOf(words);

      if (text) {
        directions.push({
          id: `direction-text-${directions.length.toString()}-${index.toString()}`,
          type: 'text',
          text,
          placement,
        });
      }
    });

    childrenNamed(type, 'dynamics').forEach((dynamics) => {
      const parsedDynamics = dynamicsFromElement(dynamics);
      const otherText = otherDynamicsText(dynamics);

      if (parsedDynamics.length) {
        addPendingDynamics(
          state,
          staffNumber,
          parsedDynamics.map((dynamic) => ({
            dynamic,
            placement: dynamicPlacement,
          }))
        );
      }

      if (otherText) {
        directions.push({
          id: `direction-text-${directions.length.toString()}`,
          type: 'text',
          text: otherText,
          placement,
        });
      }
    });
  });

  if (tempo) {
    state.defaults.tempo ??= tempo;
    directions.push({
      id: `direction-tempo-${directions.length.toString()}`,
      type: 'tempo',
      tempo,
      placement,
    });
  }

  return { staffIndex: Number(staffNumber) - 1, directions };
}

function parseTempo(value: string): Tempo {
  return {
    bpm: Number(value),
    beatUnit: { length: 'q' },
  };
}

function addPendingDynamics(
  state: ParserState,
  staffNumber: string,
  dynamics: PendingDynamic[]
) {
  const pending = state.pendingDynamics.get(staffNumber) ?? [];
  state.pendingDynamics.set(staffNumber, [...pending, ...dynamics]);
}
