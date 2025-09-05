/**
 * Built-in Middleware Index
 * 
 * This module exports all built-in enterprise-grade middleware implementations
 * for easy import and usage throughout the application.
 */

// Logging Middleware
export {
  LoggingMiddleware,
  LoggingMiddlewareOptions,
  QuietLoggingMiddleware,
  VerboseLoggingMiddleware,
  ErrorOnlyLoggingMiddleware,
  // createLoggingMiddleware
} from './logging-middleware.js';

// Validation Middleware
export {
  ValidationMiddleware,
  ValidationMiddlewareOptions,
  ValidationResult,
  ValidationError,
  StrictValidationMiddleware,
  LenientValidationMiddleware,
  // createValidationMiddleware
} from './validation-middleware.js';

// Cache Middleware
export {
  CacheMiddleware,
  CacheMiddlewareOptions,
  CacheEntry,
  CacheStats,
  ICacheStorage,
  MemoryCacheStorage,
  ShortTermCacheMiddleware,
  LongTermCacheMiddleware,
  // createCacheMiddleware
} from './cache-middleware.js';

// Authentication Middleware
export {
  AuthenticationMiddleware,
  AuthenticationMiddlewareOptions,
  UserPrincipal,
  AuthToken,
  IAuthProvider,
  TokenAuthProvider,
  ApiKeyAuthProvider,
  TokenExtractor,
  DefaultTokenExtractors,
  OptionalAuthenticationMiddleware,
  StrictAuthenticationMiddleware,
  // createAuthenticationMiddleware
} from './authentication-middleware.js';

// Performance Middleware
export {
  PerformanceMiddleware,
  PerformanceMiddlewareOptions,
  PerformanceMetrics,
  PerformanceStats,
  PerformanceAlert,
  LightweightPerformanceMiddleware,
  DetailedPerformanceMiddleware,
  // createPerformanceMiddleware
} from './performance-middleware.js';

// Error Handling Middleware
export {
  ErrorHandlingMiddleware,
  ErrorHandlingMiddlewareOptions,
  ProcessedError,
  ErrorType,
  ErrorSeverity,
  IErrorHandler,
  DefaultErrorHandler,
  CircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerConfig,
  RetryConfig,
  DevelopmentErrorHandlingMiddleware,
  ProductionErrorHandlingMiddleware,
  ResilientErrorHandlingMiddleware,
  // createErrorHandlingMiddleware
} from './error-handling-middleware.js';

/**
 * Built-in middleware factory functions for common configurations
 */
export class BuiltinMiddlewareFactory {
  /**
   * Create a standard enterprise middleware stack
   * Order: Authentication → Validation → Caching → Logging → Performance → ErrorHandling
   */
  static createEnterpriseStack(options: {
    authentication?: boolean;
    validation?: boolean;
    caching?: boolean;
    logging?: boolean;
    performance?: boolean;
    errorHandling?: boolean;
  } = {}): Array<new (...args: any[]) => any> {
    const middlewares: Array<new (...args: any[]) => any> = [];

    // Add middlewares in execution order (by priority)
    if (options.authentication !== false) {
      middlewares.push(AuthenticationMiddleware);
    }
    
    if (options.validation !== false) {
      middlewares.push(ValidationMiddleware);
    }
    
    if (options.caching !== false) {
      middlewares.push(CacheMiddleware);
    }
    
    if (options.logging !== false) {
      middlewares.push(LoggingMiddleware);
    }
    
    if (options.performance !== false) {
      middlewares.push(PerformanceMiddleware);
    }
    
    if (options.errorHandling !== false) {
      middlewares.push(ErrorHandlingMiddleware);
    }

    return middlewares;
  }

  /**
   * Create a development-friendly middleware stack
   */
  static createDevelopmentStack(): Array<new (...args: any[]) => any> {
    return [
      OptionalAuthenticationMiddleware,
      LenientValidationMiddleware,
      VerboseLoggingMiddleware,
      DetailedPerformanceMiddleware,
      DevelopmentErrorHandlingMiddleware
    ];
  }

  /**
   * Create a production-optimized middleware stack
   */
  static createProductionStack(): Array<new (...args: any[]) => any> {
    return [
      StrictAuthenticationMiddleware,
      StrictValidationMiddleware,
      LongTermCacheMiddleware,
      QuietLoggingMiddleware,
      LightweightPerformanceMiddleware,
      ProductionErrorHandlingMiddleware
    ];
  }

  /**
   * Create a high-performance middleware stack
   */
  static createHighPerformanceStack(): Array<new (...args: any[]) => any> {
    return [
      OptionalAuthenticationMiddleware,
      LenientValidationMiddleware,
      ShortTermCacheMiddleware,
      ErrorOnlyLoggingMiddleware,
      ResilientErrorHandlingMiddleware
    ];
  }

  /**
   * Create a secure middleware stack
   */
  static createSecureStack(): Array<new (...args: any[]) => any> {
    return [
      StrictAuthenticationMiddleware,
      StrictValidationMiddleware,
      VerboseLoggingMiddleware,
      DetailedPerformanceMiddleware,
      ResilientErrorHandlingMiddleware
    ];
  }

  /**
   * Create a minimal middleware stack
   */
  static createMinimalStack(): Array<new (...args: any[]) => any> {
    return [
      ErrorOnlyLoggingMiddleware,
      ErrorHandlingMiddleware
    ];
  }
}

