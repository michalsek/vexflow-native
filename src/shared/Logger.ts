import { Platform } from 'react-native';

export enum LogCategory {
  FontManager = 'FontManager',
  SkiaVexflowContext = 'SkiaVexflowContext',
  VexflowCanvas = 'VexflowCanvas',
  Default = 'Default',
}

const disabledCategories: Set<LogCategory> = new Set([
  LogCategory.FontManager,
  // LogCategory.SkiaVexflowContext,
  // LogCategory.VexflowCanvas,
]);

const categoryColors: Record<LogCategory, string> = Platform.select({
  web: {
    [LogCategory.FontManager]: '#1d56b3',
    [LogCategory.SkiaVexflowContext]: 'green',
    [LogCategory.VexflowCanvas]: 'cyan',
    [LogCategory.Default]: 'black',
  },
  default: {
    [LogCategory.FontManager]: '\x1b[34m', // Blue
    [LogCategory.SkiaVexflowContext]: '\x1b[32m', // Green
    [LogCategory.VexflowCanvas]: '\x1b[36m', // Cyan
    [LogCategory.Default]: '\x1b[0m', // Reset
  },
});

class Logger {
  private logCategory: string;

  constructor(category: LogCategory = LogCategory.Default) {
    this.logCategory = category;
  }

  extend(logCategory: LogCategory): Logger {
    return new Logger(logCategory);
  }

  formatMessage(...params: unknown[]) {
    if (Platform.OS === 'web') {
      const color = categoryColors[this.logCategory as LogCategory] || 'black';

      return [
        `%c${this.logCategory}`,
        `background-color: ${color}; font-weight: bold;`,
        ...params,
      ];
    }

    const colorCode =
      categoryColors[this.logCategory as LogCategory] ||
      categoryColors[LogCategory.Default];

    return [`${colorCode}${this.logCategory}`, ...params, '\x1b[0m'];
  }

  log(...params: unknown[]) {
    if (disabledCategories.has(this.logCategory as LogCategory)) {
      return;
    }

    console.log(...this.formatMessage(...params));
  }

  warn(...params: unknown[]) {
    if (disabledCategories.has(this.logCategory as LogCategory)) {
      return;
    }

    console.warn(...this.formatMessage(...params));
  }

  error(...params: unknown[]) {
    if (disabledCategories.has(this.logCategory as LogCategory)) {
      return;
    }

    console.error(...this.formatMessage(...params));
  }
}

export default new Logger();
