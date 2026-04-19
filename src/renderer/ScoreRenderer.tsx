import type React from 'react';
import { useCallback, useMemo } from 'react';

import { VexflowCanvas, type OnDrawParams } from '../base';
import type { ScoreOptions, ScoreRendererProps } from './types';
import { insets, spacing, renderOptions } from './constants';
import Renderer from './Renderer';

const ScoreRenderer: React.FC<ScoreRendererProps> = ({
  score,
  rendererType,
  defaultFont,
  fontManager,
  options: userOptions = {},
}) => {
  const options = useMemo(() => withDefaultOptions(userOptions), [userOptions]);

  const onDraw = useCallback(
    ({ ctx, width, height }: OnDrawParams) => {
      const renderer = new Renderer(
        ctx,
        { width, height },
        options,
        score,
        rendererType
      );

      renderer.render();
    },
    [score, rendererType, options]
  );

  return (
    <VexflowCanvas
      onDraw={onDraw}
      defaultFont={defaultFont}
      fontManager={fontManager}
    />
  );
};

export default ScoreRenderer;

function withDefaultOptions(options: Partial<ScoreOptions>): ScoreOptions {
  return {
    insets: { ...insets, ...(options.insets || {}) },
    spacing: { ...spacing, ...(options.spacing || {}) },
    render: { ...renderOptions, ...(options.render || {}) },
  };
}
