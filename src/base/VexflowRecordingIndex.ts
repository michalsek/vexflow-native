import type { VexflowRecordingCommand } from './VexflowRecordingTypes';

/**
 * Commands of a recording grouped by `groupId`, in recording order. Only
 * commands stamped by `beginColorGroup`/`endColorGroup` appear here — untagged
 * chrome (staff lines, clefs, …) can never be style-overridden, so a replay of
 * `index[groupId]` slices is sufficient to redraw everything an
 * `styleOverrides` map can affect.
 */
export type VexflowRecordingGroupIndex = Readonly<
  Record<string, readonly VexflowRecordingCommand[]>
>;

export function buildVexflowGroupIndex(
  commands: readonly VexflowRecordingCommand[]
): VexflowRecordingGroupIndex {
  const index: Record<string, VexflowRecordingCommand[]> = {};

  for (const command of commands) {
    if (command.groupId == null) {
      continue;
    }

    (index[command.groupId] ??= []).push(command);
  }

  return index;
}
