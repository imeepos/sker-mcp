/**
 * Winston Logger Implementation
 * 
 * This module provides a comprehensive logging system based on Winston,
 * replacing the basic ConsoleLogger with enterprise-grade logging capabilities
 * including file rotation, structured logging, and multi-transport support.
 */

import { Injectable, Inject } from '@sker/di';
import { LOGGER_CONFIG, PROJECT_MANAGER } from '../tokens.js';
import type { ProjectManager } from '../project-manager.js';

/**
 * Winston-based logger configuration
 */
export interface WinstonLoggerConfig {
  /** Logging level */
  level: 'error' | 'warn' | 'info' | 'debug' | 'verbose' | 'silly';
  /** Log format */
  format?: 'json' | 'simple' | 'combined' | 'dev';
  /** Transports configuration */
  transports: {
    /** Console transport */
    console?: {
      enabled: boolean;
      level?: string;
      colorize?: boolean;
      timestamp?: boolean;
    };
    /** File transport */
    file?: {
      enabled: boolean;
      level?: string;
      filename?: string;
      maxsize?: number;
      maxFiles?: number;
      datePattern?: string;
      zippedArchive?: boolean;
    };
    /** HTTP transport for remote logging */
    http?: {
      enabled: boolean;
      host: string;
      port: number;
      path: string;
      ssl?: boolean;
    };
  };
  /** Additional Winston options */
  options?: {
    exitOnError?: boolean;
    silent?: boolean;
    handleExceptions?: boolean;
    handleRejections?: boolean;
  };
}

/**
 * Log entry interface for structured logging
 */
export interface LogEntry {
  /** Log level */
  level: string;
  /** Log message */
  message: string;
  /** Timestamp */
  timestamp: string;
  /** Logger label/category */
  label?: string;
  /** Additional metadata */
  meta?: Record<string, any>;
  /** Error object if logging an error */
  error?: Error;
  /** Request ID for tracing */
  requestId?: string;
  /** User context */
  userId?: string;
  /** Component/service that generated the log */
  component?: string;
}

/**
 * Logger factory interface
 */
export interface ILoggerFactory {
  /** Create a logger for a specific component */
  createLogger(component: string, options?: Partial<WinstonLoggerConfig>): IWinstonLogger;
  /** Get existing logger by component name */
  getLogger(component: string): IWinstonLogger | null;
  /** List all active loggers */
  listLoggers(): string[];
  /** Configure all loggers */
  configure(config: WinstonLoggerConfig): void;
}

/**
 * Enhanced logger interface
 */
export interface IWinstonLogger {
  /** Log at debug level */
  debug(message: string, meta?: any): void;
  /** Log at info level */
  info(message: string, meta?: any): void;
  /** Log at warning level */
  warn(message: string, meta?: any): void;
  /** Log at error level */
  error(message: string, meta?: any): void;
  /** Log with custom level */
  log(level: string, message: string, meta?: any): void;
  /** Create child logger with additional context */
  child(context: Record<string, any>): IWinstonLogger;
  /** Start performance timing */
  startTimer(name: string): () => void;
  /** Set request context for all subsequent logs */
  setRequestContext(requestId: string, userId?: string): void;
  /** Clear request context */
  clearRequestContext(): void;
}

/**
 * Mock Winston logger implementation
 * 
 * This provides the Winston logger interface without requiring the actual
 * Winston dependency to be installed. In production, this would be replaced
 * with the actual Winston implementation.
 */
@Injectable()
export class MockWinstonLogger implements IWinstonLogger {
  private requestContext: { requestId?: string; userId?: string } = {};
  private component: string;
  private config: WinstonLoggerConfig;

  constructor(
    component: string = 'system',
    @Inject(LOGGER_CONFIG) config?: WinstonLoggerConfig
  ) {
    this.component = component;
    this.config = config || this.getDefaultConfig();
  }

