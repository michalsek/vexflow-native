/**
 * Runtime switch for the library's internal diagnostics (recording/replay
 * profiling logs). Off by default so consumer dev builds stay quiet; any app
 * (the example app included) can toggle it at runtime:
 *
 *   import { setVexflowNativeDebugEnabled } from 'vexflow-native';
 *   setVexflowNativeDebugEnabled(true);
 *
 * `globalThis.VEXFLOW_NATIVE_DEBUG = true` set before the first log acts as
 * the initial value until the setter is called.
 */
let debugEnabled: boolean | null = null;

export function setVexflowNativeDebugEnabled(enabled: boolean): void {
  debugEnabled = enabled;
}

export function isVexflowNativeDebugEnabled(): boolean {
  if (debugEnabled !== null) {
    return debugEnabled;
  }

  return (
    (globalThis as { VEXFLOW_NATIVE_DEBUG?: unknown }).VEXFLOW_NATIVE_DEBUG ===
    true
  );
}
