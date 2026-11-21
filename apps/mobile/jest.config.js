/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Workspace packages ship ESM; let babel transform them like RN libraries.
  transformIgnorePatterns: [
    'node_modules/(?!(?:.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|lucide-react-native|@vybora/.*|standard-navigation))',
  ],
  moduleNameMapper: {
    // Jest picks the 'react-native' export condition (.mjs); use the CJS build in tests.
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js', '^@/assets/(.*)$': '<rootDir>/assets/$1', '^@/(.*)$': '<rootDir>/src/$1' },
  setupFiles: ['./jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
