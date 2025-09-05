/**
 * Error Manager
 * 
 * This module provides centralized error handling management for the MCP server,
 * including error handler registration, classification, and recovery strategies.
 */

import { Injectable, Inject } from '@sker/di';
import { LOGGER } from '../tokens.js';
import type {
  ErrorContext,
  ErrorHandlerFunction,
  ErrorHandlerConstructor,
  ErrorHandlerEntry,
  ErrorHandlingConfig,
  ErrorRecoveryStrategy
} from './types.js';
import {
  McpError,
  ValidationError,
  AuthenticationError
} from './types.js';

/**
 * Logger interface for error handling
 */
interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}


/**
 * Error manager for centralized error handling
 */
@Injectable()
export class ErrorManager {
  private readonly errorHandlers = new Map<string, ErrorHandlerEntry>();
  private readonly recoveryStrategies: ErrorRecoveryStrategy[] = [];
  private config: ErrorHandlingConfig = {};

  constructor(
    @Inject(LOGGER) private readonly logger: ILogger
  ) {
    this.setupDefaultHandlers();
  }

  /**
   * Register an error handler
   */
  registerHandler(
    id: string,
    handler: ErrorHandlerFunction | ErrorHandlerConstructor,
    options: Partial<ErrorHandlerEntry> = {}
  ): void {
    const entry: ErrorHandlerEntry = {
      id,
      handler,
      priority: options.priority || 1000,
      metadata: options.metadata
    };

    this.errorHandlers.set(id, entry);
    this.logger.debug(`Registered error handler: ${id}`, entry);
  }

  /**
   * Unregister an error handler
   */
  unregisterHandler(id: string): boolean {
    const removed = this.errorHandlers.delete(id);
    if (removed) {
      this.logger.debug(`Unregistered error handler: ${id}`);
    }
    return removed;
  }

  /**
   * Handle an error using registered handlers
   */
  async handleError(error: Error, context: ErrorContext): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Log the error if configured to do so
      if (this.config.logErrors !== false) {
        this.logger.error('Error occurred:', {
          error: error.message,
          stack: error.stack,
          context: {
            requestType: context.requestType,
            methodName: context.methodName,
            requestId: context.requestId
          }
        });
      }

      // Find appropriate error handlers
      const handlers = this.getApplicableHandlers(error, context);
      
      if (handlers.length === 0) {
        // Use default handler if available
        if (this.config.defaultHandler) {
          return await this.executeHandler(this.config.defaultHandler, error, context);
        }
        
        // Fallback to built-in error handling
        return this.buildDefaultErrorResponse(error, context);
      }

      // Execute the first applicable handler
      const handlerEntry = handlers[0];
      if (!handlerEntry || !handlerEntry.handler) {
        throw new Error(`Handler or entry is undefined`);
      }
      
      const result = await this.executeHandler(handlerEntry.handler, error, context);
      
      const executionTime = Date.now() - startTime;
      this.logger.debug(`Error handled by ${handlerEntry.id} in ${executionTime}ms`);
      
