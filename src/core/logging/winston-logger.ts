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
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

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
 * Real Winston logger implementation
 * 
 * This provides the full Winston logger functionality with enterprise-grade
 * logging capabilities including file rotation, structured logging, and multi-transport support.
 */
@Injectable()
export class WinstonLogger implements IWinstonLogger {
  private requestContext: { requestId?: string; userId?: string } = {};
  private component: string;
  private config: WinstonLoggerConfig;
  private winston: winston.Logger;

  constructor(
    component: string = 'system',
    @Inject(LOGGER_CONFIG) config?: WinstonLoggerConfig,
    @Inject(PROJECT_MANAGER) private projectManager?: ProjectManager
  ) {
    this.component = component;
    this.config = config || this.getDefaultConfig();
    this.winston = this.createWinstonInstance();
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
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      label: this.component,
      meta,
      requestId: this.requestContext.requestId,
      userId: this.requestContext.userId,
      component: this.component
    };

    // Use Winston logger with structured data
    this.winston.log(level, message, {
      ...logEntry,
      ...meta
    });
  }

  child(context: Record<string, any>): IWinstonLogger {
    const childLogger = new WinstonLogger(this.component, this.config, this.projectManager);
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

  private createWinstonInstance(): winston.Logger {
    const transports: winston.transport[] = [];
    const logDir = this.projectManager
      ? path.join(this.projectManager.getHomeDirectory(), 'logs')
      : path.join(process.cwd(), 'logs');

    // Console transport
    if (this.config.transports?.console?.enabled !== false) {
      transports.push(new winston.transports.Console({
        level: this.config.transports?.console?.level || this.config.level,
        format: winston.format.combine(
          winston.format.colorize({ all: true }),
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.printf(({ timestamp, level, message, component, requestId, ...meta }) => {
            const reqId = requestId ? `(${requestId.substring(0, 8)})` : '';
            const comp = component ? `[${component}]` : '';
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} ${level} ${comp}${reqId} ${message}${metaStr}`;
          })
        )
      }));
    }

    // File transport with rotation
    if (this.config.transports?.file?.enabled) {
      const filename = this.config.transports.file.filename || 
        `${logDir}/sker-daemon-%DATE%.log`;
      
      transports.push(new DailyRotateFile({
        filename,
        datePattern: this.config.transports.file.datePattern || 'YYYY-MM-DD',
        zippedArchive: this.config.transports.file.zippedArchive || true,
        maxSize: this.config.transports.file.maxsize || '20m',
        maxFiles: this.config.transports.file.maxFiles || '14d',
        level: this.config.transports.file.level || 'debug',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      }));
    }

    // HTTP transport for remote logging
    if (this.config.transports?.http?.enabled) {
      transports.push(new winston.transports.Http({
        host: this.config.transports.http.host,
        port: this.config.transports.http.port,
        path: this.config.transports.http.path,
        ssl: this.config.transports.http.ssl || false,
        format: winston.format.json()
      }));
    }

    return winston.createLogger({
      level: this.config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
      ),
      defaultMeta: { component: this.component },
      transports,
      exitOnError: this.config.options?.exitOnError || false,
      handleExceptions: this.config.options?.handleExceptions || true,
      handleRejections: this.config.options?.handleRejections || true,
      silent: this.config.options?.silent || false
    });
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
    const logger = new WinstonLogger(component, config, this.projectManager);
    
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
      if (logger instanceof WinstonLogger) {
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