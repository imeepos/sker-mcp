/**
 * Error Handling Middleware
 * 
 * Enterprise-grade error handling middleware that provides comprehensive error
 * processing, recovery strategies, circuit breakers, and detailed error reporting.
 */

import { Injectable, Inject } from '@sker/di';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
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
 * Error classification types
 */
export enum ErrorType {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  NETWORK = 'network',
  DATABASE = 'database',
  EXTERNAL_SERVICE = 'external_service',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Processed error information
 */
export interface ProcessedError {
  /**
   * Original error
   */
  originalError: any;
  
  /**
   * Error ID for tracking
   */
  errorId: string;
  
  /**
   * Error type classification
   */
  type: ErrorType;
  
  /**
   * Error severity
   */
  severity: ErrorSeverity;
  
  /**
   * User-friendly error message
   */
  userMessage: string;
  
  /**
   * Technical error message for logs
   */
  technicalMessage: string;
  
  /**
   * Error code
   */
  code: string;
  
  /**
   * HTTP status code
   */
  statusCode: number;
  
  /**
   * Retry information
   */
  retryable: boolean;
  
  /**
   * Recovery suggestions
   */
  recoverySuggestions?: string[];
  
  /**
   * Error context
   */
  context: {
    requestId: string;
    methodName: string;
    requestType: string;
    timestamp: number;
    userId?: string;
  };
  
  /**
   * Stack trace (for development)
   */
  stackTrace?: string;
  
  /**
   * Additional error data
   */
  data?: Record<string, any>;
}

/**
 * Circuit breaker state
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /**
   * Error threshold to trigger circuit breaker
   */
  errorThreshold: number;
  
  /**
   * Time window for error counting (ms)
   */
  timeWindow: number;
  
  /**
   * Timeout before trying to close circuit (ms)
   */
  timeout: number;
  
  /**
   * Maximum number of test requests in half-open state
   */
  maxTestRequests: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /**
   * Maximum retry attempts
   */
  maxAttempts: number;
  
  /**
   * Base delay between retries (ms)
   */
  baseDelay: number;
  
  /**
   * Maximum delay between retries (ms)
   */
  maxDelay: number;
  
  /**
   * Exponential backoff multiplier
   */
  backoffMultiplier: number;
  
  /**
   * Jitter factor for randomization
   */
  jitterFactor: number;
  
  /**
   * Error types that should trigger retries
   */
  retryableErrors: ErrorType[];
}

/**
 * Error handler interface
 */
export interface IErrorHandler {
  /**
   * Check if this handler can process the error
   */
  canHandle(error: any, context: MiddlewareContext): boolean;
  
  /**
   * Process the error and return processed error info
   */
  handle(error: any, context: MiddlewareContext): Promise<ProcessedError>;
  
  /**
   * Get handler name
   */
  getName(): string;
}

/**
 * Default error handler
 */
export class DefaultErrorHandler implements IErrorHandler {
  canHandle(error: any, context: MiddlewareContext): boolean {
    return true; // Can handle any error as fallback
  }

  async handle(error: any, context: MiddlewareContext): Promise<ProcessedError> {
    const errorId = this.generateErrorId();
    
    return {
      originalError: error,
      errorId,
      type: this.classifyError(error),
      severity: this.determineSeverity(error),
      userMessage: this.getUserMessage(error),
      technicalMessage: error.message || 'Unknown error occurred',
      code: error.code || 'INTERNAL_ERROR',
      statusCode: this.getStatusCode(error),
      retryable: this.isRetryable(error),
      recoverySuggestions: this.getRecoverySuggestions(error),
      context: {
        requestId: context.requestId,
        methodName: context.methodName,
        requestType: context.requestType,
        timestamp: Date.now(),
        userId: context.metadata?.user?.id
      },
      stackTrace: error.stack,
      data: error.data
    };
  }

  getName(): string {
    return 'DefaultErrorHandler';
  }

  private generateErrorId(): string {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private classifyError(error: any): ErrorType {
    if (error instanceof McpError) {
      switch (error.code) {
        case 'INVALID_PARAMS':
        case 'INVALID_REQUEST':
          return ErrorType.VALIDATION;
        case 'UNAUTHORIZED':
          return ErrorType.AUTHENTICATION;
        case 'METHOD_NOT_FOUND':
        case 'RESOURCE_NOT_FOUND':
          return ErrorType.BUSINESS_LOGIC;
        default:
          return ErrorType.SYSTEM;
      }
    }

    const errorMessage = error.message?.toLowerCase() || '';
    const errorName = error.name?.toLowerCase() || '';

    if (errorMessage.includes('timeout') || errorName.includes('timeout')) {
      return ErrorType.TIMEOUT;
    }
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return ErrorType.NETWORK;
    }
    if (errorMessage.includes('database') || errorMessage.includes('sql')) {
      return ErrorType.DATABASE;
    }
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return ErrorType.VALIDATION;
    }
    if (errorMessage.includes('auth') || errorMessage.includes('permission')) {
      return ErrorType.AUTHENTICATION;
    }

