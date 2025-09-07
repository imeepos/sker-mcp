/**
 * Error Recovery Strategies Implementation
 * 
 * This module provides enterprise-grade error recovery strategies including
 * retry mechanisms, circuit breakers, graceful degradation, and fallback patterns
 * as specified in the design documentation.
 */

import { Injectable, Inject } from '@sker/di';
import { LOGGER } from '../tokens';
import type { IWinstonLogger } from '../logging/winston-logger';

/**
 * Recovery strategy types
 */
export enum RecoveryStrategy {
  RETRY = 'retry',
  CIRCUIT_BREAKER = 'circuit_breaker',
  GRACEFUL_DEGRADATION = 'graceful_degradation',
  FALLBACK = 'fallback',
  FAIL_FAST = 'fail_fast'
}

/**
 * Recovery attempt result
 */
export interface RecoveryResult {
  success: boolean;
  result?: any;
  error?: Error;
  attemptsUsed: number;
  recoveryStrategy: RecoveryStrategy;
  duration: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors: string[];
  timeoutMs?: number;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringWindow: number;
  minimumRequests: number;
  successThreshold: number;
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open', 
  HALF_OPEN = 'half_open'
}

/**
 * Error recovery context
 */
export interface ErrorRecoveryContext {
  operationName: string;
  operationId: string;
  attemptNumber: number;
  previousError?: Error;
  startTime: number;
  metadata?: Record<string, any>;
}

/**
 * Retry Strategy Implementation
 * 
 * Implements intelligent retry logic with exponential backoff,
 * jitter, and retryable error classification.
 */
@Injectable()
export class RetryStrategy {
  private readonly activeRetries = new Map<string, number>();

  constructor(@Inject(LOGGER) private readonly logger: IWinstonLogger) {}

