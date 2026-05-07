import type {
  Accidental,
  Articulation,
  Barline,
  Clef,
  Dynamic,
  KeyMode,
  KeySignature,
  NoteLength,
  Pitch,
  Step,
} from '../../state';
import { MusicXmlParseError } from './types';
import {
  childText,
  childrenNamed,
  hasChild,
  requiredChildText,
  type XmlElement,
} from './XmlOrder';

const MAJOR_KEYS: Record<number, KeySignature> = {
  '-7': { tonic: 'C', accidental: 'b' },
  '-6': { tonic: 'G', accidental: 'b' },
  '-5': { tonic: 'D', accidental: 'b' },
  '-4': { tonic: 'A', accidental: 'b' },
  '-3': { tonic: 'E', accidental: 'b' },
  '-2': { tonic: 'B', accidental: 'b' },
  '-1': { tonic: 'F' },
  '0': { tonic: 'C' },
  '1': { tonic: 'G' },
  '2': { tonic: 'D' },
  '3': { tonic: 'A' },
  '4': { tonic: 'E' },
  '5': { tonic: 'B' },
  '6': { tonic: 'F', accidental: '#' },
  '7': { tonic: 'C', accidental: '#' },
};

const MINOR_KEYS: Record<number, KeySignature> = {
  '-7': { tonic: 'A', accidental: 'b' },
  '-6': { tonic: 'E', accidental: 'b' },
  '-5': { tonic: 'B', accidental: 'b' },
  '-4': { tonic: 'F' },
  '-3': { tonic: 'C' },
  '-2': { tonic: 'G' },
  '-1': { tonic: 'D' },
  '0': { tonic: 'A' },
  '1': { tonic: 'E' },
  '2': { tonic: 'B' },
  '3': { tonic: 'F', accidental: '#' },
  '4': { tonic: 'C', accidental: '#' },
  '5': { tonic: 'G', accidental: '#' },
  '6': { tonic: 'D', accidental: '#' },
  '7': { tonic: 'A', accidental: '#' },
};

const DYNAMICS: Dynamic[] = [
  'ppp',
  'pp',
  'p',
  'mp',
  'mf',
  'f',
  'ff',
  'fff',
  'sfz',
];

export function mapClef(clef: XmlElement): Clef {
  const sign = requiredChildText(clef, 'sign');
  const line = childText(clef, 'line');

  if (sign === 'G' && line === '2') {
    return 'treble';
  }

  if (sign === 'F' && line === '4') {
    return 'bass';
  }

  if (sign === 'C' && line === '3') {
    return 'alto';
  }

  if (sign === 'C' && line === '4') {
    return 'tenor';
  }

  if (sign === 'percussion') {
    return 'percussion';
  }

  throw new MusicXmlParseError(`Unsupported clef ${sign}/${line ?? ''}`);
}

export function mapKeySignature(fifths: number, mode = 'major'): KeySignature {
  const normalizedMode = normalizeMode(mode);
  const key =
    normalizedMode === 'minor' ? MINOR_KEYS[fifths] : MAJOR_KEYS[fifths];

  if (!key) {
    throw new MusicXmlParseError(`Unsupported key fifths ${fifths.toString()}`);
  }

  return {
    ...key,
    mode: normalizedMode,
  };
}

export function mapDurationType(type: string): NoteLength {
  switch (type) {
    case 'long':
      return 'long';
    case 'breve':
      return 'breve';
    case 'whole':
      return 'w';
    case 'half':
      return 'h';
    case 'quarter':
      return 'q';
    case 'eighth':
      return '8';
    case '16th':
      return '16';
    case '32nd':
      return '32';
    case '64th':
      return '64';
    case '128th':
      return '128';
    default:
      throw new MusicXmlParseError(`Unsupported note duration type "${type}"`);
  }
}

