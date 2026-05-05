// import { PT_TO_PX } from './constants';
// import { type ParsedCssFont } from './types';

// export function toPxFontSize(size: number | string | undefined): number {
//   if (size === undefined || size === null) return 12;

//   if (typeof size === 'number' && Number.isFinite(size)) {
//     return size * PT_TO_PX;
//   }

//   if (typeof size === 'string') {
//     const match = size.trim().match(/^(\d+(?:\.\d+)?)(px|pt)?$/i);

//     if (match) {
//       const value = Number.parseFloat(match[1] || '12');
//       const unit = match[2]?.toLowerCase();
//       if (!unit || unit === 'px') return value;
//       return value * PT_TO_PX;
//     }
//   }

//   return 12;
// }

// export function parseCssFontShorthand(cssFont: string): ParsedCssFont {
//   const sizeMatch = cssFont.match(/(\d+(?:\.\d+)?(?:px|pt))/i);

//   if (!sizeMatch) {
//     return { sizePx: 12 };
//   }

//   const sizePx = toPxFontSize(sizeMatch[1]);

//   const family = cssFont
//     .slice((sizeMatch.index ?? 0) + (sizeMatch[1]?.length || 0))
//     .trim();

//   return {
//     sizePx,
//     family: family || undefined,
//   };
// }
