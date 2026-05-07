import { XMLParser } from 'fast-xml-parser';

import type { Score, ScoreMetadata } from '../../state';
import type { ParserState, PartInfo } from './InternalTypes';
import { parsePart } from './PartParser';
import { MusicXmlParseError, type ParseMusicXmlOptions } from './types';
import {
  attr,
  childText,
  childrenNamed,
  firstChild,
  normalizeOrderedXml,
  optionalChild,
  textOf,
  type XmlElement,
} from './XmlOrder';

const xmlParser = new XMLParser({
  attributeNamePrefix: '@_',
  ignoreAttributes: false,
  ignoreDeclaration: true,
  ignorePiTags: true,
  parseAttributeValue: false,
  parseTagValue: false,
  preserveOrder: true,
  textNodeName: '#text',
  trimValues: true,
});

export function parseMusicXmlToScore(
  xml: string,
  options: ParseMusicXmlOptions = {}
): Score {
  const root = findRoot(normalizeOrderedXml(xmlParser.parse(xml)));
  const scoreId = options.scoreId ?? 'musicxml-score';
  const partInfos = parsePartList(root);
  const state: ParserState = {
    scoreId,
    divisions: 1,
    defaults: { meter: { beats: 4, beatUnit: 4 } },
    attachments: [],
    ties: [],
    slurs: [],
    tuplets: [],
    pendingDynamics: new Map(),
    activeTies: new Map(),
    activeSlurs: new Map(),
    activeTuplets: new Map(),
  };
  const staves: Score['staves'] = [];
  const staffGroups: NonNullable<Score['staffGroups']> = [];

  childrenNamed(root, 'part').forEach((part, partIndex) => {
    const partId = attr(part, 'id') ?? `P${(partIndex + 1).toString()}`;
    const partInfo = partInfos.get(partId) ?? { id: partId };
    const parsedPart = parsePart(part, partInfo, staves.length, state);
    staves.push(...parsedPart.staves);
    staffGroups.push(...parsedPart.staffGroups);
  });

  validateClosedSpanners(state);

  return {
    id: scoreId,
    metadata: parseMetadata(root),
    defaults: state.defaults,
    staves,
    staffGroups: staffGroups.length ? staffGroups : undefined,
    attachments: state.attachments.length ? state.attachments : undefined,
    ties: state.ties.length ? state.ties : undefined,
    slurs: state.slurs.length ? state.slurs : undefined,
    tuplets: state.tuplets.length ? state.tuplets : undefined,
  };
}

function findRoot(elements: XmlElement[]): XmlElement {
  const root = elements.find((element) => element.name === 'score-partwise');

  if (!root) {
    if (elements.some((element) => element.name === 'score-timewise')) {
      throw new MusicXmlParseError('MusicXML timewise scores are unsupported');
    }

    throw new MusicXmlParseError('Missing <score-partwise> root');
  }

  return root;
}

function parseMetadata(root: XmlElement): ScoreMetadata | undefined {
  const identification = optionalChild(root, 'identification');
  const workTitle = childText(
    optionalChild(root, 'work') ?? root,
    'work-title'
  );
  const movementTitle = childText(root, 'movement-title');
  const credits = childrenNamed(root, 'credit').map((credit) =>
    childrenNamed(credit, 'credit-words')
      .map(textOf)
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
  );
  const creators = childrenNamed(identification ?? root, 'creator');
  const composer = creators.find(
    (creator) => attr(creator, 'type') === 'composer'
  );
  const metadata: ScoreMetadata = {
    title: workTitle ?? movementTitle ?? credits[0],
    subtitle: workTitle && movementTitle ? movementTitle : credits[1],
    composer: composer ? textOf(composer) : credits[2],
    copyright: identification ? childText(identification, 'rights') : undefined,
  };

  return Object.values(metadata).some(Boolean) ? metadata : undefined;
}

function parsePartList(root: XmlElement): Map<string, PartInfo> {
  const parts = new Map<string, PartInfo>();
  const partList = firstChild(root, 'part-list');

  childrenNamed(partList, 'score-part').forEach((part) => {
    const id = attr(part, 'id');

    if (!id) {
      throw new MusicXmlParseError('Missing score-part id');
    }

    parts.set(id, {
      id,
      name: childText(part, 'part-name'),
    });
  });

  return parts;
}

function validateClosedSpanners(state: ParserState) {
  if (state.activeTuplets.size) {
    state.activeTuplets.clear();
  }
}

export { MusicXmlParseError, type ParseMusicXmlOptions } from './types';