export function mapPitch(pitch: XmlElement, accidental?: string): Pitch {
  const step = requiredChildText(pitch, 'step');

  if (!isStep(step)) {
    throw new MusicXmlParseError(`Unsupported pitch step "${step}"`);
  }

  return {
    step,
    octave: Number(requiredChildText(pitch, 'octave')),
    accidental: mapAccidental(childText(pitch, 'alter'), accidental),
  };
}

export function mapStemDirection(value?: string) {
  if (!value || value === 'none') {
    return undefined;
  }

  if (value === 'up' || value === 'down') {
    return value;
  }

  throw new MusicXmlParseError(`Unsupported stem direction "${value}"`);
}

export function mapBarline(barline: XmlElement):
  | {
      location: 'left' | 'right';
      value: Barline;
    }
  | undefined {
  const location = barline.attributes.location === 'left' ? 'left' : 'right';
  const repeat = barline.children.find((child) => child.name === 'repeat');
  const barStyle = childText(barline, 'bar-style');

  if (repeat?.attributes.direction === 'forward') {
    return { location, value: 'repeat-begin' };
  }

  if (repeat?.attributes.direction === 'backward') {
    return { location, value: 'repeat-end' };
  }

  if (barStyle === 'light-light') {
    return { location, value: 'double' };
  }

  if (barStyle === 'light-heavy') {
    return { location, value: 'end' };
  }

  if (barStyle === 'regular') {
    return { location, value: 'single' };
  }

  if (!barStyle && hasChild(barline, 'ending')) {
    return undefined;
  }

  throw new MusicXmlParseError(
    `Unsupported barline "${barStyle ?? 'unknown'}"`
  );
}

export function dynamicsFromElement(dynamics: XmlElement): Dynamic[] {
  return dynamics.children
    .map((child) => child.name)
    .filter((name): name is Dynamic => DYNAMICS.includes(name as Dynamic));
}

export function otherDynamicsText(dynamics: XmlElement): string | undefined {
  return childText(dynamics, 'other-dynamics');
}

export function articulationsFromNotations(
  notations?: XmlElement
): Articulation[] {
  if (!notations) {
    return [];
  }

  const articulations = childrenNamed(notations, 'articulations').flatMap(
    (group) => group.children.map((child) => mapArticulation(child.name))
  );

  if (hasChild(notations, 'fermata')) {
    articulations.push('fermata');
  }

  return articulations.filter(
    (item): item is Articulation => item !== undefined
  );
}

function mapArticulation(name: string): Articulation | undefined {
  switch (name) {
    case 'staccato':
    case 'tenuto':
    case 'accent':
    case 'staccatissimo':
      return name;
    case 'strong-accent':
      return 'marcato';
    default:
      throw new MusicXmlParseError(`Unsupported articulation "${name}"`);
  }
}

function mapAccidental(
  alter?: string,
  accidental?: string
): Accidental | undefined {
  if (accidental) {
    switch (accidental) {
      case 'flat-flat':
        return 'bb';
      case 'flat':
        return 'b';
      case 'natural':
        return 'n';
      case 'sharp':
        return '#';
      case 'double-sharp':
        return '##';
      case 'quarter-flat':
        return 'quarter-flat';
      case 'quarter-sharp':
        return 'quarter-sharp';
      default:
        throw new MusicXmlParseError(`Unsupported accidental "${accidental}"`);
    }
  }

  if (alter === undefined) {
    return undefined;
  }

  switch (Number(alter)) {
    case -2:
      return 'bb';
    case -1:
      return 'b';
    case 0:
      return 'n';
    case 1:
      return '#';
    case 2:
      return '##';
    default:
      throw new MusicXmlParseError(`Unsupported pitch alter "${alter}"`);
  }
}

function normalizeMode(mode: string): KeyMode {
  if (mode === 'major' || mode === '') {
    return 'major';
  }

  if (mode === 'minor') {
    return 'minor';
  }

  throw new MusicXmlParseError(`Unsupported key mode "${mode}"`);
}

function isStep(value: string): value is Step {
  return ['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(value);
}
