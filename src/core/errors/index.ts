/**
 * Error Handling Module Index
 * 
 * Re-exports all error handling related types, classes, and utilities
 * for convenient importing throughout the application.
 */

export * from './types.js';
export * from './error-manager.js';

// Re-export commonly used types for convenience
export type {
  ErrorContext,
  ErrorHandlerFunction,
  IErrorHandler,
  ErrorHandlerConstructor,
  ErrorHandlerEntry,
  ErrorHandlingConfig,
  ErrorRecoveryStrategy,
  ErrorClassifier
} from './types.js';

// Re-export error classes
export {
  McpError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError
} from './types.js';

// Re-export main error manager
export { ErrorManager } from './error-manager.js';

// Re-export enums
export { ErrorCategory } from './types.js';