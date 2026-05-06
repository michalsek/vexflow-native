// import { StyleSheet } from 'react-native';
// import { Skia, useFont } from '@shopify/react-native-skia';
// import React, { useCallback, useMemo } from 'react';
// import {
//   ScrollView,
//   StyleSheet,
//   View,
//   useWindowDimensions,
// } from 'react-native';
// import {
//   VexflowRecordingContext,
//   VEXFLOW_SCORE_COLORS,
//   VexflowCanvas,
//   type VexflowCanvasDrawArgs,
// } from 'vexflow-native';

// import { useWindowDimensions } from 'react-native';
// import bravuraFont from '../../assets/fonts/Bravura.otf';
import { Heading, Screen } from '../components';
// import { useColorScheme } from '../hooks/useColorScheme';

const InfiniteScore: React.FC = () => {
  // const { width } = useWindowDimensions();
  // const colorScheme = useColorScheme();
  // const isDark = colorScheme === 'dark';

  return (
    <Screen safeAreaEdges={['left', 'right', 'bottom']}>
      <Heading level={2}>Infinite Score</Heading>
    </Screen>
  );
};

export default InfiniteScore;

// const styles = StyleSheet.create({});

// const VIEWPORT_HEIGHT = 320;

// const InfiniteScore: React.FC = () => {
//   const { width } = useWindowDimensions();
//   const colorScheme = useColorScheme();
//   const isDark = colorScheme === 'dark';
//   const scoreColors = isDark
//     ? VEXFLOW_SCORE_COLORS.dark
//     : VEXFLOW_SCORE_COLORS.light;
//   const themedCardStyle = useMemo(
//     () => ({
//       backgroundColor: isDark ? '#111827' : '#ffffff',
//       borderColor: isDark ? '#374151' : '#d1d5db',
//     }),
//     [isDark]
//   );
//   const previewFont = useFont(bravuraFont, 30);
//   const engine = useMemo(() => new RendererCore<VexflowRecordingContext>(), []);

//   const viewportWidth = Math.max(320, Math.floor(width) - 32);
//   const config = useMemo(
//     () =>
//       createInfiniteScoreExampleConfig({
//         width: viewportWidth,
//         height: VIEWPORT_HEIGHT,
//       }),
//     [viewportWidth]
//   );

//   const plan = useMemo(
//     () =>
//       engine.measure({
//         score: INFINITE_SCORE_EXAMPLE_SCORE,
//         config,
//       }),
//     [config, engine]
//   );

//   const previewResult = useMemo(() => {
//     if (!previewFont) {
//       return null;
//     }

//     const recorder = Skia.PictureRecorder();
//     const canvas = recorder.beginRecording(
//       Skia.XYWHRect(0, 0, plan.contentSize.width, plan.contentSize.height)
//     );
//     const context = new VexflowRecordingContext(previewFont, {
//       defaultFillStyle: scoreColors.fill,
//       defaultStrokeStyle: scoreColors.stroke,
//     });
//     const result = engine.render({
//       plan,
//       context,
//     });

//     recorder.finishRecordingAsPicture();
//     return result;
//   }, [engine, plan, previewFont, scoreColors.fill, scoreColors.stroke]);

//   const handleDraw = useCallback(
//     ({ ctx }: VexflowCanvasDrawArgs) => {
//       engine.render({
//         plan,
//         context: ctx,
//       });
//     },
//     [engine, plan]
//   );

//   const stats = useMemo(
//     () => [
//       {
//         label: 'Viewport Width',
//         value: `${Math.round(config.viewport.width)} px`,
//       },
//       {
//         label: 'Rendered Width',
//         value: `${Math.round(plan.contentSize.width)} px`,
//       },
//       {
//         label: 'Staff Count',
//         value: String(plan.staves.length),
//       },
//       {
//         label: 'Measure Count',
//         value: String(
//           new Set(plan.measures.map((measure) => measure.globalMeasureIndex))
//             .size
//         ),
//       },
//       {
//         label: 'Note Bounds',
//         value: previewResult
//           ? String(previewResult.noteBounds.length)
//           : 'Loading...',
//       },
//     ],
//     [
//       config.viewport.width,
//       plan.contentSize.width,
//       plan.measures,
//       plan.staves,
//       previewResult,
//     ]
//   );

//             <VexflowCanvas
//               colorScheme={isDark ? 'dark' : 'light'}
//               font={bravuraFont}
//               height={plan.contentSize.height}
//               onDraw={handleDraw}
//               width={plan.contentSize.width}
//             />