/**
 * Middleware configuration presets
 */
export class MiddlewarePresets {
  /**
   * Get logging middleware configuration for different environments
   */
  static getLoggingConfig(env: 'development' | 'staging' | 'production'): LoggingMiddlewareOptions {
    switch (env) {
      case 'development':
        return {
          logRequests: true,
          logResponses: true,
          logArguments: true,
          logResponseData: true,
          successLogLevel: 'debug',
          logPrefix: 'DEV-MCP'
        };
      case 'staging':
        return {
          logRequests: true,
          logResponses: true,
          logArguments: false,
          logResponseData: false,
          successLogLevel: 'info',
          logPrefix: 'STG-MCP'
        };
      case 'production':
        return {
          logRequests: false,
          logResponses: true,
          logArguments: false,
          logResponseData: false,
          successLogLevel: 'warn',
          logPrefix: 'PROD-MCP'
        };
    }
  }

  /**
   * Get validation middleware configuration for different strictness levels
   */
  static getValidationConfig(level: 'strict' | 'normal' | 'lenient'): ValidationMiddlewareOptions {
    switch (level) {
      case 'strict':
        return {
          stripUnknown: true,
          coerceTypes: false,
          validateParams: true,
          validateResponse: true,
          abortEarly: false,
          includeErrorPaths: true
        };
      case 'normal':
        return {
          stripUnknown: false,
          coerceTypes: true,
          validateParams: true,
          validateResponse: false,
          abortEarly: true,
          includeErrorPaths: true
        };
      case 'lenient':
        return {
          stripUnknown: false,
          coerceTypes: true,
          validateParams: true,
          validateResponse: false,
          abortEarly: true,
          includeErrorPaths: false
        };
    }
  }

  /**
   * Get cache middleware configuration for different caching strategies
   */
  static getCacheConfig(strategy: 'aggressive' | 'balanced' | 'conservative'): CacheMiddlewareOptions {
    switch (strategy) {
      case 'aggressive':
        return {
          defaultTTL: 30 * 60 * 1000, // 30 minutes
          cacheErrors: true,
          maxEntrySize: 10 * 1024 * 1024, // 10MB
          compress: true
        };
      case 'balanced':
        return {
          defaultTTL: 5 * 60 * 1000, // 5 minutes
          cacheErrors: false,
          maxEntrySize: 1 * 1024 * 1024, // 1MB
          compress: false
        };
      case 'conservative':
        return {
          defaultTTL: 1 * 60 * 1000, // 1 minute
          cacheErrors: false,
          maxEntrySize: 100 * 1024, // 100KB
          compress: false
        };
    }
  }

  /**
   * Get authentication middleware configuration for different security levels
   */
  static getAuthConfig(level: 'basic' | 'standard' | 'strict'): AuthenticationMiddlewareOptions {
    switch (level) {
      case 'basic':
        return {
          required: false,
          sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
          logAttempts: false
        };
      case 'standard':
        return {
          required: true,
          sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
          logAttempts: true,
          rateLimiting: {
            enabled: true,
            maxAttempts: 10,
            windowMs: 15 * 60 * 1000 // 15 minutes
          }
        };
      case 'strict':
        return {
          required: true,
          sessionTimeout: 1 * 60 * 60 * 1000, // 1 hour
          logAttempts: true,
          rateLimiting: {
            enabled: true,
            maxAttempts: 5,
            windowMs: 15 * 60 * 1000 // 15 minutes
          }
        };
    }
  }

  /**
   * Get performance middleware configuration for different monitoring levels
   */
  static getPerformanceConfig(level: 'minimal' | 'standard' | 'detailed'): PerformanceMiddlewareOptions {
    switch (level) {
      case 'minimal':
        return {
          collectMemoryMetrics: false,
          collectCpuMetrics: false,
          logMetrics: false,
          samplingRate: 0.1, // 10% sampling
          maxMetricsHistory: 1000
        };
      case 'standard':
        return {
          collectMemoryMetrics: true,
          collectCpuMetrics: false,
          logMetrics: false,
          samplingRate: 0.5, // 50% sampling
          maxMetricsHistory: 5000
        };
      case 'detailed':
        return {
          collectMemoryMetrics: true,
          collectCpuMetrics: true,
          logMetrics: true,
          samplingRate: 1.0, // 100% sampling
          maxMetricsHistory: 10000
        };
    }
  }

  /**
   * Get error handling middleware configuration for different environments
   */
  static getErrorHandlingConfig(env: 'development' | 'staging' | 'production'): ErrorHandlingMiddlewareOptions {
    switch (env) {
      case 'development':
        return {
          includeStackTrace: true,
          logErrors: true,
          sanitizeSensitiveData: false,
          enableCircuitBreaker: false,
          enableRetries: false
        };
      case 'staging':
        return {
          includeStackTrace: false,
          logErrors: true,
          sanitizeSensitiveData: true,
          enableCircuitBreaker: true,
          enableRetries: true
        };
      case 'production':
        return {
          includeStackTrace: false,
          logErrors: true,
          sanitizeSensitiveData: true,
          enableCircuitBreaker: true,
          enableRetries: true,
          errorLogRateLimit: {
            maxErrors: 10,
            timeWindow: 60000 // 1 minute
          }
        };
    }
  }
}