      return result;
      
    } catch (handlerError) {
      this.logger.error('Error handler failed:', handlerError);
      
      // Fallback to basic error response
      return this.buildDefaultErrorResponse(error, context);
    }
  }

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(error: Error, context: ErrorContext): Promise<any> {
    for (const strategy of this.recoveryStrategies) {
      if (strategy.canRecover(error, context)) {
        try {
          this.logger.debug(`Attempting recovery with strategy: ${strategy.name}`);
          const result = await strategy.recover(error, context);
          this.logger.info(`Recovery successful with strategy: ${strategy.name}`);
          return result;
        } catch (recoveryError) {
          this.logger.warn(`Recovery failed with strategy ${strategy.name}:`, recoveryError);
        }
      }
    }
    
    throw error; // No recovery possible
  }

  /**
   * Register a recovery strategy
   */
  registerRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    this.logger.debug(`Registered recovery strategy: ${strategy.name}`);
  }

  /**
   * Configure error handling
   */
  configure(config: Partial<ErrorHandlingConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Register global handlers if provided
    if (config.globalHandlers) {
      for (let i = 0; i < config.globalHandlers.length; i++) {
        const handler = config.globalHandlers[i];
        if (handler) {
          const id = `global_error_handler_${i}`;
          this.registerHandler(id, handler, { priority: i });
        }
      }
    }
  }

  /**
   * Get error statistics
   */
  getStats(): {
    totalHandlers: number;
    recoveryStrategies: number;
    categories: Record<string, number>;
  } {
    // In a real implementation, you'd track error counts by category
    return {
      totalHandlers: this.errorHandlers.size,
      recoveryStrategies: this.recoveryStrategies.length,
      categories: {} as Record<string, number>
    };
  }

  /**
   * Find applicable error handlers for an error and context
   */
  private getApplicableHandlers(error: Error, context: ErrorContext): ErrorHandlerEntry[] {
    const handlers: ErrorHandlerEntry[] = [];
    
    for (const entry of this.errorHandlers.values()) {
      if (this.isHandlerApplicable(entry, error, context)) {
        handlers.push(entry);
      }
    }
    
    // Sort by priority (lower numbers first)
    return handlers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Check if a handler is applicable for the error and context
   */
  private isHandlerApplicable(
    entry: ErrorHandlerEntry, 
    error: Error, 
    context: ErrorContext
  ): boolean {
    // For function handlers, always applicable
    if (typeof entry.handler === 'function' && !entry.handler.prototype?.handle) {
      return true;
    }
    
    // For class handlers, check if they have a canHandle method
    try {
      if (typeof entry.handler === 'function' && entry.handler.prototype?.canHandle) {
        const instance = new (entry.handler as ErrorHandlerConstructor)();
        return instance.canHandle ? instance.canHandle(error, context) : true;
      }
    } catch (err) {
      this.logger.warn(`Failed to check handler applicability for ${entry.id}:`, err);
    }
    
    return true;
  }

  /**
   * Execute an error handler
   */
  private async executeHandler(
    handler: ErrorHandlerFunction | ErrorHandlerConstructor,
    error: Error,
    context: ErrorContext
  ): Promise<any> {
    if (typeof handler === 'function') {
      // Check if it's a constructor or a function
      if (handler.prototype && handler.prototype.handle) {
        // It's a class constructor
        const instance = new (handler as ErrorHandlerConstructor)();
        return await instance.handle(error, context);
      } else {
        // It's a function
        return await (handler as ErrorHandlerFunction)(error, context);
      }
    }
    
    throw new Error('Invalid error handler type');
  }

  /**
   * Build a default error response
   */
  private buildDefaultErrorResponse(error: Error, context: ErrorContext): any {
    const response: any = {
      error: true,
      message: error.message || 'An error occurred',
      requestId: context.requestId,
      timestamp: context.errorTime
    };

    // Add error details if configured to expose them
    if (this.config.exposeDetails) {
      if (error instanceof McpError) {
        response.code = error.code;
        response.statusCode = error.statusCode;
        response.details = error.details;
      }
      
      response.stack = error.stack;
      response.context = {
        requestType: context.requestType,
        methodName: context.methodName
      };
    }

    return response;
  }

  /**
   * Setup default error handlers
   */
  private setupDefaultHandlers(): void {
    // Default validation error handler
    this.registerHandler('default_validation', (error: Error, context: ErrorContext) => {
      if (error instanceof ValidationError) {
        return {
          error: true,
          message: 'Validation failed',
          details: error.details,
          code: 'VALIDATION_ERROR',
          requestId: context.requestId
        };
      }
      throw error; // Not handled by this handler
    }, { priority: 100 });

    // Default authentication error handler
    this.registerHandler('default_auth', (error: Error, context: ErrorContext) => {
      if (error instanceof AuthenticationError) {
        return {
          error: true,
          message: 'Authentication failed',
          code: 'AUTH_ERROR',
          requestId: context.requestId
        };
      }
      throw error; // Not handled by this handler
    }, { priority: 100 });
  }
}