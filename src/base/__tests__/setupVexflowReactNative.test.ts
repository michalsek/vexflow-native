import { afterEach, describe, expect, it, jest } from '@jest/globals';

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.resetModules();
});

describe('installVexflowReactNativeFallbacks', () => {
  it('patches Font.fromCSSString on React Native without document access', () => {
    jest.doMock('react-native', () => ({
      Platform: {
        OS: 'ios',
      },
    }));

    const originalFromCSSString = jest.fn(() => {
      throw new Error('document access should not be used');
    });

    jest.doMock('vexflow', () => ({
      Element: {
        getTextMeasurementCanvas: jest.fn(),
        setTextMeasurementCanvas: jest.fn(),
      },
      Font: {
        fromCSSString: originalFromCSSString,
      },
    }));

    let installVexflowReactNativeFallbacks: () => void;
    let Font: {
      fromCSSString: (cssFontShorthand: string) => {
        family: string;
        size: string;
        weight: string;
        style: string;
      };
    };

    jest.isolateModules(() => {
      ({
        installVexflowReactNativeFallbacks,
      } = require('../setupVexflowReactNative'));
      ({ Font } = require('vexflow'));
    });

    installVexflowReactNativeFallbacks!();

    expect(
      Font!.fromCSSString(
        'bold 1.5em/3 "Lucida Sans Typewriter", "Lucida Console", Consolas, monospace'
      )
    ).toEqual({
      family: '"Lucida Sans Typewriter", "Lucida Console", Consolas, monospace',
      size: '1.5em',
      weight: 'bold',
      style: 'normal',
    });
    expect(originalFromCSSString).not.toHaveBeenCalled();
  });

  it('keeps the upstream implementation outside React Native', () => {
    jest.doMock('react-native', () => ({
      Platform: {
        OS: 'web',
      },
    }));

    const originalFromCSSString = jest.fn();

    jest.doMock('vexflow', () => ({
      Element: {
        getTextMeasurementCanvas: jest.fn(),
        setTextMeasurementCanvas: jest.fn(),
      },
      Font: {
        fromCSSString: originalFromCSSString,
      },
    }));

    let installVexflowReactNativeFallbacks: () => void;
    let testExports: {
      originalFromCSSString: typeof originalFromCSSString;
    };
    let Font: {
      fromCSSString: typeof originalFromCSSString;
    };

    jest.isolateModules(() => {
      ({
        installVexflowReactNativeFallbacks,
        __test__: testExports,
      } = require('../setupVexflowReactNative'));
      ({ Font } = require('vexflow'));
    });

    installVexflowReactNativeFallbacks!();

    expect(Font!.fromCSSString).toBe(originalFromCSSString);
    testExports!.originalFromCSSString('10pt Arial');
    expect(originalFromCSSString).toHaveBeenCalledWith('10pt Arial');
  });
});

describe('ensureVexflowTextMeasurementCanvas', () => {
  it('installs an empty text measurement context when no canvas context exists', () => {
    jest.doMock('react-native', () => ({
      Platform: {
        OS: 'ios',
      },
    }));

    const getTextMeasurementCanvas = jest.fn();
    const setTextMeasurementCanvas = jest.fn();

    jest.doMock('vexflow', () => ({
      Element: {
        getTextMeasurementCanvas,
        setTextMeasurementCanvas,
      },
      Font: {
        fromCSSString: jest.fn(),
      },
    }));

    let ensureVexflowTextMeasurementCanvas: () => void;

    jest.isolateModules(() => {
      ({
        ensureVexflowTextMeasurementCanvas,
      } = require('../setupVexflowReactNative'));
    });

    ensureVexflowTextMeasurementCanvas!();

    expect(setTextMeasurementCanvas).toHaveBeenCalledTimes(1);

    const measurementCanvas = setTextMeasurementCanvas.mock.calls[0]?.[0] as {
      getContext: (type: string) => {
        measureText: (text: string) => { width: number };
      } | null;
    };

    expect(measurementCanvas.getContext('webgl')).toBeNull();
    expect(measurementCanvas.getContext('2d')?.measureText('abc')).toEqual(
      expect.objectContaining({ width: 0 })
    );
  });
});