    return ErrorType.UNKNOWN;
  }

  private determineSeverity(error: any): ErrorSeverity {
    if (error instanceof McpError) {
      if (error.code === -32603) return ErrorSeverity.CRITICAL; // Internal error
      if (error.code === -32002) return ErrorSeverity.HIGH; // Unauthorized
      if (error.code === -32602) return ErrorSeverity.MEDIUM; // Invalid params
      return ErrorSeverity.LOW;
    }

    const errorType = this.classifyError(error);
    switch (errorType) {
      case ErrorType.SYSTEM:
      case ErrorType.DATABASE:
        return ErrorSeverity.CRITICAL;
      case ErrorType.EXTERNAL_SERVICE:
      case ErrorType.NETWORK:
        return ErrorSeverity.HIGH;
      case ErrorType.TIMEOUT:
      case ErrorType.BUSINESS_LOGIC:
        return ErrorSeverity.MEDIUM;
      default:
        return ErrorSeverity.LOW;
    }
  }

  private getUserMessage(error: any): string {
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case ErrorType.VALIDATION:
        return 'The provided data is invalid. Please check your input and try again.';
      case ErrorType.AUTHENTICATION:
        return 'Authentication failed. Please check your credentials.';
      case ErrorType.AUTHORIZATION:
        return 'You do not have permission to perform this action.';
      case ErrorType.NETWORK:
        return 'A network error occurred. Please check your connection and try again.';
      case ErrorType.TIMEOUT:
        return 'The request timed out. Please try again.';
      case ErrorType.EXTERNAL_SERVICE:
        return 'An external service is temporarily unavailable. Please try again later.';
      default:
        return 'An unexpected error occurred. Please try again later.';
    }
  }

  private getStatusCode(error: any): number {
    if (error instanceof McpError) {
      return error.code === -32602 ? 400 : // Invalid params
             error.code === -32002 ? 401 : // Unauthorized
             error.code === -32601 ? 404 : // Method not found
             error.code === -32000 ? 404 : // Resource not found
             500;
    }

    const errorType = this.classifyError(error);
    switch (errorType) {
      case ErrorType.VALIDATION:
        return 400;
      case ErrorType.AUTHENTICATION:
        return 401;
      case ErrorType.AUTHORIZATION:
        return 403;
      case ErrorType.BUSINESS_LOGIC:
        return 404;
      case ErrorType.TIMEOUT:
        return 408;
      default:
        return 500;
    }
  }

  private isRetryable(error: any): boolean {
    const errorType = this.classifyError(error);
    return [
      ErrorType.NETWORK,
      ErrorType.TIMEOUT,
      ErrorType.EXTERNAL_SERVICE,
      ErrorType.SYSTEM
    ].includes(errorType);
  }

  private getRecoverySuggestions(error: any): string[] {
    const errorType = this.classifyError(error);
    const suggestions: string[] = [];

    switch (errorType) {
      case ErrorType.VALIDATION:
        suggestions.push('Verify input parameters', 'Check data format and types');
        break;
      case ErrorType.AUTHENTICATION:
        suggestions.push('Check authentication credentials', 'Verify token validity');
        break;
      case ErrorType.NETWORK:
        suggestions.push('Check network connectivity', 'Retry the request');
        break;
      case ErrorType.TIMEOUT:
        suggestions.push('Retry with longer timeout', 'Check system load');
        break;
      case ErrorType.EXTERNAL_SERVICE:
        suggestions.push('Wait and retry', 'Check service status');
        break;
    }

    return suggestions;
  }
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private errorCount = 0;
  private lastErrorTime = 0;
  private lastStateChangeTime = Date.now();
  private testRequestCount = 0;

  constructor(
    private readonly config: CircuitBreakerConfig,
    private readonly logger: ILogger
  ) {}

  async execute<T>(operation: () => Promise<T>, context: string): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastStateChangeTime > this.config.timeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.testRequestCount = 0;
        this.logger.info(`Circuit breaker half-opened for ${context}`);
      } else {
        throw new McpError(
          -32000,
          'Circuit breaker is open',
          { context, state: this.state }
        );
      }
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.testRequestCount >= this.config.maxTestRequests) {
        throw new McpError(
          -32000,
          'Circuit breaker is testing',
          { context, state: this.state }
        );
      }
      this.testRequestCount++;
    }

    try {
      const result = await operation();
      this.onSuccess(context);
      return result;
    } catch (error) {
      this.onError(context);
      throw error;
    }
  }

  private onSuccess(context: string): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.CLOSED;
      this.errorCount = 0;
      this.lastStateChangeTime = Date.now();
      this.logger.info(`Circuit breaker closed for ${context}`);
    }
  }

  private onError(context: string): void {
    this.errorCount++;
    this.lastErrorTime = Date.now();

    if (this.state === CircuitBreakerState.CLOSED && 
        this.errorCount >= this.config.errorThreshold &&
        Date.now() - this.lastErrorTime <= this.config.timeWindow) {
      this.state = CircuitBreakerState.OPEN;
      this.lastStateChangeTime = Date.now();
      this.logger.warn(`Circuit breaker opened for ${context}`);
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      this.lastStateChangeTime = Date.now();
      this.logger.warn(`Circuit breaker re-opened for ${context}`);
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }
}

