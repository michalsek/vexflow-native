import type {
  Chord,
  Direction,
  Measure,
  MeasureState,
  Voice,
  VoiceItem,
} from '../../state';
import type { ParserState, StaffBuild } from './InternalTypes';
import {
  mapBarline,
  mapClef,
  mapDurationType,
  mapKeySignature,
  mapPitch,
  mapStemDirection,
} from './mappers';
import { parseDirection } from './MusicXmlDirections';
import {
  appendSpacerRests,
  getMeasureDurationTicks,
  inferDurationType,
} from './MusicXmlTiming';
import { applyNoteAttachments } from './Spanners';
import { MusicXmlParseError } from './types';
import {
  attr,
  childText,
  childrenNamed,
  firstChild,
  hasChild,
  numberText,
  optionalChild,
  requiredChildText,
  requiredNumberText,
  type XmlElement,
} from './XmlOrder';

type VoiceCursor = {
  ownerStaffIndex: number;
  position: number;
  voice: Voice;
};

export function parseMeasure(
  measure: XmlElement,
  measureIndex: number,
  staves: StaffBuild[],
  state: ParserState
) {
  const number = Number(attr(measure, 'number') ?? measureIndex + 1);
  const measures = staves.map(
    (staff): Measure => ({
      id: `${staff.id}-measure-${(measureIndex + 1).toString()}`,
      number,
      voices: [],
    })
  );
  const voiceMapsByStaff = staves.map(() => new Map<string, Voice>());
  const voiceCursors = new Map<string, VoiceCursor>();
  const directions: Direction[] = [];
  let currentPosition = 0;

  measure.children.forEach((child) => {
    switch (child.name) {
      case 'attributes':
        applyAttributes(child, measures, staves, state);
        break;
      case 'direction':
        directions.push(...parseDirection(child, state));
        break;
      case 'note':
        currentPosition = parseNote(
          child,
          measures,
          voiceMapsByStaff,
          voiceCursors,
          staves,
          state,
          currentPosition
        );
        break;
      case 'barline':
        applyBarline(child, measures);
        break;
      case 'backup':
        currentPosition = Math.max(
          0,
          currentPosition - requiredNumberText(child, 'duration')
        );
        break;
      case 'forward':
        currentPosition = parseForward(
          child,
          measures,
          voiceMapsByStaff,
          voiceCursors,
          staves,
          state,
          currentPosition
        );
        break;
      case 'print':
        break;
      default:
        throw new MusicXmlParseError(
          `Unsupported measure element <${child.name}>`
        );
    }
  });

  finalizeMeasureVoices(measures[0]!, voiceCursors, state);

  measures.forEach((staffMeasure, index) => {
    if (directions.length) {
      staffMeasure.directions = [...directions];
    }

    staffMeasure.voices = [...voiceMapsByStaff[index]!.values()].sort(
      (left, right) => left.index - right.index
    );
    staves[index]!.measures.push(staffMeasure);
  });
}

function applyAttributes(
  attributes: XmlElement,
  measures: Measure[],
  staves: StaffBuild[],
  state: ParserState
) {
  const measureState: MeasureState = {};
  const key = optionalChild(attributes, 'key');
  const time = optionalChild(attributes, 'time');
  const divisions = numberText(attributes, 'divisions');

  if (divisions) {
    state.divisions = divisions;
  }

  if (key) {
    const fifths = requiredNumberText(key, 'fifths');
    measureState.keySignature = mapKeySignature(fifths, childText(key, 'mode'));
    state.defaults.keySignature ??= measureState.keySignature;
  }

  if (time) {
    measureState.meter = {
      beats: requiredNumberText(time, 'beats'),
      beatUnit: requiredNumberText(time, 'beat-type'),
    };
    state.defaults.meter = measureState.meter;
  }

  childrenNamed(attributes, 'clef').forEach((clef) => {
    const staffIndex = Number(attr(clef, 'number') ?? '1') - 1;
    const staff = staves[staffIndex];

    if (!staff || !measures[staffIndex]) {
      throw new MusicXmlParseError('Clef references unknown staff');
    }

    const mappedClef = mapClef(clef);
    staff.defaultClef ??= mappedClef;
    measures[staffIndex]!.state = {
      ...measures[staffIndex]!.state,
      clef: mappedClef,
    };
  });

  if (measureState.keySignature || measureState.meter) {
    measures.forEach((measure) => {
      measure.state = {
        ...measure.state,
        ...measureState,
      };
      measure.leftModifiers = {
        ...measure.leftModifiers,
        showKeySignature: Boolean(measureState.keySignature),
        showMeter: Boolean(measureState.meter),
      };
    });
  }
}