  debug(message: string, meta?: any): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: any): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: any): void {
    this.log('error', message, meta);
  }

  log(level: string, message: string, meta?: any): void {
    // Check if logging level is enabled
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      label: this.component,
      meta,
      requestId: this.requestContext.requestId,
      userId: this.requestContext.userId,
      component: this.component
    };

    // Format and output the log entry
    this.outputLogEntry(entry);
  }

  child(context: Record<string, any>): IWinstonLogger {
    const childLogger = new MockWinstonLogger(this.component, this.config);
    childLogger.requestContext = { ...this.requestContext, ...context };
    return childLogger;
  }

  startTimer(name: string): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.info(`Timer ${name} completed`, { duration, timerName: name });
    };
  }

  setRequestContext(requestId: string, userId?: string): void {
    this.requestContext = { requestId, userId };
  }

  clearRequestContext(): void {
    this.requestContext = {};
  }

  private isLevelEnabled(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug', 'verbose', 'silly'];
    const configLevel = this.config.level || 'info';
    const levelIndex = levels.indexOf(level);
    const configLevelIndex = levels.indexOf(configLevel);
    return levelIndex <= configLevelIndex;
  }

  private outputLogEntry(entry: LogEntry): void {
    const format = this.config.format || 'simple';
    let output: string;

    switch (format) {
      case 'json':
        output = JSON.stringify(entry);
        break;
      case 'dev':
        output = this.formatDevOutput(entry);
        break;
      case 'combined':
        output = this.formatCombinedOutput(entry);
        break;
      default:
        output = this.formatSimpleOutput(entry);
    }

    // Output to console if enabled
    if (this.config.transports?.console?.enabled !== false) {
      this.consoleOutput(entry.level, output);
    }

    // In a real implementation, this would also write to file, HTTP, etc.
  }

  private formatSimpleOutput(entry: LogEntry): string {
    const timestamp = entry.timestamp.substring(11, 19); // HH:MM:SS
    const level = entry.level.toUpperCase().padEnd(5);
    const component = entry.component ? `[${entry.component}]` : '';
    const requestId = entry.requestId ? `(${entry.requestId.substring(0, 8)})` : '';
    
    let output = `${timestamp} ${level} ${component}${requestId} ${entry.message}`;
    
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      output += ` ${JSON.stringify(entry.meta)}`;
    }
    
    return output;
  }

  private formatDevOutput(entry: LogEntry): string {
    const level = entry.level.toUpperCase();
    const component = entry.component || 'system';
    const meta = entry.meta ? ` ${JSON.stringify(entry.meta, null, 2)}` : '';
    return `🔍 [${component}] ${level}: ${entry.message}${meta}`;
  }

  private formatCombinedOutput(entry: LogEntry): string {
    return `${entry.timestamp} - ${entry.level}: ${entry.message} ${JSON.stringify({
      component: entry.component,
      requestId: entry.requestId,
      userId: entry.userId,
      meta: entry.meta
    })}`;
  }

  private consoleOutput(level: string, message: string): void {
    switch (level) {
      case 'error':
        console.error(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'debug':
        console.debug(message);
        break;
      default:
        console.log(message);
    }
  }

  private getDefaultConfig(): WinstonLoggerConfig {
    return {
      level: 'info',
      format: 'simple',
      transports: {
        console: {
          enabled: true,
          level: 'info',
          colorize: true,
          timestamp: true
        },
        file: {
          enabled: false
        }
      },
      options: {
        exitOnError: false,
        handleExceptions: true,
        handleRejections: true
      }
    };
  }
}

/**
 * Winston Logger Factory
 */
@Injectable()
export class WinstonLoggerFactory implements ILoggerFactory {
  private loggers = new Map<string, IWinstonLogger>();
  private globalConfig: WinstonLoggerConfig;

  constructor(
    @Inject(LOGGER_CONFIG) config: WinstonLoggerConfig,
    @Inject(PROJECT_MANAGER) private readonly projectManager: ProjectManager
  ) {
    this.globalConfig = config;
  }

