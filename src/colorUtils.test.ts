import { describe, expect, it } from '@jest/globals';

import { resolveScoreColor } from './colorUtils';

describe('resolveScoreColor', () => {
  it('maps black tokens to active theme score color', () => {
    const themeColor = '#F9FAFB';

    expect(resolveScoreColor('black', themeColor)).toBe(themeColor);
    expect(resolveScoreColor('#000', themeColor)).toBe(themeColor);
    expect(resolveScoreColor('#000000', themeColor)).toBe(themeColor);
    expect(resolveScoreColor('rgb(0, 0, 0)', themeColor)).toBe(themeColor);
    expect(resolveScoreColor('rgba(0, 0, 0, 1)', themeColor)).toBe(themeColor);
  });

  it('maps VexFlow default ledger line tokens to active theme score color', () => {
    const themeColor = '#F9FAFB';

    expect(resolveScoreColor('#444', themeColor)).toBe(themeColor);
    expect(resolveScoreColor('#444444', themeColor)).toBe(themeColor);
    expect(resolveScoreColor('rgb(68, 68, 68)', themeColor)).toBe(themeColor);
    expect(resolveScoreColor('rgba(68, 68, 68, 1)', themeColor)).toBe(
      themeColor
    );
  });

  it('maps VexFlow default tab stave and bend tokens to active theme score color', () => {
    const themeColor = '#F9FAFB';

    expect(resolveScoreColor('#777', themeColor)).toBe(themeColor);
    expect(resolveScoreColor('#777777', themeColor)).toBe(themeColor);
    expect(resolveScoreColor('rgb(119, 119, 119)', themeColor)).toBe(
      themeColor
    );
    expect(resolveScoreColor('rgba(119, 119, 119, 1)', themeColor)).toBe(
      themeColor
    );
    expect(resolveScoreColor('#999', themeColor)).toBe(themeColor);
    expect(resolveScoreColor('#999999', themeColor)).toBe(themeColor);
    expect(resolveScoreColor('rgb(153, 153, 153)', themeColor)).toBe(
      themeColor
    );
    expect(resolveScoreColor('rgba(153, 153, 153, 1)', themeColor)).toBe(
      themeColor
    );
  });

  it('preserves non-black custom colors', () => {
    const themeColor = '#F9FAFB';
    expect(resolveScoreColor('#ef4444', themeColor)).toBe('#ef4444');
  });
});
