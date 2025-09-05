/**
 * Logging Module Index
 * 
 * Re-exports all logging-related functionality including Winston logger,
 * console logger, and utility classes for convenient importing.
 */

export * from './winston-logger.js';
export * from '../console-logger.js';

// Re-export commonly used classes
export {
  MockWinstonLogger,
  WinstonLoggerFactory,
  PerformanceLogger,
  StructuredLogger,
  DEFAULT_WINSTON_CONFIG
} from './winston-logger.js';

export {
  ConsoleLogger
} from '../console-logger.js';

// Re-export types
export type {
  WinstonLoggerConfig,
  LogEntry,
  ILoggerFactory,
  IWinstonLogger
} from './winston-logger.js';