import type { Score } from '../../state';

export interface ParseMusicXmlOptions {
  scoreId?: string;
}

export interface MusicXmlParseContext {
  path: string;
}

export type ParseMusicXmlToScore = (
  xml: string,
  options?: ParseMusicXmlOptions
) => Score;

export class MusicXmlParseError extends Error {
  path?: string;

  constructor(message: string, context?: MusicXmlParseContext) {
    super(context?.path ? `${message} at ${context.path}` : message);
    this.name = 'MusicXmlParseError';
    this.path = context?.path;
  }
}
