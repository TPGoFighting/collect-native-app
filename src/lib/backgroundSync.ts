import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { SYNC_TASK } from './notifications';
import { syncNow } from './sync';
import { getMeta, setMeta } from './db';

export const BG_SYNC_STATE_KEY = 'bg_sync_registered';

export type BackgroundSyncState = 'registered' | 'failed' | 'unavailable' | 'off' | 'unknown';

/** Last-known background-task registration outcome, persisted at register/unregister time. */
export function getBackgroundSyncState(): BackgroundSyncState {
  const v = getMeta(BG_SYNC_STATE_KEY);
  if (v === '1') return 'registered';
  if (v === '0') return 'failed';
  if (v === 'unavailable') return 'unavailable';
  if (v === 'off') return 'off';
  return 'unknown';
}

// Registered at module scope: background tasks must be defined before the OS invokes them.
TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    const result = await syncNow({ background: true });
    // "Waiting for Wi-Fi" is a normal skip, not a failure.
    return result.error && result.error !== '等待 Wi-Fi'
      ? BackgroundTask.BackgroundTaskResult.Failed
      : BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSync(): Promise<boolean> {
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) {
      setMeta(BG_SYNC_STATE_KEY, 'unavailable');
      return false;
    }
    await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: 60 });
    setMeta(BG_SYNC_STATE_KEY, '1');
    return true;
  } catch {
    setMeta(BG_SYNC_STATE_KEY, '0');
    return false;
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  try {
    await BackgroundTask.unregisterTaskAsync(SYNC_TASK);
  } catch {
    // task may not be registered
  } finally {
    setMeta(BG_SYNC_STATE_KEY, 'off');
  }
}
