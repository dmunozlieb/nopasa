// Stub react-native-safe-area-context so components using useSafeAreaInsets render
// in tests without a real SafeAreaProvider (insets are zero under jsdom).
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaConsumer: ({ children }) => children(insets),
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});

// Mock expo-crypto: jsdom has no randomUUID, so the production IdGenerator would
// return undefined. A fixed RFC-4122 string keeps expoCryptoIdGenerator usable in tests.
jest.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-4000-8000-000000000000',
}));

// Mock the native date picker: render a host View we can find and whose onChange
// we can fire from tests, without pulling in the native module under jsdom.
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props) =>
      React.createElement(View, { testID: 'datetimepicker', onChange: props.onChange }),
  };
});

// Mock expo-notifications: the native module can't load under jsdom. Defaults are
// inert-but-functional (permission granted, no scheduled items) so the adapter is
// importable; the adapter's own test overrides return values per case.
jest.mock('expo-notifications', () => ({
  __esModule: true,
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4, MAX: 5 },
  getPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  setNotificationChannelAsync: jest.fn(async () => null),
  scheduleNotificationAsync: jest.fn(async () => 'mock-id'),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
}));

// Mock expo-file-system: the new File/Paths API can't load its native module under jsdom.
// A tiny stand-in makes the adapter importable; tests inject FakeDataExporter, so the real
// adapter never runs.
jest.mock('expo-file-system', () => ({
  __esModule: true,
  Paths: { cache: 'file:///cache', document: 'file:///document' },
  File: class {
    uri;
    constructor(dir, name) {
      this.uri = `${dir}/${name}`;
    }
    write() {}
  },
}));

// Mock expo-sharing similarly.
jest.mock('expo-sharing', () => ({
  __esModule: true,
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

// Mock expo-text-extractor: the native ML Kit/Vision module can't load under jsdom.
// Inert default (no recognized lines) keeps the adapter/provider importable; the adapter's
// own test overrides the return value, and screen tests inject FakeTextRecognizer.
jest.mock('expo-text-extractor', () => ({
  __esModule: true,
  isSupported: true,
  extractTextFromImage: jest.fn(async () => []),
}));

// Mock expo-document-picker: the native module can't load under jsdom. Inert default
// (cancelled) keeps the adapter/context importable; tests inject FakeDataImporter.
jest.mock('expo-document-picker', () => ({
  __esModule: true,
  getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));

