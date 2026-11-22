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
