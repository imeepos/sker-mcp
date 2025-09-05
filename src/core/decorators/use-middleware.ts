/**
 * UseMiddleware Decorator
 * 
 * This decorator allows methods to specify middleware that should be executed
 * before the method call. It supports both function-based and class-based
 * middleware with automatic resolution and integration with the middleware executor.
 */

import 'reflect-metadata';
import type {
  MiddlewareFunction,
  MiddlewareConstructor
} from '../middleware/types.js';

/**
 * Metadata key for storing middleware information
 */
const MIDDLEWARE_KEY = 'mcp:middleware';

/**
 * Middleware entry for storage in metadata
 */
export interface MiddlewareEntry {
  /**
   * Middleware identifier for registration
   */
  id: string;
  
  /**
   * The middleware function or constructor
   */
  middleware: MiddlewareFunction | MiddlewareConstructor;
  
  /**
   * Execution priority (lower numbers execute first)
   */
  priority?: number;
  
  /**
   * Additional metadata for the middleware
   */
  metadata?: Record<string, any> | undefined;
}

/**
 * Options for middleware configuration
 */
export interface UseMiddlewareOptions {
  /**
   * Execution priority (lower numbers execute first)
   */
  priority?: number;
  
  /**
   * Custom identifier for the middleware (auto-generated if not provided)
   */
  id?: string;
  
  /**
   * Additional metadata to pass to the middleware
   */
  metadata?: Record<string, any> | undefined;
}

/**
 * @UseMiddleware decorator for specifying method middleware
 * 
 * This decorator can be applied to methods decorated with @McpTool, @McpResource,
 * or @McpPrompt to specify middleware that should execute before the method.
 * Middleware is executed in the order specified (or by priority if configured).
 * 
 * @param middleware - Middleware functions or constructors to apply
 * @param options - Optional configuration for middleware execution
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * class MyService {
 *   @McpTool({
 *     name: 'secure-operation',
 *     description: 'A secure operation with middleware'
 *   })
 *   @UseMiddleware(AuthenticationMiddleware, LoggingMiddleware)
 *   async secureOperation(request: CallToolRequest) {
 *     return { message: 'Operation completed securely' };
 *   }
 *   
 *   @McpTool({
 *     name: 'custom-middleware-operation',
 *     description: 'Operation with custom middleware configuration'
 *   })
 *   @UseMiddleware(
 *     ValidationMiddleware,
 *     { priority: 1, metadata: { strict: true } }
 *   )
 *   async customOperation(request: CallToolRequest) {
 *     return { message: 'Custom operation completed' };
 *   }
 * }
 * ```
 */
export function UseMiddleware(
  ...middlewareOrOptions: Array<
    MiddlewareFunction | MiddlewareConstructor | UseMiddlewareOptions
  >
): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Parse arguments to separate middleware from options
    const middleware: Array<MiddlewareFunction | MiddlewareConstructor> = [];
    let options: UseMiddlewareOptions = {};
    
    for (const arg of middlewareOrOptions) {
      if (typeof arg === 'function') {
        middleware.push(arg);
      } else if (typeof arg === 'object' && arg !== null) {
        // It's options
        options = { ...options, ...arg };
      }
    }
    
    // Get existing middleware for this method
    const existingMiddleware: MiddlewareEntry[] = 
      Reflect.getMetadata(MIDDLEWARE_KEY, target, propertyKey) || [];
    
    // Convert middleware to entries
    const newEntries = middleware.map((mw, index) => {
      const entry: MiddlewareEntry = {
        id: options.id || generateMiddlewareId(mw, index),
        middleware: mw,
        priority: options.priority !== undefined ? options.priority + index : 1000 + existingMiddleware.length + index,
        metadata: options.metadata
      };
      
      return entry;
    });
    
    // Store combined middleware list
    const allMiddleware = [...existingMiddleware, ...newEntries];
    Reflect.defineMetadata(MIDDLEWARE_KEY, allMiddleware, target, propertyKey);
    
    // Return the original descriptor
    return descriptor;
  };
}

