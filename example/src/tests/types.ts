import { type OnDrawParams } from 'vexflow-native';

export type CanvasDrawContext = OnDrawParams['ctx'];

export type VisualCase = {
  id: string;
  title: string;
  description?: string;
  canvasWidth?: number;
  canvasHeight?: number;
  beforeDraw?: (args: OnDrawParams) => void;
  draw: (args: OnDrawParams) => void;
};
