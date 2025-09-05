import 'reflect-metadata';
import { ConsoleLogger, Logger } from './console-logger';

describe('ConsoleLogger', () => {
  let logger: ConsoleLogger;
  let consoleSpy: {
    error: jest.SpyInstance;
    warn: jest.SpyInstance;
    log: jest.SpyInstance;
  };

  beforeEach(() => {
    // Mock console methods
    consoleSpy = {
      error: jest.spyOn(console, 'error').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      log: jest.spyOn(console, 'log').mockImplementation()
    };

    // Reset environment variable
    delete process.env.LOG_LEVEL;
    
    logger = new ConsoleLogger();
  });

  afterEach(() => {
    // Restore console methods
    consoleSpy.error.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.log.mockRestore();
    
    // Clean up environment
    delete process.env.LOG_LEVEL;
  });

  describe('Constructor and Initialization', () => {
    it('should_create_instance_with_default_log_level', () => {
      const logger = new ConsoleLogger();
      expect(logger).toBeInstanceOf(ConsoleLogger);
    });

    it('should_use_environment_LOG_LEVEL_when_set', () => {
      process.env.LOG_LEVEL = 'debug';
      const logger = new ConsoleLogger();
      
      // Test that debug level is active
      logger.debug('test debug message');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG: test debug message')
      );
    });

    it('should_default_to_info_level_when_LOG_LEVEL_not_set', () => {
      delete process.env.LOG_LEVEL;
      const logger = new ConsoleLogger();
      
      // Debug should not log at info level
      logger.debug('test debug message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
      
      // Info should log
      logger.info('test info message');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('INFO: test info message')
      );
    });
  });

  describe('Log Level Filtering', () => {
    it('should_respect_error_log_level', () => {
      process.env.LOG_LEVEL = 'error';
      const logger = new ConsoleLogger();

      logger.error('error message');
      logger.warn('warn message');
      logger.info('info message');
      logger.debug('debug message');
      logger.trace('trace message');

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should_respect_warn_log_level', () => {
      process.env.LOG_LEVEL = 'warn';
      const logger = new ConsoleLogger();

      logger.error('error message');
      logger.warn('warn message');
      logger.info('info message');
      logger.debug('debug message');

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should_respect_info_log_level', () => {
      process.env.LOG_LEVEL = 'info';
      const logger = new ConsoleLogger();

      logger.error('error message');
      logger.warn('warn message');
      logger.info('info message');
      logger.debug('debug message');

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    });

    it('should_respect_debug_log_level', () => {
      process.env.LOG_LEVEL = 'debug';
      const logger = new ConsoleLogger();

      logger.error('error message');
      logger.warn('warn message');
      logger.info('info message');
      logger.debug('debug message');
      logger.trace('trace message');

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).toHaveBeenCalledTimes(2); // info + debug
    });

    it('should_respect_trace_log_level', () => {
      process.env.LOG_LEVEL = 'trace';
      const logger = new ConsoleLogger();

      logger.error('error message');
      logger.warn('warn message');
      logger.info('info message');
      logger.debug('debug message');
      logger.trace('trace message');

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).toHaveBeenCalledTimes(3); // info + debug + trace
    });

    it('should_handle_invalid_log_level_gracefully', () => {
      process.env.LOG_LEVEL = 'invalid';
      const logger = new ConsoleLogger();

      // Should default to info level behavior
      logger.info('info message');
      logger.debug('debug message');

      expect(consoleSpy.log).toHaveBeenCalledTimes(1); // Only info
    });
  });

  describe('Message Formatting', () => {
    beforeEach(() => {
      process.env.LOG_LEVEL = 'trace'; // Enable all levels
      logger = new ConsoleLogger();
    });

    it('should_format_error_messages_correctly', () => {
      logger.error('test error');
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] ERROR: test error$/)
      );
    });

    it('should_format_warn_messages_correctly', () => {
      logger.warn('test warning');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] WARN: test warning$/)
      );
    });

    it('should_format_info_messages_correctly', () => {
      logger.info('test info');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: test info$/)
      );
    });

    it('should_format_debug_messages_correctly', () => {
      logger.debug('test debug');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] DEBUG: test debug$/)
      );
    });

    it('should_format_trace_messages_correctly', () => {
      logger.trace('test trace');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] TRACE: test trace$/)
      );
    });

    it('should_include_metadata_when_provided', () => {
      const meta = { userId: 123, action: 'login' };
      logger.info('user action', meta);
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('INFO: user action {"userId":123,"action":"login"}')
      );
    });

    it('should_handle_complex_metadata_objects', () => {
      const meta = {
        nested: { data: 'value' },
        array: [1, 2, 3],
        null_value: null,
        undefined_value: undefined
      };
      logger.error('complex meta', meta);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR: complex meta')
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('"nested":{"data":"value"}')
      );
    });

    it('should_not_include_metadata_when_not_provided', () => {
      logger.info('simple message');
      
      const call = consoleSpy.log.mock.calls[0][0];
      expect(call).not.toContain('undefined');
      expect(call).not.toContain('null');
      expect(call).toMatch(/INFO: simple message$/);
    });
  });

  describe('Logger Interface Compliance', () => {
    it('should_implement_Logger_interface', () => {
      const logger: Logger = new ConsoleLogger();
      
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.trace).toBe('function');
    });

    it('should_handle_all_log_methods_without_errors', () => {
      expect(() => {
        logger.error('error');
        logger.warn('warn');
        logger.info('info');
        logger.debug('debug');
        logger.trace('trace');
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should_handle_empty_messages', () => {
      process.env.LOG_LEVEL = 'trace';
      const logger = new ConsoleLogger();
      
      expect(() => {
        logger.info('');
        logger.error('');
      }).not.toThrow();
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('INFO: ')
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR: ')
      );
    });

    it('should_handle_very_long_messages', () => {
      process.env.LOG_LEVEL = 'info';
      const logger = new ConsoleLogger();
      const longMessage = 'a'.repeat(10000);
      
      expect(() => {
        logger.info(longMessage);
      }).not.toThrow();
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining(longMessage)
      );
    });

    it('should_handle_special_characters_in_messages', () => {
      process.env.LOG_LEVEL = 'info';
      const logger = new ConsoleLogger();
      const specialMessage = 'Message with\nnewlines\tand\ttabs and "quotes" and \'apostrophes\'';
      
      expect(() => {
        logger.info(specialMessage);
      }).not.toThrow();
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining(specialMessage)
      );
    });
  });
});
