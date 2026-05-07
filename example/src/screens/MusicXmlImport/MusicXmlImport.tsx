import { useFonts } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ScoreRenderer } from 'vexflow-native/renderer';
import type { Score } from 'vexflow-native/state';
import {
  MusicXmlParseError,
  parseMusicXmlToScore,
} from 'vexflow-native/musicxml';

import bravuraFont from '../../../assets/fonts/Bravura.otf';
import { Column, DropDown, Heading, Row, Screen, Text } from '../../components';
import { useColorScheme } from '../../hooks/useColorScheme';
import { MUSIC_XML_IMPORT_FIXTURES } from './fixtures';

type RendererMode = 'documentEven' | 'document' | 'infiniteScore';

type ImportResult =
  | {
      score: Score;
      status: 'parsed';
      summary: ImportSummary;
    }
  | {
      status: 'loading';
    }
  | {
      message: string;
      status: 'error';
    };

type ImportSummary = {
  attachmentCount: number;
  composer: string;
  measureCount: number;
  spannerCount: number;
  staffCount: number;
  title: string;
};

const RENDERER_OPTIONS = [
  { label: 'Document Even', value: 'documentEven' as const },
  { label: 'Document Auto', value: 'document' as const },
  { label: 'Infinite Score', value: 'infiniteScore' as const },
];

const FIXTURE_OPTIONS = MUSIC_XML_IMPORT_FIXTURES.map((fixture) => ({
  label: fixture.label,
  value: fixture.value,
}));

const MusicXmlImport: React.FC = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [fixtureId, setFixtureId] = useState(
    MUSIC_XML_IMPORT_FIXTURES[0]?.value ?? ''
  );
  const [rendererType, setRendererType] =
    useState<RendererMode>('documentEven');
  const [importResult, setImportResult] = useState<ImportResult>({
    status: 'loading',
  });
  const fontManager = useFonts({
    Bravura: [bravuraFont],
  });
  const selectedFixture = useMemo(
    () =>
      MUSIC_XML_IMPORT_FIXTURES.find(
        (fixture) => fixture.value === fixtureId
      ) ?? MUSIC_XML_IMPORT_FIXTURES[0],
    [fixtureId]
  );

  useEffect(() => {
    let isMounted = true;

    async function importFixture() {
      if (!selectedFixture) {
        setImportResult({
          message: 'No MusicXML fixture is available.',
          status: 'error',
        });
        return;
      }

      setImportResult({ status: 'loading' });

      try {
        const xml = await loadFixtureXml(selectedFixture.asset);

        if (!isMounted) {
          return;
        }

        const score = parseMusicXmlToScore(xml, {
          scoreId: selectedFixture.value,
        });

        setImportResult({
          score,
          status: 'parsed',
          summary: createImportSummary(score),
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setImportResult({
          message: getImportErrorMessage(error),
          status: 'error',
        });
      }
    }

    importFixture();

    return () => {
      isMounted = false;
    };
  }, [selectedFixture]);

  if (!fontManager) {
    return null;
  }

  return (
    <Screen
      safeAreaEdges={['left', 'right', 'bottom']}
      style={styles.container}
      padding={0}
    >
      <Column gap={12} style={styles.content}>
        <Column
          gap={12}
          style={[
            styles.header,
            isDark ? styles.headerDark : styles.headerLight,
          ]}
        >
          <Row align="center" gap={12} justify="space-between" wrap>
            <View style={styles.heading}>
              <Heading level={4}>MusicXML Import</Heading>
              <Text variant="muted" style={styles.headingCaption}>
                Parse {selectedFixture?.label ?? 'a fixture'} and inspect the
                rendered score.
              </Text>
            </View>
            <Row align="center" gap={8} wrap style={styles.controls}>
              <View style={styles.control}>
                <DropDown
                  options={FIXTURE_OPTIONS}
                  value={fixtureId}
                  onChange={setFixtureId}
                />
              </View>
              <View style={styles.control}>
                <DropDown
                  options={RENDERER_OPTIONS}
                  value={rendererType}
                  onChange={(value) => setRendererType(value as RendererMode)}
                />
              </View>
            </Row>
          </Row>

          {importResult.status === 'loading' ? (
            <StatusBanner message="Loading MusicXML fixture..." />
          ) : importResult.status === 'parsed' ? (
            <ImportSummaryGrid summary={importResult.summary} />
          ) : (
            <View
              style={[
                styles.errorBanner,
                isDark ? styles.errorBannerDark : styles.errorBannerLight,
              ]}
            >
              <Text style={styles.errorTitle}>Import failed</Text>
              <Text
                style={[
                  styles.errorMessage,
                  isDark ? styles.errorMessageDark : styles.errorMessageLight,
                ]}
              >
                {importResult.message}
              </Text>
            </View>
          )}
        </Column>

        <View style={styles.viewport}>
          {importResult.status === 'parsed' ? (
            <ScoreRenderer
              score={importResult.score}
              defaultFont="Bravura"
              fontManager={fontManager}
              rendererType={rendererType}
            />
          ) : null}
        </View>
      </Column>
    </Screen>
  );
};

export default MusicXmlImport;

const ImportSummaryGrid: React.FC<{ summary: ImportSummary }> = ({
  summary,
}) => {
  return (
    <Row gap={8} wrap>
      <SummaryPill label="Status" value="Parsed" />
      <SummaryPill label="Title" value={summary.title} />
      <SummaryPill label="Composer" value={summary.composer} />
      <SummaryPill label="Staves" value={summary.staffCount.toString()} />
      <SummaryPill label="Measures" value={summary.measureCount.toString()} />
      <SummaryPill
        label="Attachments"
        value={summary.attachmentCount.toString()}
      />
      <SummaryPill label="Spanners" value={summary.spannerCount.toString()} />
    </Row>
  );
};

const SummaryPill: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={[
        styles.summaryPill,
        isDark ? styles.summaryPillDark : styles.summaryPillLight,
      ]}
    >
      <Text variant="muted" style={styles.summaryLabel}>
        {label}
      </Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
};

