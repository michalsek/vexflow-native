import { afterEach, describe, expect, it, jest } from '@jest/globals';

function loadScoreRendererModule() {
  jest.resetModules();

  const mockCanvas = { kind: 'canvas' };
  const mockPicture = { kind: 'picture' };
  const mockBeginRecording = jest.fn(() => mockCanvas);
  const mockFinishRecordingAsPicture = jest.fn(() => mockPicture);
  const mockPictureRecorder = jest.fn(() => ({
    beginRecording: mockBeginRecording,
    finishRecordingAsPicture: mockFinishRecordingAsPicture,
  }));
  const mockXYWHRect = jest.fn(
    (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      width,
      height,
    })
  );
  const mockRenderVexflowRecordingCommands = jest.fn();

  jest.doMock('@shopify/react-native-skia', () => ({
    Canvas: 'Canvas',
    Group: 'Group',
    Picture: 'Picture',
    Skia: {
      PictureRecorder: mockPictureRecorder,
      XYWHRect: mockXYWHRect,
    },
  }));

  jest.doMock('react-native', () => ({
    StyleSheet: {
      create: (styles: unknown) => styles,
    },
  }));

  jest.doMock('react-native-reanimated', () => ({
    useDerivedValue: jest.fn((factory: () => unknown) => ({
      value: factory(),
    })),
    useSharedValue: jest.fn((value: unknown) => ({ value })),
  }));

  jest.doMock('../../base/VexflowRecordingReplay', () => ({
    renderVexflowRecordingCommands: mockRenderVexflowRecordingCommands,
  }));

  const module =
    require('../ScoreRenderer') as typeof import('../ScoreRenderer');

  return {
    createPictureTransform: module.createPictureTransform,
    createScorePicture: module.createScorePicture,
    mockBeginRecording,
    mockCanvas,
    mockFinishRecordingAsPicture,
    mockPicture,
    mockPictureRecorder,
    mockRenderVexflowRecordingCommands,
    mockXYWHRect,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.resetModules();
});

describe('ScoreRenderer picture cache helpers', () => {
  it('records a picture for the full content size', () => {
    const module = loadScoreRendererModule();
    const commands = [{ type: 'save' }] as const;
    const fontManager = { kind: 'font-manager' };

    const picture = module.createScorePicture({
      contentSize: { width: 320, height: 180 },
      defaultFont: 'Bravura',
      fontManager: fontManager as never,
      recordedCommands: commands as never,
    });

    expect(picture).toBe(module.mockPicture);
    expect(module.mockPictureRecorder).toHaveBeenCalledTimes(1);
    expect(module.mockXYWHRect).toHaveBeenCalledWith(0, 0, 320, 180);
    expect(module.mockBeginRecording).toHaveBeenCalledWith({
      x: 0,
      y: 0,
      width: 320,
      height: 180,
    });
    expect(module.mockRenderVexflowRecordingCommands).toHaveBeenCalledWith(
      module.mockCanvas,
      commands,
      fontManager,
      'Bravura'
    );
    expect(module.mockFinishRecordingAsPicture).toHaveBeenCalledTimes(1);
  });

  it('updates scroll transforms without replaying recording commands', () => {
    const module = loadScoreRendererModule();

    module.createScorePicture({
      contentSize: { width: 300, height: 200 },
      defaultFont: 'Bravura',
      fontManager: {} as never,
      recordedCommands: [] as never,
    });
    module.mockRenderVexflowRecordingCommands.mockClear();

    expect(
      module.createPictureTransform(
        40,
        'document',
        { width: 100, height: 80 },
        { width: 300, height: 200 }
      )
    ).toEqual([{ translateX: 0 }, { translateY: -40 }]);
    expect(
      module.createPictureTransform(
        500,
        'documentEven',
        { width: 100, height: 80 },
        { width: 300, height: 200 }
      )
    ).toEqual([{ translateX: 0 }, { translateY: -120 }]);
    expect(
      module.createPictureTransform(
        25,
        'infiniteScore',
        { width: 100, height: 80 },
        { width: 300, height: 200 }
      )
    ).toEqual([{ translateX: -25 }, { translateY: 0 }]);
    expect(
      module.createPictureTransform(
        -10,
        'infiniteScore',
        { width: 100, height: 80 },
        { width: 300, height: 200 }
      )
    ).toEqual([{ translateX: 0 }, { translateY: 0 }]);
    expect(module.mockRenderVexflowRecordingCommands).not.toHaveBeenCalled();
  });
});
