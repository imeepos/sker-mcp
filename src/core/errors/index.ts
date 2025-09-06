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

// Re-export error recovery system
export { 
  ErrorRecoveryManager,
  RetryStrategy,
  CircuitBreaker,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG
} from './error-recovery.js';

export {
  RecoveryStrategy,
  CircuitBreakerState,
  type RecoveryResult,
  type RetryConfig,
  type CircuitBreakerConfig,
  type ErrorRecoveryContext
} from './error-recovery.js';

// Re-export enums
export { ErrorCategory } from './types.js';