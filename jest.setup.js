/* eslint-env jest */
jest.mock('expo-sqlite', () => {
  const db = {
    execSync: jest.fn(),
    runSync: jest.fn(),
    getFirstSync: jest.fn(() => ({ c: 0 })),
    getAllSync: jest.fn(() => []),
  };
  return { openDatabaseSync: jest.fn(() => db) };
});
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { android: { package: 'top.tpgofighting.collect' } } } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) },
}));
jest.mock('expo-background-task', () => ({
  getStatusAsync: jest.fn(() => Promise.resolve(2)),
  registerTaskAsync: jest.fn(() => Promise.resolve()),
  unregisterTaskAsync: jest.fn(() => Promise.resolve()),
  BackgroundTaskStatus: { Available: 2 },
  BackgroundTaskResult: { Success: 1, Failed: 2 },
}));
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'undetermined' })),
  AndroidImportance: { DEFAULT: 3 },
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn(() => Promise.resolve({ isConnected: true, type: 'wifi' })) },
}));
