<<<<<<< HEAD
<<<<<<< HEAD
=======
// SPDX-License-Identifier: Apache-2.0
/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */
>>>>>>> 85c2ac7 (fix:jest.config.js to jest.config.ts)
=======
>>>>>>> 6549427 (fix:jest.config.js to jest.config.ts)
import type { Config } from '@jest/types';
// Sync object
const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  // Set test environment to Node.js
  testEnvironment: 'node',
  // Glob pattern to detect test files
  testMatch: ['**/test/**/*.spec.ts'],
  // Stop running tests after 1 failure (from reference)
  bail: 1,
  // Automatically clear mock calls and instances between tests (from reference)
  clearMocks: true,
  // Collect coverage information during test execution
  collectCoverage: true,
  // Files for which coverage information should be collected
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/main.ts'],
  // Output directory for coverage reports (from reference)
  coverageDirectory: '<rootDir>/coverage/',
  // Files/folders to ignore for coverage (from reference, adjusted for project)
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/test', '.module.ts', './jest.config.ts'],
  // Use V8 for coverage instrumentation (from reference)
  coverageProvider: 'v8',
  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],
  // Minimum coverage thresholds
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  // Do not throw errors on deprecated APIs (from reference)
  errorOnDeprecated: false,
  // Transform TypeScript files using ts-jest (from reference)
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  // Ignore node_modules and dist for test paths (from reference, adjusted)
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Enable verbose output (from reference)
  verbose: true,
};
export default config;
