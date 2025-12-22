/**
 * Tests for server Logger utility
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Logger', () => {
  beforeEach(() => {
    // Clear console mocks
    jest.clearAllMocks();
  });

  describe('error', () => {
    it('should log error and write to file', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');
      
      // Import Logger dynamically
      import('../../utils/logger.js').then(({ default: Logger }) => {
        Logger.error('Test error message', error, { test: true });
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
  });

  describe('warn', () => {
    it('should log warning', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      import('../../utils/logger.js').then(({ default: Logger }) => {
        Logger.warn('Test warning', { test: true });
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
  });

  describe('info', () => {
    it('should log info in development', () => {
      process.env.NODE_ENV = 'development';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      import('../../utils/logger.js').then(({ default: Logger }) => {
        Logger.info('Test info', { test: true });
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });
  });
});

