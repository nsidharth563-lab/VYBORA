jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Reanimated 4: see test/mocks/reanimated.js for why we ship our own mock.
// Also registered as 'react-native-reanimated/mock' because expo-router's
// testing-library re-mocks Reanimated from that path.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('./test/mocks/reanimated'));
jest.mock('react-native-reanimated/mock', () => require('./test/mocks/reanimated'));

// expo-image renders a native view; in tests a plain View with the same props is enough.
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  const Image = (props) => require('react').createElement(View, { ...props, testID: props.testID ?? 'expo-image' });
  return { Image };
});

// expo-secure-store: in-memory keychain for tests.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k, v) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k) => void store.delete(k)),
    __store: store,
  };
});

// Sign in with Apple is iOS-hardware only; tests run as if unavailable.
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => false),
  signInAsync: jest.fn(),
  formatFullName: jest.fn(() => ''),
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { CONTINUE: 1 },
  AppleAuthenticationButtonStyle: { BLACK: 0, WHITE: 1 },
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

// Photo picker: grants access and returns one cropped JPEG.
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true, accessPrivileges: 'all' })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///photos/me.jpg', mimeType: 'image/jpeg', width: 800, height: 800 }] })),
}));