  createLogger(component: string, options?: Partial<WinstonLoggerConfig>): IWinstonLogger {
    const config = { ...this.globalConfig, ...options };
    const logger = new MockWinstonLogger(component, config);
    
    this.loggers.set(component, logger);
    return logger;
  }

  getLogger(component: string): IWinstonLogger | null {
    return this.loggers.get(component) || null;
  }

  listLoggers(): string[] {
    return Array.from(this.loggers.keys());
  }

  configure(config: WinstonLoggerConfig): void {
    this.globalConfig = { ...this.globalConfig, ...config };
    
    // Update existing loggers
    for (const [component, logger] of this.loggers.entries()) {
      if (logger instanceof MockWinstonLogger) {
        (logger as any).config = this.globalConfig;
      }
    }
  }
}

/**
 * Performance logging utilities
 */
export class PerformanceLogger {
  constructor(private logger: IWinstonLogger) {}

  /**
   * Log method execution time
   */
  logMethodPerformance<T>(
    target: any,
    methodName: string,
    originalMethod: (...args: any[]) => T
  ): (...args: any[]) => T {
    return (...args: any[]): T => {
      const endTimer = this.logger.startTimer(`${target.constructor.name}.${methodName}`);
      
      try {
        const result = originalMethod.apply(target, args);
        
        if (result instanceof Promise) {
          return result.finally(() => endTimer()) as T;
        }
        
        endTimer();
        return result;
      } catch (error) {
        endTimer();
        this.logger.error(`Method ${target.constructor.name}.${methodName} failed`, {
          error: error instanceof Error ? error.message : String(error),
          args: args.length
        });
        throw error;
      }
    };
  }

  /**
   * Log async operation performance
   */
  async logAsyncOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const endTimer = this.logger.startTimer(operationName);
    this.logger.debug(`Starting async operation: ${operationName}`, context);
    
    try {
      const result = await operation();
      this.logger.debug(`Completed async operation: ${operationName}`, context);
      return result;
    } catch (error) {
      this.logger.error(`Failed async operation: ${operationName}`, {
        error: error instanceof Error ? error.message : String(error),
        context
      });
      throw error;
    } finally {
      endTimer();
    }
  }
}

/**
 * Structured logging utilities
 */
export class StructuredLogger {
  constructor(private logger: IWinstonLogger) {}

  /**
   * Log user action
   */
  logUserAction(action: string, userId: string, details?: Record<string, any>): void {
    this.logger.info(`User action: ${action}`, {
      userId,
      action,
      details,
      category: 'user_action'
    });
  }

  /**
   * Log system event
   */
  logSystemEvent(event: string, details?: Record<string, any>): void {
    this.logger.info(`System event: ${event}`, {
      event,
      details,
      category: 'system_event'
    });
  }

  /**
   * Log security event
   */
  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: Record<string, any>): void {
    const logMethod = severity === 'critical' || severity === 'high' ? this.logger.error : this.logger.warn;
    
    logMethod(`Security event: ${event}`, {
      event,
      severity,
      details,
      category: 'security_event'
    });
  }

  /**
   * Log API request
   */
  logApiRequest(method: string, path: string, statusCode: number, duration: number, details?: Record<string, any>): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    
    this.logger.log(level, `API ${method} ${path} ${statusCode}`, {
      method,
      path,
      statusCode,
      duration,
      details,
      category: 'api_request'
    });
  }
}

/**
 * Default Winston logger configuration
 */
export const DEFAULT_WINSTON_CONFIG: WinstonLoggerConfig = {
  level: 'info',
  format: 'simple',
  transports: {
    console: {
      enabled: true,
      level: 'info',
      colorize: true,
      timestamp: true
    },
    file: {
      enabled: true,
      level: 'debug',
      filename: 'logs/sker-daemon-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxsize: 20971520, // 20MB
      maxFiles: 14 // 2 weeks
    }
  },
  options: {
    exitOnError: false,
    handleExceptions: true,
    handleRejections: true
  }
};