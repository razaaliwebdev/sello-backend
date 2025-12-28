/**
 * Jest setup file for server-side tests
 * This fixes NODE_OPTIONS issues by configuring Jest properly
 */

// Set test environment variables
process.env.NODE_ENV = "test";

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Mock MongoDB connection for tests
jest.mock("mongoose", () => ({
  connect: jest.fn(),
  connection: {
    on: jest.fn(),
  },
}));

// Mock logger for tests
jest.mock("./utils/logger.js", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));