  /**
   * Execute operation with retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    context: ErrorRecoveryContext
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        this.logger.debug('Retry attempt started', {
          operationName: context.operationName,
          attempt,
          maxAttempts: config.maxAttempts
        });

        // Set timeout if configured
        const result = config.timeoutMs
          ? await this.withTimeout(operation(), config.timeoutMs)
          : await operation();

        // Success - clear retry tracking
        this.activeRetries.delete(context.operationId);

        this.logger.info('Retry operation succeeded', {
          operationName: context.operationName,
          attempt,
          duration: Date.now() - startTime
        });

        return {
          success: true,
          result,
          attemptsUsed: attempt,
          recoveryStrategy: RecoveryStrategy.RETRY,
          duration: Date.now() - startTime
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        this.logger.warn('Retry attempt failed', {
          operationName: context.operationName,
          attempt,
          error: lastError.message,
          retryable: this.isRetryableError(lastError, config)
        });

        // Check if error is retryable
        if (!this.isRetryableError(lastError, config)) {
          this.logger.error('Non-retryable error encountered', {
            operationName: context.operationName,
            error: lastError.message
          });
          break;
        }

        // Calculate delay before next attempt
        if (attempt < config.maxAttempts) {
          const delay = this.calculateDelay(attempt, config);
          this.logger.debug('Waiting before next retry attempt', {
            operationName: context.operationName,
            delay,
            nextAttempt: attempt + 1
          });
          
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    this.activeRetries.delete(context.operationId);

    return {
      success: false,
      error: lastError,
      attemptsUsed: config.maxAttempts,
      recoveryStrategy: RecoveryStrategy.RETRY,
      duration: Date.now() - startTime
    };
  }

  /**
   * Check if error is retryable based on configuration
   */
  private isRetryableError(error: Error, config: RetryConfig): boolean {
    if (config.retryableErrors.length === 0) {
      return true; // Retry all errors if no specific list provided
    }

    return config.retryableErrors.some(errorType => 
      error.message.includes(errorType) ||
      error.name.includes(errorType) ||
      error.constructor.name.includes(errorType)
    );
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * 0.1 * Math.random();
    
    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Execute operation with timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit Breaker Implementation
 * 
 * Implements the circuit breaker pattern to prevent cascading failures
 * and provide fast failure when downstream services are unavailable.
 */
@Injectable()
export class CircuitBreaker {
  private state = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly requestHistory: Array<{ success: boolean; timestamp: number }> = [];

  constructor(
    private readonly config: CircuitBreakerConfig,
    @Inject(LOGGER) private readonly logger: IWinstonLogger
  ) {}

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: ErrorRecoveryContext
  ): Promise<RecoveryResult> {
    const startTime = Date.now();

    // Check circuit breaker state
    if (!this.canExecute()) {
      const error = new Error(`Circuit breaker is ${this.state} - operation not allowed`);
      
      this.logger.warn('Circuit breaker rejected operation', {
        operationName: context.operationName,
        state: this.state,
        failureCount: this.failureCount
      });

      return {
        success: false,
        error,
        attemptsUsed: 0,
        recoveryStrategy: RecoveryStrategy.CIRCUIT_BREAKER,
        duration: Date.now() - startTime
      };
    }

    try {
      const result = await operation();
      
      this.recordSuccess();
      
      this.logger.debug('Circuit breaker operation succeeded', {
        operationName: context.operationName,
        state: this.state
      });

      return {
        success: true,
        result,
        attemptsUsed: 1,
        recoveryStrategy: RecoveryStrategy.CIRCUIT_BREAKER,
        duration: Date.now() - startTime
      };

    } catch (error) {
      this.recordFailure();
      
      const wrappedError = error instanceof Error ? error : new Error(String(error));
      
      this.logger.error('Circuit breaker operation failed', {
        operationName: context.operationName,
        state: this.state,
        failureCount: this.failureCount,
        error: wrappedError.message
      });

      return {
        success: false,
        error: wrappedError,
        attemptsUsed: 1,
        recoveryStrategy: RecoveryStrategy.CIRCUIT_BREAKER,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Check if operation can be executed based on circuit breaker state
   */
  private canExecute(): boolean {
    this.updateState();
    
    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        return true;
      
      case CircuitBreakerState.OPEN:
        return false;
      
      case CircuitBreakerState.HALF_OPEN:
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Update circuit breaker state based on current conditions
   */
  private updateState(): void {
    const now = Date.now();
    
    // Clean old requests from history
    this.cleanRequestHistory(now);
    
    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        if (this.shouldOpenCircuit()) {
          this.state = CircuitBreakerState.OPEN;
          this.lastFailureTime = now;
          
          this.logger.warn('Circuit breaker opened', {
            failureCount: this.failureCount,
            threshold: this.config.failureThreshold
          });
        }
        break;
      
      case CircuitBreakerState.OPEN:
        if (now - this.lastFailureTime >= this.config.recoveryTimeout) {
          this.state = CircuitBreakerState.HALF_OPEN;
          this.successCount = 0;
          
          this.logger.info('Circuit breaker moved to half-open', {
            recoveryTimeout: this.config.recoveryTimeout
          });
        }
        break;
      
      case CircuitBreakerState.HALF_OPEN:
        if (this.successCount >= this.config.successThreshold) {
          this.state = CircuitBreakerState.CLOSED;
          this.failureCount = 0;
          
          this.logger.info('Circuit breaker closed', {
            successCount: this.successCount,
            threshold: this.config.successThreshold
          });
        } else if (this.failureCount > 0) {
          this.state = CircuitBreakerState.OPEN;
          this.lastFailureTime = now;
          
          this.logger.warn('Circuit breaker reopened after failure in half-open state');
        }
        break;
    }
  }

  /**
   * Record successful operation
   */
  private recordSuccess(): void {
    const now = Date.now();
    this.requestHistory.push({ success: true, timestamp: now });
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
    } else {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(): void {
    const now = Date.now();
    this.requestHistory.push({ success: false, timestamp: now });
    this.failureCount++;
    this.successCount = 0;
  }

  /**
   * Check if circuit should be opened
   */
  private shouldOpenCircuit(): boolean {
    if (this.requestHistory.length < this.config.minimumRequests) {
      return false;
    }

    const recentFailures = this.requestHistory.filter(req => !req.success).length;
    const failureRate = recentFailures / this.requestHistory.length;
    
    return failureRate >= (this.config.failureThreshold / 100);
  }

  /**
   * Clean old requests from history
   */
  private cleanRequestHistory(now: number): void {
    const cutoff = now - this.config.monitoringWindow;
    let index = 0;
    
    while (index < this.requestHistory.length && this.requestHistory[index].timestamp < cutoff) {
      index++;
    }
    
    if (index > 0) {
      this.requestHistory.splice(0, index);
    }
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestHistorySize: this.requestHistory.length,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Error Recovery Manager
 * 
 * Orchestrates different recovery strategies and provides a unified
 * interface for error recovery operations.
 */
@Injectable()
export class ErrorRecoveryManager {
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();
  private readonly operationCounters = new Map<string, number>();

  constructor(
    @Inject(LOGGER) private readonly logger: IWinstonLogger,
    private readonly retryStrategy: RetryStrategy
  ) {}

  /**
   * Execute operation with comprehensive error recovery
   */
  async executeWithRecovery<T>(
    operationName: string,
    operation: () => Promise<T>,
    options: {
      retry?: RetryConfig;
      circuitBreaker?: CircuitBreakerConfig;
      gracefulDegradation?: { fallbackValue: T };
      strategy?: RecoveryStrategy;
    } = {}
  ): Promise<RecoveryResult> {
    const operationId = this.generateOperationId(operationName);
    const context: ErrorRecoveryContext = {
      operationName,
      operationId,
      attemptNumber: 1,
      startTime: Date.now()
    };

    // Determine recovery strategy
    const strategy = options.strategy || this.determineStrategy(options);

    this.logger.debug('Starting operation with recovery strategy', {
      operationName,
      operationId,
      strategy
    });

    try {
      switch (strategy) {
        case RecoveryStrategy.RETRY:
          if (options.retry) {
            return await this.retryStrategy.execute(operation, options.retry, context);
          }
          break;

        case RecoveryStrategy.CIRCUIT_BREAKER:
          if (options.circuitBreaker) {
            const circuitBreaker = this.getOrCreateCircuitBreaker(operationName, options.circuitBreaker);
            return await circuitBreaker.execute(operation, context);
          }
          break;

        case RecoveryStrategy.GRACEFUL_DEGRADATION:
          return await this.executeWithGracefulDegradation(operation, options.gracefulDegradation, context);

        case RecoveryStrategy.FAIL_FAST:
        default:
          return await this.executeWithFailFast(operation, context);
      }

      // Fallback to fail-fast if no strategy matched
      return await this.executeWithFailFast(operation, context);

    } catch (error) {
      this.logger.error('Error recovery operation failed', {
        operationName,
        operationId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        attemptsUsed: 1,
        recoveryStrategy: strategy,
        duration: Date.now() - context.startTime
      };
    }
  }

  /**
   * Execute with graceful degradation
   */
  private async executeWithGracefulDegradation<T>(
    operation: () => Promise<T>,
    fallback: { fallbackValue: T } | undefined,
    context: ErrorRecoveryContext
  ): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      const result = await operation();
      
      return {
        success: true,
        result,
        attemptsUsed: 1,
        recoveryStrategy: RecoveryStrategy.GRACEFUL_DEGRADATION,
        duration: Date.now() - startTime
      };

    } catch (error) {
      this.logger.warn('Operation failed, using graceful degradation', {
        operationName: context.operationName,
        error: error instanceof Error ? error.message : String(error),
        hasFallback: !!fallback
      });

      if (fallback) {
        return {
          success: true, // Graceful degradation is considered success
          result: fallback.fallbackValue,
          attemptsUsed: 1,
          recoveryStrategy: RecoveryStrategy.GRACEFUL_DEGRADATION,
          duration: Date.now() - startTime
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        attemptsUsed: 1,
        recoveryStrategy: RecoveryStrategy.GRACEFUL_DEGRADATION,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Execute with fail-fast strategy
   */
  private async executeWithFailFast<T>(
    operation: () => Promise<T>,
    context: ErrorRecoveryContext
  ): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      const result = await operation();
      
      return {
        success: true,
        result,
        attemptsUsed: 1,
        recoveryStrategy: RecoveryStrategy.FAIL_FAST,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        attemptsUsed: 1,
        recoveryStrategy: RecoveryStrategy.FAIL_FAST,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get or create circuit breaker for operation
   */
  private getOrCreateCircuitBreaker(operationName: string, config: CircuitBreakerConfig): CircuitBreaker {
    if (!this.circuitBreakers.has(operationName)) {
      const circuitBreaker = new CircuitBreaker(config, this.logger);
      this.circuitBreakers.set(operationName, circuitBreaker);
    }
    
    return this.circuitBreakers.get(operationName)!;
  }

  /**
   * Determine recovery strategy based on options
   */
  private determineStrategy(options: any): RecoveryStrategy {
    if (options.retry) return RecoveryStrategy.RETRY;
    if (options.circuitBreaker) return RecoveryStrategy.CIRCUIT_BREAKER;
    if (options.gracefulDegradation) return RecoveryStrategy.GRACEFUL_DEGRADATION;
    return RecoveryStrategy.FAIL_FAST;
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(operationName: string): string {
    const counter = (this.operationCounters.get(operationName) || 0) + 1;
    this.operationCounters.set(operationName, counter);
    return `${operationName}_${counter}_${Date.now()}`;
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    activeCircuitBreakers: number;
    operationCounts: Record<string, number>;
    circuitBreakerMetrics: Record<string, any>;
  } {
    const circuitBreakerMetrics: Record<string, any> = {};
    
    for (const [name, breaker] of this.circuitBreakers.entries()) {
      circuitBreakerMetrics[name] = breaker.getMetrics();
    }

    return {
      activeCircuitBreakers: this.circuitBreakers.size,
      operationCounts: Object.fromEntries(this.operationCounters.entries()),
      circuitBreakerMetrics
    };
  }
}

/**
 * Default recovery configurations
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'SERVICE_UNAVAILABLE', 'ECONNREFUSED', 'ENOTFOUND'],
  timeoutMs: 30000
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 50, // 50% failure rate
  recoveryTimeout: 60000, // 1 minute
  monitoringWindow: 120000, // 2 minutes
  minimumRequests: 10,
  successThreshold: 3
};