/**
 * Multiple @UseMiddleware calls decorator variant
 * 
 * This function allows applying multiple @UseMiddleware decorators with
 * different configurations in a single call.
 * 
 * @example
 * ```typescript
 * @McpTool({ name: 'complex-operation' })
 * @UseMiddlewares([
 *   { middleware: AuthMiddleware, priority: 1 },
 *   { middleware: LoggingMiddleware, priority: 2 },
 *   { middleware: ValidationMiddleware, priority: 3 }
 * ])
 * async complexOperation() { }
 * ```
 */
export function UseMiddlewares(
  entries: Array<{
    middleware: MiddlewareFunction | MiddlewareConstructor;
    options?: UseMiddlewareOptions;
  }>
): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const middlewareEntries: MiddlewareEntry[] = entries.map((entry, index) => ({
      id: entry.options?.id || generateMiddlewareId(entry.middleware, index),
      middleware: entry.middleware,
      priority: entry.options?.priority || (1000 + index),
      metadata: entry.options?.metadata
    }));
    
    // Get existing middleware and merge
    const existingMiddleware: MiddlewareEntry[] = 
      Reflect.getMetadata(MIDDLEWARE_KEY, target, propertyKey) || [];
    
    const allMiddleware = [...existingMiddleware, ...middlewareEntries];
    Reflect.defineMetadata(MIDDLEWARE_KEY, allMiddleware, target, propertyKey);
    
    return descriptor;
  };
}

/**
 * Get middleware entries for a method
 * 
 * @param target - The target class instance or constructor
 * @param propertyKey - The method name
 * @returns Array of middleware entries
 */
export function getMethodMiddleware(
  target: any, 
  propertyKey: string | symbol
): MiddlewareEntry[] {
  return Reflect.getMetadata(MIDDLEWARE_KEY, target, propertyKey) || [];
}

/**
 * Check if a method has middleware configured
 * 
 * @param target - The target class instance or constructor
 * @param propertyKey - The method name
 * @returns True if middleware is configured
 */
export function hasMethodMiddleware(
  target: any, 
  propertyKey: string | symbol
): boolean {
  const middleware = getMethodMiddleware(target, propertyKey);
  return middleware.length > 0;
}

/**
 * Generate a unique middleware ID based on the middleware function/class
 */
function generateMiddlewareId(
  middleware: MiddlewareFunction | MiddlewareConstructor, 
  index: number
): string {
  let baseName: string;
  
  if (middleware.name) {
    baseName = middleware.name;
  } else if (middleware.constructor && middleware.constructor.name) {
    baseName = middleware.constructor.name;
  } else {
    baseName = 'anonymous';
  }
  
  return `${baseName}_${index}_${Date.now()}`;
}

/**
 * Built-in middleware factory functions for common operations
 */
export class BuiltinMiddlewares {
  /**
   * Simple logging middleware
   */
  static createLoggingMiddleware(options: { prefix?: string } = {}): MiddlewareFunction {
    return async (context, next) => {
      const prefix = options.prefix || 'MCP';
      console.log(`[${prefix}] Starting ${context.requestType} ${context.methodName}`);
      
      try {
        const result = await next();
        console.log(`[${prefix}] Completed ${context.requestType} ${context.methodName}`);
        return result;
      } catch (error) {
        console.error(`[${prefix}] Failed ${context.requestType} ${context.methodName}:`, error);
        throw error;
      }
    };
  }
  
  /**
   * Timing middleware for performance measurement
   */
  static createTimingMiddleware(): MiddlewareFunction {
    return async (context, next) => {
      const startTime = Date.now();
      try {
        const result = await next();
        const duration = Date.now() - startTime;
        console.log(`[TIMING] ${context.methodName} executed in ${duration}ms`);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.log(`[TIMING] ${context.methodName} failed after ${duration}ms`);
        throw error;
      }
    };
  }
  
  /**
   * Simple validation middleware
   */
  static createValidationMiddleware(): MiddlewareFunction {
    return async (context, next) => {
      // Basic request validation
      if (!context.request || !context.request.params) {
        throw new Error('Invalid request: missing parameters');
      }
      
      return await next();
    };
  }
}