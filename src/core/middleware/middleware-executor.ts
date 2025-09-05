/**
 * Middleware Executor
 * 
 * This module provides the core middleware execution engine that implements
 * the onion model pattern for chaining middleware execution.
 */

import { Injectable, Inject } from '@sker/di';
import { LOGGER } from '../tokens.js';
import type {
  MiddlewareContext,
  NextFunction,
  MiddlewareFunction,
  MiddlewareConstructor,
  MiddlewareResult,
  MiddlewareOptions,
  MiddlewareRegistryEntry
} from './types.js';

/**
 * Logger interface for middleware execution
 */
interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Middleware executor implementing the onion model
 */
@Injectable()
export class MiddlewareExecutor {
  private readonly middlewareRegistry = new Map<string, MiddlewareRegistryEntry>();
  private readonly options: MiddlewareOptions = {};

  constructor(
    @Inject(LOGGER) private readonly logger: ILogger
  ) {}

  /**
   * Register a middleware with the executor
   */
  register(
    id: string,
    middleware: MiddlewareFunction | MiddlewareConstructor,
    options: Partial<MiddlewareRegistryEntry> = {}
  ): void {
    const entry: MiddlewareRegistryEntry = {
      id,
      middleware,
      priority: options.priority || 1000,
      global: options.global || false,
      metadata: options.metadata || {}
    };

    this.middlewareRegistry.set(id, entry);
    this.logger.debug(`Registered middleware: ${id}`, entry);
  }

  /**
   * Unregister a middleware
   */
  unregister(id: string): boolean {
    const removed = this.middlewareRegistry.delete(id);
    if (removed) {
      this.logger.debug(`Unregistered middleware: ${id}`);
    }
    return removed;
  }

  /**
   * Get all registered middleware IDs
   */
  getRegisteredIds(): string[] {
    return Array.from(this.middlewareRegistry.keys());
  }

  /**
   * Execute middleware chain for a context
   */
  async execute(
    context: MiddlewareContext,
    targetMiddleware: string[],
    handler: () => Promise<any>
  ): Promise<MiddlewareResult> {
    const startTime = Date.now();
    const middlewareTrace: Array<{ name: string; executionTime: number; order: number }> = [];
    
    // Collect all middleware to execute (global + target-specific)
    const allMiddleware = this.collectMiddleware(targetMiddleware);
    
    // Create the middleware chain using the onion model
    const executeChain = this.createMiddlewareChain(
      allMiddleware,
      handler,
      context,
      middlewareTrace
    );

    try {
      const result = await executeChain();
      const executionTime = Date.now() - startTime;

      const resultWithTrace: MiddlewareResult = {
        result,
        executionTime,
        modified: middlewareTrace.length > 0
      };
      
      if (this.options.enableTrace) {
        resultWithTrace.middlewareTrace = middlewareTrace;
      }
      
      return resultWithTrace;
    } catch (error) {
      this.logger.error('Middleware chain execution failed:', error);
      
      throw error;
    }
  }

  /**
   * Collect middleware entries sorted by priority
   */
  private collectMiddleware(targetIds: string[]): MiddlewareRegistryEntry[] {
    const middleware: MiddlewareRegistryEntry[] = [];
    
    // Add global middleware
    for (const entry of this.middlewareRegistry.values()) {
      if (entry.global) {
        middleware.push(entry);
      }
    }
    
    // Add target-specific middleware
    for (const id of targetIds) {
      const entry = this.middlewareRegistry.get(id);
      if (entry) {
        if (!entry.global) {
          middleware.push(entry);
        }
      } else {
        this.logger.warn(`Middleware not found: ${id}`);
      }
    }
    
    // Sort by priority (lower numbers first)
    return middleware.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Create the onion model middleware chain
   */
  private createMiddlewareChain(
    middleware: MiddlewareRegistryEntry[],
    handler: () => Promise<any>,
    context: MiddlewareContext,
    trace: Array<{ name: string; executionTime: number; order: number }>
  ): NextFunction {
    let index = 0;

    const dispatch = async (): Promise<any> => {
      if (index >= middleware.length) {
        // Reached the end of the chain, execute the actual handler
        return await handler();
      }

      const entry = middleware[index++];
      if (!entry) {
        throw new Error('Middleware entry is undefined');
      }
      
      const middlewareStartTime = Date.now();
      
      try {
        const middlewareInstance = await this.resolveMiddleware(entry);
        const result = await middlewareInstance(context, dispatch);
        
        // Record trace information
        if (this.options.enableTrace) {
          trace.push({
            name: entry.id,
            executionTime: Date.now() - middlewareStartTime,
            order: index - 1
          });
        }
        
        return result;
      } catch (error) {
        this.logger.error(`Middleware ${entry.id} failed:`, error);
        
        // Record failed middleware in trace
        if (this.options.enableTrace) {
          trace.push({
            name: `${entry.id} (failed)`,
            executionTime: Date.now() - middlewareStartTime,
            order: index - 1
          });
        }
        
        if (!this.options.continueOnError) {
          throw error;
        }
        
        // Continue to next middleware if configured to continue on error
        return await dispatch();
      }
    };

    return dispatch;
  }

  /**
   * Resolve middleware instance from constructor or function
   */
  private async resolveMiddleware(
    entry: MiddlewareRegistryEntry
  ): Promise<MiddlewareFunction> {
    const middleware = entry.middleware;
    if (!middleware) {
      throw new Error(`Middleware is undefined for ${entry.id}`);
    }
    
    if (typeof middleware === 'function') {
      // Check if it's a constructor (class) or a function
      if (middleware.prototype && middleware.prototype.execute) {
        // It's a class constructor
        const MiddlewareClass = middleware as MiddlewareConstructor;
        const instance = new MiddlewareClass();
        return (context: MiddlewareContext, next: NextFunction) => 
          instance.execute(context, next);
      } else {
        // It's already a middleware function
        return middleware as MiddlewareFunction;
      }
    }
    
    throw new Error(`Invalid middleware type for ${entry.id}`);
  }

  /**
   * Configure middleware executor options
   */
  configure(options: Partial<MiddlewareOptions>): void {
    Object.assign(this.options, options);
    
    // Register global middleware if provided
    if (options.global) {
      for (let i = 0; i < options.global.length; i++) {
        const middleware = options.global[i];
        if (middleware) {
          const id = `global_${i}`;
          this.register(id, middleware, { global: true, priority: i });
        }
      }
    }
  }

  /**
   * Clear all registered middleware
   */
  clear(): void {
    this.middlewareRegistry.clear();
    this.logger.debug('Cleared all middleware registrations');
  }

  /**
   * Get middleware statistics
   */
  getStats(): {
    totalMiddleware: number;
    globalMiddleware: number;
    specificMiddleware: number;
  } {
    const entries = Array.from(this.middlewareRegistry.values());
    return {
      totalMiddleware: entries.length,
      globalMiddleware: entries.filter(e => e.global).length,
      specificMiddleware: entries.filter(e => !e.global).length
    };
  }
}