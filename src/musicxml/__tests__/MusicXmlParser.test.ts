import fs from 'node:fs';
import path from 'node:path';

import { Formatter } from 'vexflow';

import {
  buildResolvedMeasureStates,
  durationToVF,
  makeVFVoice,
} from '../../renderer/scoreParsing';
import type { Clef, Score, VoiceItem } from '../../state';
import { MusicXmlParseError, parseMusicXmlToScore } from '../MusicXmlParser';

const SIMPLE_PARTWISE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Parser Study</work-title></work>
  <identification>
    <creator type="composer">Ada Composer</creator>
    <rights>Public Domain</rights>
  </identification>
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>480</divisions>
        <key><fifths>4</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
      <direction placement="above">
        <direction-type><words>Allegro</words></direction-type>
        <staff>1</staff>
        <sound tempo="120"/>
      </direction>
      <direction placement="below">
        <direction-type><dynamics><f/></dynamics></direction-type>
        <staff>1</staff>
      </direction>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>480</duration>
        <tie type="start"/>
        <voice>1</voice>
        <type>quarter</type>
        <stem>up</stem>
        <staff>1</staff>
        <notations>
          <tied type="start"/>
          <slur type="start" number="1"/>
          <articulations><staccato/></articulations>
        </notations>
        <lyric number="1"><text>la</text></lyric>
      </note>
      <note>
        <chord/>
        <pitch><step>E</step><octave>4</octave></pitch>
        <duration>480</duration>
        <voice>1</voice>
        <type>quarter</type>
        <stem>up</stem>
        <staff>1</staff>
      </note>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>480</duration>
        <tie type="stop"/>
        <voice>1</voice>
        <type>quarter</type>
        <staff>1</staff>
        <notations>
          <tied type="stop"/>
          <slur type="stop" number="1"/>
        </notations>
      </note>
      <note>
        <rest/>
        <duration>960</duration>
        <voice>5</voice>
        <type>half</type>
        <staff>2</staff>
      </note>
    </measure>
  </part>
</score-partwise>`;

const BEAMED_STEMS_PARTWISE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>480</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>4</octave></pitch>
        <duration>240</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem>down</stem>
        <staff>1</staff>
        <beam number="1">begin</beam>
      </note>
      <note>
        <pitch><step>D</step><octave>4</octave></pitch>
        <duration>240</duration>
        <voice>1</voice>
        <type>eighth</type>
        <stem>down</stem>
        <staff>1</staff>
        <beam number="1">end</beam>
      </note>
    </measure>
  </part>
</score-partwise>`;

