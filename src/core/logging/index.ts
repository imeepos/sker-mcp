/**
 * Logging Module Index
 * 
 * Re-exports all logging-related functionality including Winston logger,
 * layered logger system, console logger, and utility classes for convenient importing.
 */

export * from './winston-logger.js';
export * from './layered-logger.js';
export * from './logging-config.js';
export * from '../console-logger.js';

// Re-export commonly used classes
export {
  WinstonLogger,
  WinstonLoggerFactory,
  PerformanceLogger,
  StructuredLogger,
  DEFAULT_WINSTON_CONFIG
} from './winston-logger.js';

export {
  LayeredWinstonLogger,
  LayeredLoggerFactory,
  LoggerUtils,
  DEFAULT_LAYERED_CONFIG,
  LogLayer
} from './layered-logger.js';

export {
  LoggingConfigManager,
  PRODUCTION_LOGGING_CONFIG,
  DEVELOPMENT_LOGGING_CONFIG,
  getLoggingConfig,
  ensureLogDirectories
} from './logging-config.js';

// Re-export types
export type {
  WinstonLoggerConfig,
  LogEntry,
  ILoggerFactory,
  IWinstonLogger
} from './winston-logger.js';

export type {
  LayeredLoggerConfig,
  ILayeredLoggerFactory
} from './layered-logger.js';

export type {
  EnvironmentLoggingConfig,
  RotationConfig
} from './logging-config.js';