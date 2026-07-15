// Global Jest setup. Mocks native modules so pure-logic tests run under Node.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
