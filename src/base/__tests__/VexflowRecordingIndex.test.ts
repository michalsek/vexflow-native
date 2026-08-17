import { buildVexflowGroupIndex } from '../VexflowRecordingIndex';
import type { VexflowRecordingCommand } from '../VexflowRecordingTypes';

const paint = { color: '#000000' };

function fillRect(x: number, groupId?: string): VexflowRecordingCommand {
  return {
    type: 'fillRect',
    rect: { x, y: 0, width: 1, height: 1 },
    paint,
    ...(groupId != null ? { groupId } : {}),
  };
}

describe('buildVexflowGroupIndex', () => {
  it('returns an empty index for an empty recording', () => {
    expect(buildVexflowGroupIndex([])).toEqual({});
  });

  it('excludes ungrouped commands', () => {
    const commands = [fillRect(0), { type: 'save' } as const, fillRect(1)];

    expect(buildVexflowGroupIndex(commands)).toEqual({});
  });

  it('buckets grouped commands by groupId preserving recording order', () => {
    const a1 = fillRect(0, 'item-a');
    const a2 = fillRect(1, 'item-a');
    const b1 = fillRect(2, 'item-b');
    const commands = [fillRect(3), a1, a2, fillRect(4), b1];

    const index = buildVexflowGroupIndex(commands);

    expect(Object.keys(index)).toEqual(['item-a', 'item-b']);
    expect(index['item-a']).toEqual([a1, a2]);
    expect(index['item-b']).toEqual([b1]);
  });

  it('references the original command objects without cloning', () => {
    const grouped = fillRect(0, 'item-a');

    const index = buildVexflowGroupIndex([grouped]);

    expect(index['item-a']?.[0]).toBe(grouped);
  });
});