function parseNote(
  note: XmlElement,
  measures: Measure[],
  voiceMapsByStaff: Map<string, Voice>[],
  voiceCursors: Map<string, VoiceCursor>,
  staves: StaffBuild[],
  state: ParserState,
  currentPosition: number
): number {
  const staffNumber = requiredChildText(note, 'staff');
  const staffIndex = Number(staffNumber) - 1;
  const measure = measures[staffIndex];
  const voiceMap = voiceMapsByStaff[staffIndex];
  const targetStaff = staves[staffIndex];

  if (!measure || !voiceMap || !targetStaff) {
    throw new MusicXmlParseError(
      `Note references unknown staff ${staffNumber}`
    );
  }

  if (hasChild(note, 'grace')) {
    return currentPosition;
  }

  const voiceName = requiredChildText(note, 'voice');
  const cursor = getVoiceCursor(
    voiceName,
    staffIndex,
    measures,
    voiceMapsByStaff,
    voiceCursors,
    staves
  );
  const voice = cursor.voice;
  const isChordTone = hasChild(note, 'chord');
  const item = createVoiceItem(note, voice, isChordTone, state);
  const ownerStaff = staves[cursor.ownerStaffIndex];
  const noteDuration = isChordTone ? 0 : requiredNumberText(note, 'duration');

  if (!isChordTone) {
    appendRepresentableSpacerRests(
      voice,
      currentPosition - cursor.position,
      state.divisions
    );
  }

  if (ownerStaff?.id !== targetStaff.id) {
    item.targetStaffId = targetStaff.id;
  }

  const itemId = isChordTone
    ? mergeChordTone(voice, item, note)
    : pushItem(voice, item);

  applyNoteAttachments(note, itemId, staffNumber, voice.id, state);

  if (isChordTone) {
    return currentPosition;
  }

  cursor.position = currentPosition + noteDuration;
  return cursor.position;
}

function parseForward(
  forward: XmlElement,
  measures: Measure[],
  voiceMapsByStaff: Map<string, Voice>[],
  voiceCursors: Map<string, VoiceCursor>,
  staves: StaffBuild[],
  state: ParserState,
  currentPosition: number
): number {
  const duration = requiredNumberText(forward, 'duration');
  const voiceName = childText(forward, 'voice');

  if (!voiceName) {
    return currentPosition + duration;
  }

  const staffNumber = childText(forward, 'staff') ?? '1';
  const staffIndex = Number(staffNumber) - 1;
  const cursor = getVoiceCursor(
    voiceName,
    staffIndex,
    measures,
    voiceMapsByStaff,
    voiceCursors,
    staves
  );

  appendRepresentableSpacerRests(
    cursor.voice,
    currentPosition - cursor.position + duration,
    state.divisions
  );
  cursor.position = currentPosition + duration;
  return cursor.position;
}

function getVoiceCursor(
  voiceName: string,
  staffIndex: number,
  measures: Measure[],
  voiceMapsByStaff: Map<string, Voice>[],
  voiceCursors: Map<string, VoiceCursor>,
  staves: StaffBuild[]
): VoiceCursor {
  const existing = voiceCursors.get(voiceName);

  if (existing) {
    return existing;
  }

  const measure = measures[staffIndex];
  const voiceMap = voiceMapsByStaff[staffIndex];

  if (!measure || !voiceMap || !staves[staffIndex]) {
    throw new MusicXmlParseError('Voice references unknown staff');
  }

  const numericIndex = Number(voiceName);
  const voice: Voice = {
    id: `${measure.id}-voice-${voiceName}`,
    name: voiceName,
    index: Number.isFinite(numericIndex) ? numericIndex : voiceMap.size + 1,
    timingMode: 'soft',
    items: [],
  };
  const cursor: VoiceCursor = {
    ownerStaffIndex: staffIndex,
    position: 0,
    voice,
  };
  voiceMap.set(voiceName, voice);
  voiceCursors.set(voiceName, cursor);
  return cursor;
}

