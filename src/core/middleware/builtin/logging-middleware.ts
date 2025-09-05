/**
 * Logging Middleware
 * 
 * Enterprise-grade logging middleware that provides structured request/response logging
 * with configurable log levels, formatters, and correlation tracking.
 */

import { Injectable, Inject } from '@sker/di';
import { LOGGER } from '../../tokens.js';
import type { IMiddleware, MiddlewareContext, NextFunction } from '../types.js';

/**
 * Logger interface for dependency injection
 */
interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Logging middleware configuration options
 */
export interface LoggingMiddlewareOptions {
  /**
   * Whether to log request details
   */
  logRequests?: boolean;
  
  /**
   * Whether to log response details
   */
  logResponses?: boolean;
  
  /**
   * Whether to log execution time
   */
  logTiming?: boolean;
  
  /**
   * Whether to log arguments (may contain sensitive data)
   */
  logArguments?: boolean;
  
  /**
   * Whether to log full response data (may be large)
   */
  logResponseData?: boolean;
  
  /**
   * Log level for successful operations
   */
  successLogLevel?: 'debug' | 'info' | 'warn';
  
  /**
   * Log level for failed operations
   */
  errorLogLevel?: 'warn' | 'error';
  
  /**
   * Custom log prefix
   */
  logPrefix?: string;
  
  /**
   * Maximum length for logged data (to prevent huge logs)
   */
  maxDataLength?: number;
  
  /**
   * Fields to exclude from request/response logging
   */
  excludeFields?: string[];
  
  /**
   * Custom correlation ID header name
   */
  correlationIdHeader?: string;
}

/**
 * Default logging middleware configuration
 */
const DEFAULT_OPTIONS: Required<LoggingMiddlewareOptions> = {
  logRequests: true,
  logResponses: true,
  logTiming: true,
  logArguments: false,
  logResponseData: false,
  successLogLevel: 'info',
  errorLogLevel: 'error',
  logPrefix: 'MCP',
  maxDataLength: 1000,
  excludeFields: ['password', 'token', 'secret', 'key', 'auth'],
  correlationIdHeader: 'x-correlation-id'
};

/**
 * Enterprise-grade logging middleware implementation
 */
@Injectable()
export class LoggingMiddleware implements IMiddleware {
  public readonly name = 'LoggingMiddleware';
  public readonly priority = 100; // High priority to log early

  private readonly options: Required<LoggingMiddlewareOptions>;

