import 'reflect-metadata';

// Global test setup
beforeAll(() => {
  // Setup global test environment
  process.env.NODE_ENV = 'test';
  process.env.SKER_HOME_DIR = './test-sker-home';
});

afterAll(() => {
  // Clean up after all tests
  delete process.env.SKER_HOME_DIR;
});

// Jest matchers and utilities
expect.extend({
  toBeValidToken(received) {
    const pass = typeof received === 'symbol' && String(received).includes('Token');
    if (pass) {
      return {
        message: () => `expected ${String(received)} not to be a valid token`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${String(received)} to be a valid token`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidToken(): R;
    }
  }
}