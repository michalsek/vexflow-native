// import { Skia, useFont } from '@shopify/react-native-skia';
// import React, { useCallback, useMemo } from 'react';
// import {
//   ScrollView,
//   StyleSheet,
//   View,
//   useWindowDimensions,
// } from 'react-native';
// import {
//   SkiaVexflowContext,
//   VEXFLOW_SCORE_COLORS,
//   VexflowCanvas,
//   type VexflowCanvasDrawArgs,
// } from 'vexflow-native';
// import { RendererCore } from 'vexflow-native/renderer';

// import {
//   createInfiniteScoreExampleConfig,
//   INFINITE_SCORE_EXAMPLE_SCORE,
// } from '../../../src/internalExamples/InfiniteScoreExample';
// import bravuraFont from '../../assets/fonts/Bravura.otf';
// import { Column, Heading, Screen, Text } from '../components';
// import { useColorScheme } from '../hooks/useColorScheme';

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
//   const engine = useMemo(() => new RendererCore<SkiaVexflowContext>(), []);

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
//     const context = new SkiaVexflowContext(canvas, previewFont, {
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

//   return (
//     <Screen
//       scrollable
//       contentContainerStyle={styles.container}
//       safeAreaEdges={['left', 'right', 'bottom']}
//     >
//       <Column gap={8}>
//         <Heading level={2}>Infinite Score</Heading>
//         <Text variant="muted">
//           RendererCore measured and rendered this shared example score with the
//           current infinite-score layout mode.
//         </Text>
//       </Column>

//       <View style={[styles.card, themedCardStyle]}>
//         <Text style={styles.cardTitle}>Plan Summary</Text>
//         <View style={styles.statGrid}>
//           {stats.map((item) => (
//             <View key={item.label} style={styles.statItem}>
//               <Text variant="muted" style={styles.statLabel}>
//                 {item.label}
//               </Text>
//               <Text style={styles.statValue}>{item.value}</Text>
//             </View>
//           ))}
//         </View>
//       </View>

//       <View style={[styles.card, themedCardStyle]}>
//         <Text style={styles.cardTitle}>Renderer Output</Text>
//         <Text variant="muted" style={styles.cardDescription}>
//           Scroll horizontally to inspect the full measured score width.
//         </Text>
//         <ScrollView
//           horizontal
//           showsHorizontalScrollIndicator
//           contentContainerStyle={styles.canvasScrollContent}
//           style={styles.canvasScrollView}
//         >
//           <View style={styles.canvasContainer}>
//             <VexflowCanvas
//               colorScheme={isDark ? 'dark' : 'light'}
//               font={bravuraFont}
//               height={plan.contentSize.height}
//               onDraw={handleDraw}
//               width={plan.contentSize.width}
//             />
//           </View>
//         </ScrollView>
//       </View>
//     </Screen>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flexGrow: 1,
//     gap: 16,
//   },
//   card: {
//     borderRadius: 12,
//     borderWidth: 1,
//     padding: 16,
//     gap: 10,
//   },
//   cardTitle: {
//     fontSize: 16,
//     fontWeight: '700',
//   },
//   cardDescription: {
//     fontSize: 12,
//   },
//   statGrid: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     gap: 12,
//   },
//   statItem: {
//     minWidth: 120,
//     gap: 2,
//   },
//   statLabel: {
//     fontSize: 12,
//   },
//   statValue: {
//     fontSize: 15,
//     fontWeight: '700',
//   },
//   canvasScrollContent: {
//     alignItems: 'flex-start',
//   },
//   canvasScrollView: {
//     width: '100%',
//   },
//   canvasContainer: {
//     overflow: 'hidden',
//     borderRadius: 8,
//   },
// });

// export default InfiniteScore;
