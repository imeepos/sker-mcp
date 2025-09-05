/**
 * Logging Configuration Management
 * 
 * This module provides centralized logging configuration management
 * including environment-based configuration, file rotation settings,
 * and layer-specific configurations.
 */

import { WinstonLoggerConfig } from './winston-logger.js';
import { LayeredLoggerConfig, LogLayer } from './layered-logger.js';
import path from 'path';
import os from 'os';

/**
 * Environment-specific logging configuration
 */
export interface EnvironmentLoggingConfig {
  development: LayeredLoggerConfig;
  production: LayeredLoggerConfig;
  testing: LayeredLoggerConfig;
}

/**
 * File rotation configuration interface
 */
export interface RotationConfig {
  /** Maximum file size before rotation (e.g., '10MB', '50MB') */
  maxSize: string;
  /** Maximum number of files to keep */
  maxFiles: number | string;
  /** Date pattern for rotation (e.g., 'YYYY-MM-DD', 'YYYY-MM-DD-HH') */
  datePattern: string;
  /** Whether to compress archived files */
  zippedArchive: boolean;
  /** Directory for log files */
  logDirectory: string;
  /** Whether to create separate directories per layer */
  separateDirectories: boolean;
}

/**
 * Logging configuration manager
 */
export class LoggingConfigManager {
  static readonly DEFAULT_LOG_DIR = path.join(os.homedir(), '.sker', 'logs');
  
  /**
   * Get default rotation configuration
   */
  static getDefaultRotationConfig(): RotationConfig {
    return {
      maxSize: '20MB',
      maxFiles: 14, // Keep logs for 2 weeks
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      logDirectory: LoggingConfigManager.DEFAULT_LOG_DIR,
      separateDirectories: true
    };
  }

  /**
   * Get platform-specific rotation configuration
   */
  static getPlatformRotationConfig(): RotationConfig {
    const base = LoggingConfigManager.getDefaultRotationConfig();
    return {
      ...base,
      maxSize: '10MB', // Smaller files for platform logs
      maxFiles: 7, // Keep for 1 week only
      datePattern: 'YYYY-MM-DD'
    };
  }

  /**
   * Get application-specific rotation configuration
   */
  static getApplicationRotationConfig(): RotationConfig {
    const base = LoggingConfigManager.getDefaultRotationConfig();
    return {
      ...base,
      maxSize: '50MB', // Larger files for application logs
      maxFiles: 30, // Keep for 1 month
      datePattern: 'YYYY-MM-DD'
    };
  }

  /**
   * Get plugin-specific rotation configuration
   */
  static getPluginRotationConfig(): RotationConfig {
    const base = LoggingConfigManager.getDefaultRotationConfig();
    return {
      ...base,
      maxSize: '5MB', // Smaller files per plugin
      maxFiles: '7d', // Keep for 1 week using time-based retention
      datePattern: 'YYYY-MM-DD-HH' // Hourly rotation for debugging
    };
  }

  /**
   * Create layer-specific configuration
   */
  static createLayerConfig(
    layer: LogLayer,
    baseConfig?: Partial<WinstonLoggerConfig>,
    rotationConfig?: RotationConfig
  ): LayeredLoggerConfig {
    const rotation = rotationConfig || LoggingConfigManager.getDefaultRotationConfig();
    
    // Determine log directory based on layer
    const logDir = rotation.separateDirectories 
      ? path.join(rotation.logDirectory, layer)
      : rotation.logDirectory;

    const config: LayeredLoggerConfig = {
      level: LoggingConfigManager.getLayerLogLevel(layer),
      format: 'simple',
      layer,
      separateFiles: true,
      inheritParentLevel: false,
      transports: {
        console: {
          enabled: true,
          level: LoggingConfigManager.getLayerConsoleLevel(layer),
          colorize: true,
          timestamp: true
        },
        file: {
          enabled: true,
          level: LoggingConfigManager.getLayerFileLevel(layer),
          filename: LoggingConfigManager.getLayerFileName(layer, logDir),
          maxsize: LoggingConfigManager.parseFileSize(rotation.maxSize),
          maxFiles: rotation.maxFiles,
          datePattern: rotation.datePattern,
          zippedArchive: rotation.zippedArchive
        }
      },
      options: {
        exitOnError: false,
        handleExceptions: layer === LogLayer.PLATFORM, // Only platform handles exceptions
        handleRejections: layer === LogLayer.PLATFORM,
        silent: false
      }
    };

    // Merge with base config if provided
    if (baseConfig) {
      return { ...config, ...baseConfig, layer: config.layer };
    }

    return config;
  }

  /**
   * Get environment-specific configuration
   */
  static getEnvironmentConfig(env?: string): LayeredLoggerConfig {
    const environment = env || process.env.NODE_ENV || 'development';
    
    switch (environment) {
      case 'production':
        return LoggingConfigManager.createLayerConfig(LogLayer.APPLICATION, {
          level: 'warn', // Less verbose in production
          transports: {
            console: {
              enabled: false // Disable console in production
            },
            file: {
              enabled: true,
              level: 'info'
            }
          }
        });
        
      case 'testing':
        return LoggingConfigManager.createLayerConfig(LogLayer.APPLICATION, {
          level: 'error', // Minimal logging during tests
          transports: {
            console: {
              enabled: false
            },
            file: {
              enabled: false // No file logging during tests
            }
          },
          options: {
            silent: true // Silent mode for tests
          }
        });
        
      case 'development':
      default:
        return LoggingConfigManager.createLayerConfig(LogLayer.APPLICATION, {
          level: 'debug', // Verbose logging in development
          format: 'dev',
          transports: {
            console: {
              enabled: true,
              level: 'debug',
              colorize: true
            },
            file: {
              enabled: true,
              level: 'debug'
            }
          }
        });
    }
  }