  constructor(
    @Inject(LOGGER) private readonly logger: ILogger,
    options: LoggingMiddlewareOptions = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async execute(context: MiddlewareContext, next: NextFunction): Promise<any> {
    const startTime = Date.now();
    const { requestId, requestType, methodName } = context;
    const prefix = `[${this.options.logPrefix}:${requestId}]`;

    // Log incoming request
    if (this.options.logRequests) {
      this.logRequest(prefix, context);
    }

    try {
      // Execute the next middleware or handler
      const result = await next();
      
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      
      // Log successful response
      if (this.options.logResponses) {
        this.logSuccess(prefix, context, result, executionTime);
      }
      
      return result;
    } catch (error) {
      // Calculate execution time for error case
      const executionTime = Date.now() - startTime;
      
      // Log error
      this.logError(prefix, context, error, executionTime);
      
      // Re-throw the error to maintain the error flow
      throw error;
    }
  }

  /**
   * Log incoming request details
   */
  private logRequest(prefix: string, context: MiddlewareContext): void {
    const { requestType, methodName, request, args } = context;
    
    const logData: any = {
      type: 'request',
      requestType,
      methodName,
      timestamp: new Date().toISOString(),
      requestId: context.requestId
    };

    // Add request details
    if (request) {
      logData.request = this.sanitizeData({
        method: request.method,
        params: 'params' in request ? request.params : undefined
      });
    }

    // Add arguments if configured
    if (this.options.logArguments && args) {
      logData.arguments = this.sanitizeData(args);
    }

    this.logger[this.options.successLogLevel](
      `${prefix} ${requestType.toUpperCase()} ${methodName} - Request started`,
      logData
    );
  }

  /**
   * Log successful operation completion
   */
  private logSuccess(
    prefix: string,
    context: MiddlewareContext,
    result: any,
    executionTime: number
  ): void {
    const { requestType, methodName } = context;
    
    const logData: any = {
      type: 'response',
      requestType,
      methodName,
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      status: 'success'
    };

    // Add timing information
    if (this.options.logTiming) {
      logData.executionTime = `${executionTime}ms`;
      logData.performance = this.categorizePerformance(executionTime);
    }

    // Add response data if configured
    if (this.options.logResponseData && result) {
      logData.response = this.sanitizeData(result);
    }

    this.logger[this.options.successLogLevel](
      `${prefix} ${requestType.toUpperCase()} ${methodName} - Request completed successfully`,
      logData
    );
  }

  /**
   * Log error operations
   */
  private logError(
    prefix: string,
    context: MiddlewareContext,
    error: any,
    executionTime: number
  ): void {
    const { requestType, methodName } = context;
    
    const logData: any = {
      type: 'error',
      requestType,
      methodName,
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      status: 'error'
    };

    // Add timing information
    if (this.options.logTiming) {
      logData.executionTime = `${executionTime}ms`;
    }

    // Add error details
    if (error) {
      logData.error = {
        name: error.name || 'Error',
        message: error.message || 'Unknown error',
        code: error.code,
        stack: error.stack
      };

      // Add MCP-specific error details if available
      if (error.code && typeof error.code === 'number') {
        logData.error.mcpCode = error.code;
      }
      if (error.data) {
        logData.error.data = this.sanitizeData(error.data);
      }
    }

    this.logger[this.options.errorLogLevel](
      `${prefix} ${requestType.toUpperCase()} ${methodName} - Request failed`,
      logData
    );
  }

  /**
   * Sanitize data by removing sensitive fields and truncating large values
   */
  private sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return this.truncateString(data);
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        // Skip sensitive fields
        if (this.options.excludeFields.some(field => 
          key.toLowerCase().includes(field.toLowerCase())
        )) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }
      
      return sanitized;
    }

    return String(data);
  }

  /**
   * Truncate string if it exceeds maximum length
   */
  private truncateString(str: string): string {
    if (str.length <= this.options.maxDataLength) {
      return str;
    }
    
    return str.substring(0, this.options.maxDataLength) + '... [TRUNCATED]';
  }

  /**
   * Categorize performance based on execution time
   */
  private categorizePerformance(executionTime: number): string {
    if (executionTime < 100) return 'fast';
    if (executionTime < 500) return 'normal';
    if (executionTime < 1000) return 'slow';
    return 'very_slow';
  }
}

// /**
//  * Factory function to create a logging middleware with custom options
//  */
// export function createLoggingMiddleware(options: LoggingMiddlewareOptions = {}) {
//   class CustomLoggingMiddleware extends LoggingMiddleware {
//     constructor(logger: ILogger) {
//       super(logger, options);
//     }
//   }
//   return CustomLoggingMiddleware;
// }

/**
 * Predefined logging middleware variants for common use cases
 */
@Injectable()
export class QuietLoggingMiddleware extends LoggingMiddleware {
  constructor(@Inject(LOGGER) logger: ILogger) {
    super(logger, {
      logRequests: false,
      logResponses: true,
      logArguments: false,
      logResponseData: false,
      successLogLevel: 'debug'
    });
  }
}

@Injectable()
export class VerboseLoggingMiddleware extends LoggingMiddleware {
  constructor(@Inject(LOGGER) logger: ILogger) {
    super(logger, {
      logRequests: true,
      logResponses: true,
      logArguments: true,
      logResponseData: true,
      logTiming: true,
      successLogLevel: 'info'
    });
  }
}

@Injectable()
export class ErrorOnlyLoggingMiddleware extends LoggingMiddleware {
  constructor(@Inject(LOGGER) logger: ILogger) {
    super(logger, {
      logRequests: false,
      logResponses: false,
      logArguments: false,
      logResponseData: false
    });
  }
}