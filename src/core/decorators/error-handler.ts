/**
 * ErrorHandler Decorator
 * 
 * This decorator allows methods to specify custom error handling behavior.
 * It supports both function-based and class-based error handlers with
 * automatic integration into the error management system.
 */

import 'reflect-metadata';
import type {
  ErrorHandlerFunction,
  ErrorHandlerConstructor
} from '../errors/types.js';

/**
 * Metadata key for storing error handler information
 */
const ERROR_HANDLER_KEY = 'mcp:error-handler';

/**
 * Error handler entry for metadata storage
 */
export interface ErrorHandlerMetadata {
  /**
   * Error handler identifier
   */
  id: string;
  
  /**
   * The error handler function or constructor
   */
  handler: ErrorHandlerFunction | ErrorHandlerConstructor;
  
  /**
   * Priority for error handling (lower numbers handle first)
   */
  priority?: number;
  
  /**
   * Additional metadata for the error handler
   */
  metadata?: Record<string, any> | undefined;
  
  /**
   * Whether this handler should only handle specific error types
   */
  errorTypes?: Array<string | (new (...args: any[]) => Error)> | undefined;
}

/**
 * Options for error handler configuration
 */
export interface ErrorHandlerOptions {
  /**
   * Custom identifier for the error handler
   */
  id?: string;
  
  /**
   * Priority for error handling (lower numbers handle first)
   */
  priority?: number;
  
  /**
   * Additional metadata to pass to the error handler
   */
  metadata?: Record<string, any> | undefined;
  
  /**
   * Specific error types this handler should process
   */
  errorTypes?: Array<string | (new (...args: any[]) => Error)> | undefined;
}

/**
 * @ErrorHandler decorator for specifying method-level error handling
 * 
 * This decorator can be applied to methods decorated with @McpTool, @McpResource,
 * or @McpPrompt to specify custom error handling behavior. Multiple error handlers
 * can be applied to a single method.
 * 
 * @param handler - Error handler function or constructor
 * @param options - Optional configuration for the error handler
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * class MyService {
 *   @McpTool({
 *     name: 'risky-operation',
 *     description: 'An operation that might fail'
 *   })
 *   @ErrorHandler(ValidationErrorHandler)
 *   @ErrorHandler(NetworkErrorHandler, { priority: 1 })
 *   async riskyOperation(request: CallToolRequest) {
 *     // Method implementation that might throw errors
 *     return { result: 'success' };
 *   }
 *   
 *   @McpTool({
 *     name: 'custom-error-handling',
 *     description: 'Operation with inline error handling'
 *   })
 *   @ErrorHandler((error, context) => {
 *     return { error: true, message: 'Custom handled error' };
 *   })
 *   async customErrorHandling(request: CallToolRequest) {
 *     throw new Error('Something went wrong');
 *   }
 * }
 * ```
 */
export function ErrorHandler(
  handler: ErrorHandlerFunction | ErrorHandlerConstructor,
  options: ErrorHandlerOptions = {}
): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Get existing error handlers for this method
    const existingHandlers: ErrorHandlerMetadata[] = 
      Reflect.getMetadata(ERROR_HANDLER_KEY, target, propertyKey) || [];
    
    // Create new error handler entry
    const handlerMetadata: ErrorHandlerMetadata = {
      id: options.id || generateErrorHandlerId(handler),
      handler,
      priority: options.priority || (1000 + existingHandlers.length),
      metadata: options.metadata,
      errorTypes: options.errorTypes
    };
    
    // Store combined error handler list
    const allHandlers = [...existingHandlers, handlerMetadata];
    Reflect.defineMetadata(ERROR_HANDLER_KEY, allHandlers, target, propertyKey);
    
    // Return the original descriptor
    return descriptor;
  };
}

/**
 * Multiple @ErrorHandler calls decorator variant
 * 
 * This function allows applying multiple error handlers with different
 * configurations in a single decorator call.
 * 
 * @example
 * ```typescript
 * @McpTool({ name: 'complex-error-handling' })
 * @ErrorHandlers([
 *   { handler: ValidationErrorHandler, priority: 1 },
 *   { handler: NetworkErrorHandler, priority: 2 },
 *   { handler: GenericErrorHandler, priority: 999 }
 * ])
 * async complexOperation() { }
 * ```
 */
export function ErrorHandlers(
  entries: Array<{
    handler: ErrorHandlerFunction | ErrorHandlerConstructor;
    options?: ErrorHandlerOptions;
  }>
): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const handlerMetadata: ErrorHandlerMetadata[] = entries.map((entry, index) => ({
      id: entry.options?.id || generateErrorHandlerId(entry.handler, index),
      handler: entry.handler,
      priority: entry.options?.priority || (1000 + index),
      metadata: entry.options?.metadata,
      errorTypes: entry.options?.errorTypes
    }));
    
    // Get existing handlers and merge
    const existingHandlers: ErrorHandlerMetadata[] = 
      Reflect.getMetadata(ERROR_HANDLER_KEY, target, propertyKey) || [];
    
    const allHandlers = [...existingHandlers, ...handlerMetadata];
    Reflect.defineMetadata(ERROR_HANDLER_KEY, allHandlers, target, propertyKey);
    
    return descriptor;
  };
}

