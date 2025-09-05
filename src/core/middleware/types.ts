/**
 * Middleware System Types
 * 
 * This module defines the core interfaces and types for the middleware system,
 * supporting both class-based and function-based middleware with a unified
 * execution model.
 */

import type { CallToolRequest, ReadResourceRequest, GetPromptRequest } from '@modelcontextprotocol/sdk/types.js';

/**
 * Request context passed through the middleware chain
 */
export interface MiddlewareContext {
  /**
   * The original MCP request (tool, resource, or prompt)
   */
  request: CallToolRequest | ReadResourceRequest | GetPromptRequest;
  
  /**
   * Type of the request
   */
  requestType: 'tool' | 'resource' | 'prompt';
  
  /**
   * Target service instance
   */
  target: any;
  
  /**
   * Method name being called
   */
  methodName: string;
  
  /**
   * Parsed and validated arguments
   */
  args?: any;
  
  /**
   * Additional metadata for the middleware
   */
  metadata?: Record<string, any>;
  
  /**
   * Timestamp when the request started
   */
  startTime: number;
  
  /**
   * Request ID for tracing
   */
  requestId: string;
}

/**
 * Next function in the middleware chain
 */
export type NextFunction = () => Promise<any>;

/**
 * Function-based middleware signature
 */
export type MiddlewareFunction = (
  context: MiddlewareContext,
  next: NextFunction
) => Promise<any>;

/**
 * Class-based middleware interface
 */
export interface IMiddleware {
  /**
   * Execute the middleware
   */
  execute(context: MiddlewareContext, next: NextFunction): Promise<any>;
  
  /**
   * Optional middleware name for identification
   */
  name?: string;
  
  /**
   * Optional priority (lower numbers execute first)
   */
  priority?: number;
}

/**
 * Middleware constructor type
 */
export type MiddlewareConstructor = new (...args: any[]) => IMiddleware;

/**
 * Middleware chain execution result
 */
export interface MiddlewareResult {
  /**
   * The final result after all middleware execution
   */
  result: any;
  
  /**
   * Total execution time in milliseconds
   */
  executionTime: number;
  
  /**
   * Whether any middleware modified the result
   */
  modified: boolean;
  
  /**
   * Middleware execution order and timing
   */
  middlewareTrace?: Array<{
    name: string;
    executionTime: number;
    order: number;
  }>;
}

/**
 * Middleware configuration options
 */
export interface MiddlewareOptions {
  /**
   * Whether to collect execution traces
   */
  enableTrace?: boolean;
  
  /**
   * Maximum execution time before timeout (ms)
   */
  timeout?: number;
  
  /**
   * Whether to continue on middleware errors
   */
  continueOnError?: boolean;
  
  /**
   * Global middleware to apply to all requests
   */
  global?: Array<MiddlewareFunction | MiddlewareConstructor>;
}

/**
 * Error handler for middleware chain
 */
export interface MiddlewareErrorHandler {
  /**
   * Handle middleware error
   */
  handleError(
    error: Error,
    context: MiddlewareContext,
    middlewareName?: string
  ): Promise<any>;
}

/**
 * Middleware registry entry
 */
export interface MiddlewareRegistryEntry {
  /**
   * Middleware identifier
   */
  id: string;
  
  /**
   * Middleware instance or constructor
   */
  middleware: MiddlewareFunction | MiddlewareConstructor;
  
  /**
   * Priority for ordering
   */
  priority: number;
  
  /**
   * Whether this is a global middleware
   */
  global: boolean;
  
  /**
   * Middleware metadata
   */
  metadata?: Record<string, any> | undefined;
}

/**
 * Built-in middleware names for common operations
 */
export enum BuiltinMiddleware {
  LOGGING = 'logging',
  VALIDATION = 'validation', 
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  RATE_LIMITING = 'rate-limiting',
  CACHING = 'caching',
  METRICS = 'metrics',
  ERROR_HANDLING = 'error-handling',
  TRACING = 'tracing'
}

/**
 * Middleware execution phase
 */
export enum MiddlewarePhase {
  BEFORE = 'before',
  AFTER = 'after',
  ERROR = 'error',
  FINALLY = 'finally'
}