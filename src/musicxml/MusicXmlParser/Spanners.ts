import type { Pitch, TupletGroup } from '../../state';
import type { ParserState } from './InternalTypes';
import { articulationsFromNotations, mapPitch } from './mappers';
import { MusicXmlParseError } from './types';
import {
  attr,
  childText,
  childrenNamed,
  optionalChild,
  requiredNumberText,
  type XmlElement,
} from './XmlOrder';

export function applyNoteAttachments(
  note: XmlElement,
  itemId: string,
  staffNumber: string,
  voiceId: string,
  state: ParserState
) {
  const notations = optionalChild(note, 'notations');
  const pendingDynamics = state.pendingDynamics.get(staffNumber) ?? [];

  pendingDynamics.forEach((dynamic, index) => {
    state.attachments.push({
      id: `${itemId}-dynamic-${index.toString()}`,
      ownerId: itemId,
      type: 'dynamic',
      dynamic,
    });
  });
  state.pendingDynamics.delete(staffNumber);

  articulationsFromNotations(notations).forEach((articulation, index) => {
    state.attachments.push({
      id: `${itemId}-articulation-${index.toString()}`,
      ownerId: itemId,
      type: 'articulation',
      articulation,
    });
  });

  childrenNamed(note, 'lyric').forEach((lyric, index) => {
    const text = childText(lyric, 'text');

    if (text) {
      const verse = attr(lyric, 'number');
      state.attachments.push({
        id: `${itemId}-lyric-${index.toString()}`,
        ownerId: itemId,
        type: 'lyric',
        text,
        verse: verse ? Number(verse) : undefined,
      });
    }
  });

  applyTies(note, itemId, voiceId, state);
  applySlurs(notations, itemId, voiceId, state);
  applyTuplets(note, notations, itemId, voiceId, state);
}

function applyTies(
  note: XmlElement,
  itemId: string,
  voiceId: string,
  state: ParserState
) {
  const pitch = optionalChild(note, 'pitch');
  const tieKey = `${voiceId}:${
    pitch ? pitchKey(mapPitch(pitch, childText(note, 'accidental'))) : 'rest'
  }`;

  childrenNamed(note, 'tie').forEach((tie) => {
    if (attr(tie, 'type') === 'start') {
      state.activeTies.set(tieKey, { itemId });
    } else if (attr(tie, 'type') === 'stop') {
      const active = state.activeTies.get(tieKey);

      if (active) {
        state.ties.push({
          id: `tie-${state.ties.length.toString()}`,
          fromNoteId: active.itemId,
          toNoteId: itemId,
        });
        state.activeTies.delete(tieKey);
      }
    }
  });
}

function applySlurs(
  notations: XmlElement | undefined,
  itemId: string,
  voiceId: string,
  state: ParserState
) {
  childrenNamed(notations ?? emptyElement('notations'), 'slur').forEach(
    (slur) => {
      const number = attr(slur, 'number') ?? '1';
      const key = `${voiceId}:${number}`;
      const type = attr(slur, 'type');

      if (type === 'start') {
        state.activeSlurs.set(key, { itemId });
      } else if (type === 'stop') {
        const matchedKey = state.activeSlurs.has(key)
          ? key
          : [...state.activeSlurs.keys()].find((activeKey) =>
              activeKey.endsWith(`:${number}`)
            );

        if (!matchedKey) {
          return;
        }

        const active = state.activeSlurs.get(matchedKey);

        if (!active) {
          return;
        }

        state.slurs.push({
          id: `slur-${state.slurs.length.toString()}`,
          fromNoteId: active.itemId,
          toNoteId: itemId,
        });
        state.activeSlurs.delete(matchedKey);
      }
    }
  );
}

function applyTuplets(
  note: XmlElement,
  notations: XmlElement | undefined,
  itemId: string,
  voiceId: string,
  state: ParserState
) {
  const timeModification = optionalChild(note, 'time-modification');
  const ratio = timeModification
    ? {
        num: requiredNumberText(timeModification, 'actual-notes'),
        den: requiredNumberText(timeModification, 'normal-notes'),
      }
    : undefined;

  childrenNamed(notations ?? emptyElement('notations'), 'tuplet').forEach(
    (tuplet) => {
      const number = attr(tuplet, 'number') ?? '1';
      const key = `${voiceId}:${number}`;

      if (attr(tuplet, 'type') === 'start') {
        if (!ratio) {
          throw new MusicXmlParseError(
            'Tuplet start missing time-modification'
          );
        }

        const placement =
          attr(tuplet, 'placement') === 'below' ? 'below' : 'above';
        const group: TupletGroup = {
          id: `tuplet-${state.tuplets.length.toString()}`,
          voiceId,
          itemIds: [itemId],
          ratio,
          bracketed: attr(tuplet, 'bracket') === 'yes',
          placement,
        };
        state.activeTuplets.set(key, group);
        state.tuplets.push(group);
        return;
      }

      if (attr(tuplet, 'type') === 'stop') {
        const matchedKey = state.activeTuplets.has(key)
          ? key
          : [...state.activeTuplets.keys()].find((activeKey) =>
              activeKey.endsWith(`:${number}`)
            );

        if (!matchedKey) {
          return;
        }

        const group = state.activeTuplets.get(matchedKey);

        if (!group) {
          return;
        }

        if (!group.itemIds.includes(itemId)) {
          group.itemIds.push(itemId);
        }

        state.activeTuplets.delete(matchedKey);
      }
    }
  );

  state.activeTuplets.forEach((group) => {
    if (group.voiceId === voiceId && !group.itemIds.includes(itemId)) {
      group.itemIds.push(itemId);
    }
  });
}

function pitchKey(pitch: Pitch): string {
  return `${pitch.step}${pitch.accidental ?? ''}${pitch.octave.toString()}`;
}

function emptyElement(name: string): XmlElement {
  return { name, attributes: {}, children: [], text: '' };
}
