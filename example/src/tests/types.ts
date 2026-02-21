import { type VexflowCanvasDrawArgs } from 'vexflow-native';

export type CanvasDrawContext = VexflowCanvasDrawArgs['ctx'];

export type VisualCase = {
  id: string;
  title: string;
  description?: string;
  canvasWidth?: number;
  canvasHeight?: number;
  beforeDraw?: (args: VexflowCanvasDrawArgs) => void;
  draw: (args: VexflowCanvasDrawArgs) => void;
};
