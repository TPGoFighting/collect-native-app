import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { SYNC_TASK } from './notifications';
import { syncNow } from './sync';

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
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: 60 });
    return true;
  } catch {
    return false;
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  try {
    await BackgroundTask.unregisterTaskAsync(SYNC_TASK);
  } catch {
    // task may not be registered
  }
}