/**
 * Get error handler metadata for a method
 * 
 * @param target - The target class instance or constructor
 * @param propertyKey - The method name
 * @returns Array of error handler metadata
 */
export function getMethodErrorHandlers(
  target: any, 
  propertyKey: string | symbol
): ErrorHandlerMetadata[] {
  return Reflect.getMetadata(ERROR_HANDLER_KEY, target, propertyKey) || [];
}

/**
 * Check if a method has error handlers configured
 * 
 * @param target - The target class instance or constructor
 * @param propertyKey - The method name  
 * @returns True if error handlers are configured
 */
export function hasMethodErrorHandlers(
  target: any, 
  propertyKey: string | symbol
): boolean {
  const handlers = getMethodErrorHandlers(target, propertyKey);
  return handlers.length > 0;
}

/**
 * Generate a unique error handler ID
 */
function generateErrorHandlerId(
  handler: ErrorHandlerFunction | ErrorHandlerConstructor, 
  index: number = 0
): string {
  let baseName: string;
  
  if (handler.name) {
    baseName = handler.name;
  } else if (handler.constructor && handler.constructor.name) {
    baseName = handler.constructor.name;
  } else {
    baseName = 'anonymous';
  }
  
  return `${baseName}_errorHandler_${index}_${Date.now()}`;
}

/**
 * Built-in error handler factory functions
 */
export class BuiltinErrorHandlers {
  /**
   * Simple logging error handler
   */
  static createLoggingErrorHandler(options: { prefix?: string } = {}): ErrorHandlerFunction {
    return (error, context) => {
      const prefix = options.prefix || 'ERROR';
      console.error(`[${prefix}] Error in ${context.methodName}:`, {
        message: error.message,
        stack: error.stack,
        requestId: context.requestId
      });
      
      // Re-throw the error to continue normal error processing
      throw error;
    };
  }
  
  /**
   * Graceful degradation error handler
   */
  static createGracefulDegradationHandler(fallbackValue: any = null): ErrorHandlerFunction {
    return (error, context) => {
      console.warn(`[GRACEFUL] Graceful degradation for ${context.methodName}:`, error.message);
      
      return {
        result: fallbackValue,
        error: true,
        message: 'Operation completed with degraded functionality',
        originalError: error.message,
        requestId: context.requestId
      };
    };
  }
  
  /**
   * Retry error handler with exponential backoff
   */
  static createRetryHandler(
    maxRetries: number = 3, 
    baseDelay: number = 1000
  ): ErrorHandlerFunction {
    const retryMap = new Map<string, number>();
    
    return async (error, context) => {
      const retryKey = `${context.requestId}_${context.methodName}`;
      const currentRetries = retryMap.get(retryKey) || 0;
      
      if (currentRetries >= maxRetries) {
        retryMap.delete(retryKey);
        throw error; // Max retries reached
      }
      
      // Check if error is retryable
      const retryableErrors = ['NETWORK_ERROR', 'TIMEOUT', 'SERVICE_UNAVAILABLE'];
      const isRetryable = retryableErrors.some(code => 
        error.message.includes(code) || error.name.includes(code)
      );
      
      if (!isRetryable) {
        throw error; // Not retryable
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, currentRetries);
      retryMap.set(retryKey, currentRetries + 1);
      
      console.warn(`[RETRY] Retrying ${context.methodName} (attempt ${currentRetries + 1}/${maxRetries}) after ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // In a real implementation, you'd re-execute the original method
      // For now, we'll just indicate retry would happen
      throw error;
    };
  }
  
  /**
   * Sanitizing error handler that removes sensitive information
   */
  static createSanitizingHandler(sensitiveKeys: string[] = []): ErrorHandlerFunction {
    return (error, context) => {
      const sanitizedContext = { ...context };
      const sanitizedArgs = { ...context.args };
      
      // Remove sensitive keys from args
      for (const key of sensitiveKeys) {
        if (sanitizedArgs && typeof sanitizedArgs === 'object') {
          delete sanitizedArgs[key];
        }
      }
      
      sanitizedContext.args = sanitizedArgs;
      
      console.error('[SANITIZED] Error occurred:', {
        message: error.message,
        context: sanitizedContext,
        // Don't include stack trace for security
      });
      
      return {
        error: true,
        message: 'An error occurred',
        code: 'INTERNAL_ERROR',
        requestId: context.requestId,
        // Don't expose original error details
      };
    };
  }
}