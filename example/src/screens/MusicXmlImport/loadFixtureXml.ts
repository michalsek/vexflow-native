import { Asset } from 'expo-asset';
import { MusicXmlParseError } from 'vexflow-native/musicxml';

export type FixtureLoadResult = {
  timings: {
    assetDownloadMs: number;
    fetchMs: number;
    textDecodeMs: number;
    totalMs: number;
  };
  uri: string;
  xml: string;
};

export async function loadFixtureXml(
  fixtureAsset: number
): Promise<FixtureLoadResult> {
  const totalStart = performance.now();
  const asset = Asset.fromModule(fixtureAsset);
  const assetDownloadStart = performance.now();
  const downloadedAsset = await asset.downloadAsync();
  const assetDownloadMs = performance.now() - assetDownloadStart;
  const uri = downloadedAsset.localUri ?? downloadedAsset.uri;
  const fetchStart = performance.now();
  const response = await fetch(uri);
  const fetchMs = performance.now() - fetchStart;

  if (!response.ok) {
    throw new MusicXmlParseError(
      `Could not load MusicXML fixture from ${uri}.`
    );
  }

  const textDecodeStart = performance.now();
  const xml = await response.text();
  const textDecodeMs = performance.now() - textDecodeStart;

  return {
    timings: {
      assetDownloadMs,
      fetchMs,
      textDecodeMs,
      totalMs: performance.now() - totalStart,
    },
    uri,
    xml,
  };
}
