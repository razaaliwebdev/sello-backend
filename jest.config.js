/**
 * Jest configuration for server-side tests
 */
export default {
  testEnvironment: "node",
  transform: {},
  extensionsToTreatAsEsm: [".js"],
  moduleNameMapper: {
    "^(\\.{1,2})/.*\\.js$": "$1",
  },
  testMatch: ["**/__tests__/**/*.test.js"],
  collectCoverageFrom: [
    "**/*.js",
    "!**/node_modules/**",
    "!**/__tests__/**",
    "!**/scripts/**",
    "!jest.config.js",
    "!server.js",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "json", "html"],
  verbose: true,
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
};
