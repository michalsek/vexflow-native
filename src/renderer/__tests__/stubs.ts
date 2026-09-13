/* Proportional text-measurement stub so glyph boxes are non-zero under jest,
 * where VexFlow has no canvas and every glyph would otherwise measure 0. */
export const measurementCanvasStub = {
  getContext: (type: string) =>
    type === '2d'
      ? {
          font: '',
          measureText: (text: string) => ({
            width: text.length * 8,
            actualBoundingBoxAscent: 10,
            actualBoundingBoxDescent: 2,
            actualBoundingBoxLeft: 0,
            actualBoundingBoxRight: text.length * 8,
            fontBoundingBoxAscent: 10,
            fontBoundingBoxDescent: 2,
          }),
        }
      : null,
} as unknown as HTMLCanvasElement;

export const fakeFontProvider = {
  countFamilies: () => 1,
  getFamilyName: () => 'Bravura',
  matchFamilyStyle: () => ({}),
};