function createImportSummary(score: Score): ImportSummary {
  return {
    attachmentCount: score.attachments?.length ?? 0,
    composer: score.metadata?.composer ?? 'Unknown',
    measureCount: score.staves.reduce(
      (largestMeasureCount, staff) =>
        Math.max(largestMeasureCount, staff.measures.length),
      0
    ),
    spannerCount:
      (score.ties?.length ?? 0) +
      (score.slurs?.length ?? 0) +
      (score.tuplets?.length ?? 0),
    staffCount: score.staves.length,
    title: score.metadata?.title ?? 'Untitled',
  };
}

function getImportErrorMessage(error: unknown): string {
  if (error instanceof MusicXmlParseError || error instanceof Error) {
    return error.message;
  }

  return 'Unknown MusicXML import error.';
}

async function loadFixtureXml(fixtureAsset: number): Promise<string> {
  const asset = Asset.fromModule(fixtureAsset);
  const downloadedAsset = await asset.downloadAsync();
  const uri = downloadedAsset.localUri ?? downloadedAsset.uri;
  const response = await fetch(uri);

  if (!response.ok) {
    throw new MusicXmlParseError(
      `Could not load MusicXML fixture from ${uri}.`
    );
  }

  return response.text();
}

const StatusBanner: React.FC<{ message: string }> = ({ message }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={[
        styles.statusBanner,
        isDark ? styles.statusBannerDark : styles.statusBannerLight,
      ]}
    >
      <Text style={styles.statusMessage}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    flex: 1,
  },
  control: {
    flex: 1,
    maxWidth: 240,
    minWidth: 180,
  },
  controls: {
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 180,
  },
  errorBanner: {
    borderRadius: 6,
    borderWidth: 1,
    gap: 2,
    padding: 10,
  },
  errorBannerDark: {
    backgroundColor: '#450a0a',
    borderColor: '#991b1b',
  },
  errorBannerLight: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  errorMessage: {
    fontSize: 12,
  },
  errorMessageDark: {
    color: '#fecaca',
  },
  errorMessageLight: {
    color: '#7f1d1d',
  },
  errorTitle: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700',
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerDark: {
    backgroundColor: '#030712',
    borderColor: '#1f2937',
  },
  headerLight: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  heading: {
    flex: 1,
    minWidth: 200,
  },
  headingCaption: {
    fontSize: 12,
  },
  statusBanner: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 10,
  },
  statusBannerDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  statusBannerLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
  },
  statusMessage: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryLabel: {
    fontSize: 10,
    lineHeight: 14,
  },
  summaryPill: {
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 104,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  summaryPillDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  summaryPillLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  viewport: {
    flex: 1,
    overflow: 'hidden',
  },
});