  /**
   * Create complete environment-based configuration set
   */
  static createEnvironmentConfigs(): EnvironmentLoggingConfig {
    return {
      development: LoggingConfigManager.getEnvironmentConfig('development'),
      production: LoggingConfigManager.getEnvironmentConfig('production'),
      testing: LoggingConfigManager.getEnvironmentConfig('testing')
    };
  }

  // === Private Helper Methods ===

  private static getLayerLogLevel(layer: LogLayer): 'error' | 'warn' | 'info' | 'debug' | 'verbose' | 'silly' {
    switch (layer) {
      case LogLayer.PLATFORM:
        return 'warn'; // Platform: Only warnings and errors
      case LogLayer.APPLICATION:
        return 'info'; // Application: Standard logging
      case LogLayer.PLUGIN:
        return 'debug'; // Plugin: Verbose for debugging
      default:
        return 'info';
    }
  }

  private static getLayerConsoleLevel(layer: LogLayer): string {
    switch (layer) {
      case LogLayer.PLATFORM:
        return 'error'; // Platform: Only errors to console
      case LogLayer.APPLICATION:
        return 'info'; // Application: Info and above to console
      case LogLayer.PLUGIN:
        return 'warn'; // Plugin: Only warnings and errors to console
      default:
        return 'info';
    }
  }

  private static getLayerFileLevel(layer: LogLayer): string {
    switch (layer) {
      case LogLayer.PLATFORM:
        return 'warn'; // Platform: Warnings and errors to file
      case LogLayer.APPLICATION:
        return 'debug'; // Application: Debug and above to file
      case LogLayer.PLUGIN:
        return 'debug'; // Plugin: All levels to file
      default:
        return 'debug';
    }
  }

  private static getLayerFileName(layer: LogLayer, logDir: string): string {
    switch (layer) {
      case LogLayer.PLATFORM:
        return path.join(logDir, 'sker-platform-%DATE%.log');
      case LogLayer.APPLICATION:
        return path.join(logDir, 'sker-app-%DATE%.log');
      case LogLayer.PLUGIN:
        return path.join(logDir, 'sker-plugin-%DATE%.log');
      default:
        return path.join(logDir, 'sker-daemon-%DATE%.log');
    }
  }

  private static parseFileSize(size: string): number {
    const units = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024
    };

    const match = size.match(/^(\d+)(B|KB|MB|GB)$/i);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2].toUpperCase() as keyof typeof units;
      return value * units[unit];
    }

    // Default to bytes if parsing fails
    return parseInt(size, 10) || 20971520; // 20MB default
  }
}

/**
 * Production-ready logging configuration
 */
export const PRODUCTION_LOGGING_CONFIG: LayeredLoggerConfig = {
  level: 'warn',
  format: 'json',
  layer: LogLayer.APPLICATION,
  separateFiles: true,
  inheritParentLevel: false,
  transports: {
    console: {
      enabled: false // No console logging in production
    },
    file: {
      enabled: true,
      level: 'info',
      filename: path.join(LoggingConfigManager.DEFAULT_LOG_DIR, 'sker-production-%DATE%.log'),
      maxsize: 52428800, // 50MB
      maxFiles: 30, // Keep for 30 days
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true
    },
    http: {
      enabled: false, // Can be configured for remote logging
      host: 'localhost',
      port: 3000,
      path: '/logs'
    }
  },
  options: {
    exitOnError: false,
    handleExceptions: true,
    handleRejections: true,
    silent: false
  }
};

/**
 * Development-friendly logging configuration
 */
export const DEVELOPMENT_LOGGING_CONFIG: LayeredLoggerConfig = {
  level: 'debug',
  format: 'dev',
  layer: LogLayer.APPLICATION,
  separateFiles: true,
  inheritParentLevel: false,
  transports: {
    console: {
      enabled: true,
      level: 'debug',
      colorize: true,
      timestamp: true
    },
    file: {
      enabled: true,
      level: 'debug',
      filename: path.join(LoggingConfigManager.DEFAULT_LOG_DIR, 'sker-dev-%DATE%.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 7, // Keep for 7 days
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false // No compression in dev
    }
  },
  options: {
    exitOnError: false,
    handleExceptions: true,
    handleRejections: true,
    silent: false
  }
};

/**
 * Get logging configuration based on environment
 */
export function getLoggingConfig(environment?: string): LayeredLoggerConfig {
  return LoggingConfigManager.getEnvironmentConfig(environment);
}

/**
 * Create logging directory structure
 */
export function ensureLogDirectories(config: LayeredLoggerConfig): void {
  if (config.transports?.file?.enabled && config.transports.file.filename) {
    const logDir = path.dirname(config.transports.file.filename);
    try {
      const fs = require('fs');
      fs.mkdirSync(logDir, { recursive: true });
    } catch (error) {
      console.warn(`Failed to create log directory: ${logDir}`, error);
    }
  }
}