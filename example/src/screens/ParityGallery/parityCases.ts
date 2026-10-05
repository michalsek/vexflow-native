import type { RendererType } from 'vexflow-native/renderer';

import type { FixtureId } from '../../benchmark/fixtures';
import type { StyleMode } from '../styleOverridePresets';

export type ParityCaseSpec = {
  id: string;
  fixture: FixtureId;
  layout: RendererType;
  /** Measure index scrolled to the start of the viewport. */
  scrollTo?: number;
  /** Timeline step (measure index, onset in whole notes) shown with the
   * playhead and the playback highlight. */
  playback?: { measure: number; onset: number };
  preset?: StyleMode;
};

export const PARITY_CASES: ParityCaseSpec[] = [
  { id: 'short', fixture: 'short', layout: 'document' },
  { id: 'long-scrolled', fixture: 'long', layout: 'document', scrollTo: 104 },
  {
    id: 'infinite-scrolled',
    fixture: 'short',
    layout: 'infiniteScore',
    scrollTo: 2,
  },
  {
    id: 'percussion-one-line',
    fixture: 'percussion-one-line',
    layout: 'document',
  },
  { id: 'grace-notes', fixture: 'drum-kit', layout: 'document' },
  {
    id: 'lyrics-dynamics',
    fixture: 'lyrics-dynamics',
    layout: 'document',
    scrollTo: 4,
  },
  ...(['color', 'glow', 'dash'] as const).map((preset) => ({
    id: `overlay-${preset}`,
    fixture: 'showcase' as const,
    layout: 'documentEven' as const,
    scrollTo: preset === 'dash' ? 2 : undefined,
    preset,
  })),
  {
    id: 'playback-frame',
    fixture: 'short',
    layout: 'document',
    playback: { measure: 0, onset: 0.25 },
  },
];

export const PARITY_SCHEMES = ['light', 'dark'] as const;
