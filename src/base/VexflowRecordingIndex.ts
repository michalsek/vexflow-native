import type { VexflowRecordingCommand } from './VexflowRecordingTypes';

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
