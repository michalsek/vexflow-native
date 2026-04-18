import VexflowCanvasShared from './VexflowCanvasShared';
import { useResolvedFontResource } from './fontLoader';
import type { VexflowCanvasProps } from './types';

export default function VexflowCanvas(props: VexflowCanvasProps) {
  const fontResource = useResolvedFontResource(props.font);

  return <VexflowCanvasShared {...props} fontResource={fontResource} />;
}