/**
 * Error handling middleware configuration options
 */
export interface ErrorHandlingMiddlewareOptions {
  /**
   * Custom error handlers
   */
  errorHandlers?: IErrorHandler[];
  
  /**
   * Whether to include stack traces in responses (dev mode)
   */
  includeStackTrace?: boolean;
  
  /**
   * Whether to log all errors
   */
  logErrors?: boolean;
  
  /**
   * Log level for errors
   */
  logLevel?: 'warn' | 'error';
  
  /**
   * Retry configuration
   */
  retryConfig?: Partial<RetryConfig>;
  
  /**
   * Circuit breaker configuration
   */
  circuitBreakerConfig?: Partial<CircuitBreakerConfig>;
  
  /**
   * Whether circuit breaker is enabled
   */
  enableCircuitBreaker?: boolean;
  
  /**
   * Whether to enable automatic retries
   */
  enableRetries?: boolean;
  
  /**
   * Error reporting callback
   */
  onError?: (error: ProcessedError) => void | Promise<void>;
  
  /**
   * Custom error response transformer
   */
  responseTransformer?: (error: ProcessedError) => any;
  
  /**
   * Rate limiting for error logging
   */
  errorLogRateLimit?: {
    maxErrors: number;
    timeWindow: number;
  };
  
  /**
   * Whether to sanitize sensitive data from errors
   */
  sanitizeSensitiveData?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_OPTIONS: Required<Omit<ErrorHandlingMiddlewareOptions, 'errorHandlers' | 'onError' | 'responseTransformer' | 'errorLogRateLimit'>> = {
  includeStackTrace: false,
  logErrors: true,
  logLevel: 'error',
  retryConfig: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    retryableErrors: [ErrorType.NETWORK, ErrorType.TIMEOUT, ErrorType.EXTERNAL_SERVICE]
  },
  circuitBreakerConfig: {
    errorThreshold: 5,
    timeWindow: 60000,
    timeout: 30000,
    maxTestRequests: 3
  },
  enableCircuitBreaker: false,
  enableRetries: false,
  sanitizeSensitiveData: true
};

/**
 * Enterprise-grade error handling middleware implementation
 */
@Injectable()
export class ErrorHandlingMiddleware implements IMiddleware {
  public readonly name = 'ErrorHandlingMiddleware';
  public readonly priority = 999; // Lowest priority - execute as wrapper

  private readonly options: Required<Omit<ErrorHandlingMiddlewareOptions, 'errorHandlers' | 'onError' | 'responseTransformer' | 'errorLogRateLimit'>> &
    Pick<ErrorHandlingMiddlewareOptions, 'errorHandlers' | 'onError' | 'responseTransformer' | 'errorLogRateLimit'>;
  private readonly circuitBreaker?: CircuitBreaker;
  private readonly errorLogCounts = new Map<string, { count: number; resetTime: number }>();

  constructor(
    @Inject(LOGGER) private readonly logger: ILogger,
    options: ErrorHandlingMiddlewareOptions = {}
  ) {
    this.options = { 
      ...DEFAULT_OPTIONS, 
      ...options,
      errorHandlers: options.errorHandlers || [new DefaultErrorHandler()],
      retryConfig: { ...DEFAULT_OPTIONS.retryConfig, ...options.retryConfig },
      circuitBreakerConfig: { ...DEFAULT_OPTIONS.circuitBreakerConfig, ...options.circuitBreakerConfig }
    };

    // Initialize circuit breaker if enabled
    if (this.options.enableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(
        this.options.circuitBreakerConfig,
        this.logger
      );
    }
  }

