import lg8102429MusicXmlAsset from '../../../../src/musicxml/testfiles/lg-8102429.xml';

export type MusicXmlFixture = {
  asset: number;
  label: string;
  value: string;
};

export const MUSIC_XML_IMPORT_FIXTURES: MusicXmlFixture[] = [
  {
    asset: lg8102429MusicXmlAsset,
    label: 'lg-8102429.xml',
    value: 'lg-8102429',
  },
];