describe('parseMusicXmlToScore', () => {
  it('maps partwise MusicXML into Score state', () => {
    const score = parseMusicXmlToScore(SIMPLE_PARTWISE, {
      scoreId: 'simple',
    });

    expect(score).toMatchObject({
      id: 'simple',
      metadata: {
        title: 'Parser Study',
        composer: 'Ada Composer',
        copyright: 'Public Domain',
      },
      defaults: {
        meter: { beats: 4, beatUnit: 4 },
        keySignature: { tonic: 'E', mode: 'major' },
        tempo: { bpm: 120 },
      },
    });
    expect(score.staves).toHaveLength(2);
    expect(score.staffGroups?.[0]).toMatchObject({
      role: 'grandStaff',
      staffIds: ['P1-staff-1', 'P1-staff-2'],
    });

    const trebleVoice = score.staves[0]?.measures[0]?.voices[0];
    expect(trebleVoice?.items[0]).toMatchObject({
      type: 'chord',
      duration: { length: 'q' },
      stemDirection: 'up',
      pitches: [
        { step: 'C', octave: 4 },
        { step: 'E', octave: 4 },
      ],
    });
    expect(score.staves[1]?.measures[0]?.voices[0]?.items[0]).toMatchObject({
      type: 'rest',
      duration: { length: 'h' },
    });
    expect(score.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'dynamic', dynamic: 'f' }),
        expect.objectContaining({
          type: 'articulation',
          articulation: 'staccato',
        }),
        expect.objectContaining({ type: 'lyric', text: 'la', verse: 1 }),
      ])
    );
    expect(score.ties).toHaveLength(1);
    expect(score.slurs).toHaveLength(1);
  });

  it('preserves explicit stems on beamed MusicXML notes', () => {
    const score = parseMusicXmlToScore(BEAMED_STEMS_PARTWISE, {
      scoreId: 'beamed-stems',
    });

    const notes = score.staves[0]?.measures[0]?.voices[0]?.items.filter(
      (item) => item.type === 'note'
    );

    expect(notes).toEqual([
      expect.objectContaining({
        type: 'note',
        stemDirection: 'down',
      }),
      expect.objectContaining({
        type: 'note',
        stemDirection: 'down',
      }),
    ]);
  });

  it('parses the bundled MusicXML fixture', () => {
    const fixturePath = path.join(
      __dirname,
      '..',
      'testfiles',
      'lg-8102429.xml'
    );
    const xml = fs.readFileSync(fixturePath, 'utf8');
    const score = parseMusicXmlToScore(xml);

    expect(score.staves).toHaveLength(2);
    expect(score.staves[0]?.measures).toHaveLength(201);
    expect(score.staves[1]?.measures).toHaveLength(201);
    expect(score.staves[0]?.measures[0]?.voices.length).toBeGreaterThan(0);
    expect(score.staves[1]?.measures[0]?.voices.length).toBeGreaterThan(0);
    expect(score.ties?.length).toBeGreaterThan(0);
    expect(score.slurs?.length).toBeGreaterThan(0);
    expect(score.tuplets?.length).toBeGreaterThan(0);

    const firstTrebleVoice = score.staves[0]?.measures[0]?.voices.find(
      (voice) => voice.name === '1'
    );
    const firstBassVoiceNames = score.staves[1]?.measures[0]?.voices.map(
      (voice) => voice.name
    );

    expect(firstTrebleVoice?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetStaffId: 'P1-staff-2' }),
      ])
    );
    expect(firstBassVoiceNames).not.toContain('1');

    const allItems = score.staves.flatMap((staff) =>
      staff.measures.flatMap((measure) =>
        measure.voices.flatMap((voice) => voice.items)
      )
    );
    expect(allItems.some((item) => item.duration.length === 'long')).toBe(true);
  });

  it('builds complete VexFlow voices for the bundled MusicXML fixture', () => {
    const fixturePath = path.join(
      __dirname,
      '..',
      'testfiles',
      'lg-8102429.xml'
    );
    const xml = fs.readFileSync(fixturePath, 'utf8');
    const score = parseMusicXmlToScore(xml);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const previousDocument = (
      globalThis as typeof globalThis & { document?: unknown }
    ).document;

    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        createElement: (tagName: string) =>
          tagName === 'canvas'
            ? {
                getContext: () => ({
                  measureText: () => ({
                    actualBoundingBoxAscent: 0,
                    actualBoundingBoxDescent: 0,
                    actualBoundingBoxLeft: 0,
                    actualBoundingBoxRight: 0,
                    width: 0,
                  }),
                }),
              }
            : {
                style: {},
              },
      },
    });

    try {
      expect(() => {
        score.staves.forEach((staff) => {
          const resolvedStates = buildResolvedMeasureStates(score, staff);

          staff.measures.forEach((measure, measureIndex) => {
            const resolvedState = resolvedStates[measureIndex]!;

            measure.voices.forEach((voice) => {
              const { vfVoice } = makeVFVoice(
                score,
                resolvedState.meter,
                resolvedState.clef,
                voice,
                {
                  resolveClef: (item) =>
                    resolveTargetClef(score, item, measureIndex) ??
                    resolvedState.clef,
                }
              );

              Formatter.getResolutionMultiplier([vfVoice]);
            });
          });
        });
      }).not.toThrow();
    } finally {
      warnSpy.mockRestore();
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: previousDocument,
      });
    }
  });

  it('throws parser errors for unsupported score-affecting input', () => {
    expect(() =>
      parseMusicXmlToScore(
        SIMPLE_PARTWISE.replace('<type>quarter</type>', '<type>maxima</type>')
      )
    ).toThrow(MusicXmlParseError);
  });

  it('renders preserved long durations using VexFlow double-whole notation', () => {
    expect(durationToVF({ length: 'long' })).toBe('1/2');
    expect(durationToVF({ length: 'breve' })).toBe('1/2');
    expect(durationToVF({ length: 'long' }, true)).toBe('1/2r');
  });
});

function resolveTargetClef(
  score: Score,
  item: VoiceItem,
  measureIndex: number
): Clef | undefined {
  const targetStaff = item.targetStaffId
    ? score.staves.find((staff) => staff.id === item.targetStaffId)
    : undefined;

  if (!targetStaff) {
    return undefined;
  }

  return (
    targetStaff.measures[measureIndex]?.state?.clef ?? targetStaff.defaultClef
  );
}