  async execute(context: MiddlewareContext, next: NextFunction): Promise<any> {
    try {
      // Execute with circuit breaker if enabled
      if (this.circuitBreaker) {
        return await this.circuitBreaker.execute(
          () => this.executeWithRetry(context, next),
          `${context.requestType}.${context.methodName}`
        );
      }

      // Execute with retry if enabled
      if (this.options.enableRetries) {
        return await this.executeWithRetry(context, next);
      }

      // Execute normally
      return await next();
    } catch (error) {
      return await this.handleError(error, context);
    }
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(context: MiddlewareContext, next: NextFunction): Promise<any> {
    const { maxAttempts, baseDelay, maxDelay, backoffMultiplier, jitterFactor } = this.options.retryConfig;
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await next();
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        const processedError = await this.processError(error, context);
        if (!processedError.retryable || attempt === maxAttempts) {
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(
          baseDelay * Math.pow(backoffMultiplier, attempt - 1),
          maxDelay
        );
        const jitter = delay * jitterFactor * Math.random();
        const actualDelay = delay + jitter;

        this.logger.warn(
          `Retrying ${context.methodName} (attempt ${attempt}/${maxAttempts}) after ${actualDelay}ms`,
          { requestId: context.requestId, error: error.message }
        );

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, actualDelay));
      }
    }

    throw lastError;
  }

  /**
   * Handle error with comprehensive processing
   */
  private async handleError(error: any, context: MiddlewareContext): Promise<never> {
    try {
      // Process the error
      const processedError = await this.processError(error, context);
      
      // Log the error if configured
      if (this.options.logErrors && this.shouldLogError(processedError)) {
        this.logError(processedError);
      }

      // Call error reporting callback if provided
      if (this.options.onError) {
        try {
          await this.options.onError(processedError);
        } catch (callbackError) {
          this.logger.error('Error reporting callback failed:', callbackError);
        }
      }

      // Transform error response
      const errorResponse = this.options.responseTransformer 
        ? this.options.responseTransformer(processedError)
        : this.createDefaultErrorResponse(processedError);

      // Throw as MCP error
      throw new McpError(
        -32603,
        errorResponse.message || 'An error occurred',
        errorResponse.data || {}
      );
    } catch (processingError) {
      // If error processing fails, throw original error
      this.logger.error('Error processing failed:', processingError);
      throw error;
    }
  }

  /**
   * Process error using registered handlers
   */
  private async processError(error: any, context: MiddlewareContext): Promise<ProcessedError> {
    const handlers = this.options.errorHandlers || [];
    
    for (const handler of handlers) {
      if (handler.canHandle(error, context)) {
        try {
          const processedError = await handler.handle(error, context);
          
          // Sanitize sensitive data if configured
          if (this.options.sanitizeSensitiveData) {
            this.sanitizeError(processedError);
          }
          
          return processedError;
        } catch (handlerError) {
          this.logger.warn(`Error handler ${handler.getName()} failed:`, handlerError);
        }
      }
    }

    // Fallback to default processing
    const defaultHandler = new DefaultErrorHandler();
    return await defaultHandler.handle(error, context);
  }

  /**
   * Check if error should be logged (respects rate limiting)
   */
  private shouldLogError(processedError: ProcessedError): boolean {
    if (!this.options.errorLogRateLimit) {
      return true;
    }

    const { maxErrors, timeWindow } = this.options.errorLogRateLimit;
    const now = Date.now();
    const key = `${processedError.type}_${processedError.code}`;
    
    const errorLog = this.errorLogCounts.get(key);
    
    if (!errorLog || now > errorLog.resetTime) {
      this.errorLogCounts.set(key, { count: 1, resetTime: now + timeWindow });
      return true;
    }
    
    if (errorLog.count < maxErrors) {
      errorLog.count++;
      return true;
    }
    
    return false;
  }

  /**
   * Log processed error
   */
  private logError(processedError: ProcessedError): void {
    const logData = {
      errorId: processedError.errorId,
      type: processedError.type,
      severity: processedError.severity,
      code: processedError.code,
      statusCode: processedError.statusCode,
      context: processedError.context,
      userMessage: processedError.userMessage,
      technicalMessage: processedError.technicalMessage,
      retryable: processedError.retryable,
      recoverySuggestions: processedError.recoverySuggestions
    };

    if (this.options.includeStackTrace && processedError.stackTrace) {
      logData['stackTrace'] = processedError.stackTrace;
    }

    if (processedError.data) {
      logData['data'] = processedError.data;
    }

    const logMessage = `[${processedError.errorId}] ${processedError.type.toUpperCase()} error in ${processedError.context.methodName}: ${processedError.technicalMessage}`;

    this.logger[this.options.logLevel](logMessage, logData);
  }

  /**
   * Create default error response
   */
  private createDefaultErrorResponse(processedError: ProcessedError): any {
    return {
      code: processedError.code,
      message: processedError.userMessage,
      statusCode: processedError.statusCode,
      data: {
        errorId: processedError.errorId,
        type: processedError.type,
        severity: processedError.severity,
        retryable: processedError.retryable,
        recoverySuggestions: processedError.recoverySuggestions,
        timestamp: processedError.context.timestamp
      }
    };
  }

  /**
   * Sanitize sensitive data from error
   */
  private sanitizeError(processedError: ProcessedError): void {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'credential'];
    
    if (processedError.data) {
      for (const field of sensitiveFields) {
        if (processedError.data[field]) {
          processedError.data[field] = '[REDACTED]';
        }
      }
    }

    if (processedError.stackTrace) {
      // Remove potentially sensitive information from stack trace
      processedError.stackTrace = processedError.stackTrace.replace(
        /(?:password|token|secret|key)=\w+/gi,
        '$1=[REDACTED]'
      );
    }
  }

  /**
   * Add custom error handler
   */
  addErrorHandler(handler: IErrorHandler): void {
    if (!this.options.errorHandlers) {
      this.options.errorHandlers = [];
    }
    this.options.errorHandlers.unshift(handler); // Add to front for priority
    this.logger.info(`Added error handler: ${handler.getName()}`);
  }

  /**
   * Remove error handler
   */
  removeErrorHandler(handlerName: string): boolean {
    if (!this.options.errorHandlers) {
      return false;
    }
    
    const index = this.options.errorHandlers.findIndex(h => h.getName() === handlerName);
    if (index >= 0) {
      this.options.errorHandlers.splice(index, 1);
      this.logger.info(`Removed error handler: ${handlerName}`);
      return true;
    }
    
    return false;
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState | null {
    return this.circuitBreaker?.getState() || null;
  }
}