function createVoiceItem(
  note: XmlElement,
  voice: Voice,
  isChordTone: boolean,
  state: ParserState
): VoiceItem {
  const typeText = childText(note, 'type');
  const type = typeText
    ? mapDurationType(typeText)
    : inferDurationType(requiredNumberText(note, 'duration'), state.divisions);
  const dotCount = childrenNamed(note, 'dot').length;

  if (dotCount > 3) {
    throw new MusicXmlParseError('More than three dots are unsupported');
  }

  const duration = {
    length: type,
    dots: dotCount ? (dotCount as 1 | 2 | 3) : undefined,
  };

  if (hasChild(note, 'rest')) {
    if (isChordTone) {
      throw new MusicXmlParseError('Rest chord tones are unsupported');
    }

    return {
      id: '',
      type: 'rest',
      duration,
      voiceId: voice.id,
      kind: attr(note, 'print-object') === 'no' ? 'hidden' : 'visible',
    };
  }

  const pitch = mapPitch(
    firstChild(note, 'pitch'),
    childText(note, 'accidental')
  );

  return {
    id: '',
    type: 'note',
    pitch,
    duration,
    voiceId: voice.id,
    stemDirection: mapStemDirection(childText(note, 'stem')),
  };
}

function pushItem(voice: Voice, item: VoiceItem): string {
  item.id = `${voice.id}-item-${(voice.items.length + 1).toString()}`;
  voice.items.push(item);
  return item.id;
}

function mergeChordTone(
  voice: Voice,
  item: VoiceItem,
  note: XmlElement
): string {
  const previous = voice.items[voice.items.length - 1];

  if (!previous || item.type !== 'note') {
    throw new MusicXmlParseError('Chord tone has no previous pitched note');
  }

  if (previous.type === 'note') {
    const chord: Chord = {
      id: previous.id,
      type: 'chord',
      pitches: [previous.pitch, item.pitch],
      duration: previous.duration,
      voiceId: previous.voiceId,
      targetStaffId: previous.targetStaffId ?? item.targetStaffId,
      stemDirection:
        mapStemDirection(childText(note, 'stem')) ?? previous.stemDirection,
    };
    voice.items[voice.items.length - 1] = chord;
    return chord.id;
  }

  if (previous.type === 'chord') {
    previous.pitches.push(item.pitch);
    return previous.id;
  }

  throw new MusicXmlParseError('Chord tone cannot follow a rest');
}

function finalizeMeasureVoices(
  measure: Measure,
  voiceCursors: Map<string, VoiceCursor>,
  state: ParserState
) {
  const meter = measure.state?.meter ?? state.defaults.meter;
  const measureDuration = getMeasureDurationTicks(
    state.divisions,
    meter.beats,
    meter.beatUnit
  );

  voiceCursors.forEach((cursor) => {
    appendRepresentableSpacerRests(
      cursor.voice,
      measureDuration - cursor.position,
      state.divisions
    );
    cursor.position = Math.max(cursor.position, measureDuration);
  });
}

function appendRepresentableSpacerRests(
  voice: Voice,
  ticks: number,
  divisions: number
) {
  if (!appendSpacerRests(voice, ticks, divisions)) {
    voice.timingMode = 'soft';
  }
}

function applyBarline(barline: XmlElement, measures: Measure[]) {
  const mapped = mapBarline(barline);

  if (!mapped) {
    return;
  }

  measures.forEach((measure) => {
    if (mapped.location === 'left') {
      measure.leftModifiers = {
        ...measure.leftModifiers,
        startBarline: mapped.value,
      };
    } else {
      measure.rightModifiers = {
        ...measure.rightModifiers,
        endBarline: mapped.value,
      };
    }
  });
}
