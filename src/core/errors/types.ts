/**
 * Error Handling System Types
 * 
 * This module defines the core error types, interfaces, and handlers
 * for the comprehensive error handling system.
 */

import type { 
  CallToolRequest, 
  ReadResourceRequest, 
  GetPromptRequest 
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Error context passed to error handlers
 */
export interface ErrorContext {
  /**
   * The original MCP request that caused the error
   */
  request: CallToolRequest | ReadResourceRequest | GetPromptRequest;
  
  /**
   * Type of request (tool, resource, or prompt)
   */
  requestType: 'tool' | 'resource' | 'prompt';
  
  /**
   * Target service instance where the error occurred
   */
  target: any;
  
  /**
   * Method name where the error occurred
   */
  methodName: string;
  
  /**
   * Parsed arguments that were passed to the method
   */
  args?: any;
  
  /**
   * Additional metadata about the error context
   */
  metadata?: Record<string, any>;
  
  /**
   * Timestamp when the error occurred
   */
  errorTime: number;
  
  /**
   * Request ID for tracing purposes
   */
  requestId: string;
  
  /**
   * Execution time before the error occurred
   */
  executionTime?: number;
}

/**
 * Error handler function signature
 */
export type ErrorHandlerFunction = (
  error: Error,
  context: ErrorContext
) => Promise<any> | any;

/**
 * Class-based error handler interface
 */
export interface IErrorHandler {
  /**
   * Handle the error and return a response
   */
  handle(error: Error, context: ErrorContext): Promise<any> | any;
  
  /**
   * Optional error handler name
   */
  name?: string;
  
  /**
   * Optional priority (lower numbers handle first)
   */
  priority?: number;
  
  /**
   * Optional filter to determine if this handler should process the error
   */
  canHandle?(error: Error, context: ErrorContext): boolean;
}

/**
 * Error handler constructor type
 */
export type ErrorHandlerConstructor = new (...args: any[]) => IErrorHandler;

/**
 * Error handler registry entry
 */
export interface ErrorHandlerEntry {
  /**
   * Handler identifier
   */
  id: string;
  
  /**
   * The error handler function or constructor
   */
  handler: ErrorHandlerFunction | ErrorHandlerConstructor;
  
  /**
   * Priority for execution order
   */
  priority: number;
  
  /**
   * Handler metadata
   */
  metadata?: Record<string, any> | undefined;
}

/**
 * Custom MCP error base class
 */
export class McpError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly timestamp: number;
  
  constructor(
    message: string,
    code: string = 'MCP_ERROR',
    statusCode: number = 500,
    details?: any
  ) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = Date.now();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, McpError);
    }
  }
  
  /**
   * Convert error to JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Validation error for input validation failures
 */
export class ValidationError extends McpError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error for auth failures
 */
export class AuthenticationError extends McpError {
  constructor(message: string = 'Authentication failed', details?: any) {
    super(message, 'AUTH_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error for permission failures
 */
export class AuthorizationError extends McpError {
  constructor(message: string = 'Access denied', details?: any) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
    this.name = 'AuthorizationError';
  }
}

/**
 * Not found error
 */
export class NotFoundError extends McpError {
  constructor(message: string = 'Resource not found', details?: any) {
    super(message, 'NOT_FOUND_ERROR', 404, details);
    this.name = 'NotFoundError';
  }
}

/**
 * Rate limiting error
 */
export class RateLimitError extends McpError {
  constructor(message: string = 'Rate limit exceeded', details?: any) {
    super(message, 'RATE_LIMIT_ERROR', 429, details);
    this.name = 'RateLimitError';
  }
}

/**
 * Internal server error
 */
export class InternalServerError extends McpError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(message, 'INTERNAL_SERVER_ERROR', 500, details);
    this.name = 'InternalServerError';
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends McpError {
  constructor(message: string = 'Service unavailable', details?: any) {
    super(message, 'SERVICE_UNAVAILABLE_ERROR', 503, details);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Error handling configuration
 */
export interface ErrorHandlingConfig {
  /**
   * Whether to expose detailed error information
   */
  exposeDetails?: boolean;
  
  /**
   * Whether to log errors automatically
   */
  logErrors?: boolean;
  
  /**
   * Default error handler to use when no specific handler is found
   */
  defaultHandler?: ErrorHandlerFunction | ErrorHandlerConstructor;
  
  /**
   * Global error handlers to apply to all operations
   */
  globalHandlers?: Array<ErrorHandlerFunction | ErrorHandlerConstructor>;
  
  /**
   * Maximum retry attempts for recoverable errors
   */
  maxRetries?: number;
  
  /**
   * Retry delay in milliseconds
   */
  retryDelay?: number;
}

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
  /**
   * Determines if an error can be recovered
   */
  canRecover(error: Error, context: ErrorContext): boolean;
  
  /**
   * Attempts to recover from the error
   */
  recover(error: Error, context: ErrorContext): Promise<any>;
  
  /**
   * Strategy name
   */
  name: string;
}

/**
 * Built-in error types for categorization
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication', 
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  RATE_LIMIT = 'rate_limit',
  INTERNAL = 'internal',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

/**
 * Error classification utility
 */
export interface ErrorClassifier {
  /**
   * Classify an error into a category
   */
  classify(error: Error): ErrorCategory;
  
  /**
   * Determine if an error is recoverable
   */
  isRecoverable(error: Error): boolean;
  
  /**
   * Determine if an error should be retried
   */
  shouldRetry(error: Error, attemptCount: number): boolean;
}