/**
 * Factory function to create error handling middleware with custom options
 */
// export function createErrorHandlingMiddleware(options: ErrorHandlingMiddlewareOptions = {}) {
//   class CustomErrorHandlingMiddleware extends ErrorHandlingMiddleware {
//     constructor(logger: ILogger) {
//       super(logger, options);
//     }
//   }
//   return CustomErrorHandlingMiddleware;
// }

/**
 * Predefined error handling middleware variants
 */
@Injectable()
export class DevelopmentErrorHandlingMiddleware extends ErrorHandlingMiddleware {
  constructor(@Inject(LOGGER) logger: ILogger) {
    super(logger, {
      includeStackTrace: true,
      logErrors: true,
      logLevel: 'error',
      sanitizeSensitiveData: false
    });
  }
}

@Injectable()
export class ProductionErrorHandlingMiddleware extends ErrorHandlingMiddleware {
  constructor(@Inject(LOGGER) logger: ILogger) {
    super(logger, {
      includeStackTrace: false,
      logErrors: true,
      logLevel: 'error',
      sanitizeSensitiveData: true,
      enableCircuitBreaker: true,
      enableRetries: true,
      errorLogRateLimit: {
        maxErrors: 10,
        timeWindow: 60000 // 1 minute
      }
    });
  }
}

@Injectable()
export class ResilientErrorHandlingMiddleware extends ErrorHandlingMiddleware {
  constructor(@Inject(LOGGER) logger: ILogger) {
    super(logger, {
      enableCircuitBreaker: true,
      enableRetries: true,
      retryConfig: {
        maxAttempts: 5,
        baseDelay: 2000,
        maxDelay: 30000,
        backoffMultiplier: 2.5,
        jitterFactor: 0.2,
        retryableErrors: [
          ErrorType.NETWORK,
          ErrorType.TIMEOUT,
          ErrorType.EXTERNAL_SERVICE,
          ErrorType.SYSTEM
        ]
      },
      circuitBreakerConfig: {
        errorThreshold: 3,
        timeWindow: 30000,
        timeout: 60000,
        maxTestRequests: 2
      }
    });
  }
}