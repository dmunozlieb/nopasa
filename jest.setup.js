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
