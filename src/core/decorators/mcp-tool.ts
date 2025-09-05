/**
 * MCP Tool Decorator
 * 
 * This decorator marks methods as MCP tools and stores their metadata
 * using reflect-metadata for later discovery and registration.
 */

import 'reflect-metadata';
import type { z } from 'zod';

/**
 * Options for the @McpTool decorator
 */
export interface McpToolOptions {
  /**
   * Tool name (must be unique)
   */
  name: string;
  
  /**
   * Tool description
   */
  description: string;
  
  /**
   * Input schema for validation using Zod
   */
  inputSchema: z.ZodSchema<any>;
  
  /**
   * Optional middleware to apply to this tool
   */
  middleware?: string[];
  
  /**
   * Optional error handler method name
   */
  errorHandler?: string;
}

/**
 * @McpTool decorator for marking methods as MCP tools
 * 
 * @param options - Tool configuration options
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * class MyService {
 *   @McpTool({
 *     name: 'get-user',
 *     description: 'Get user information',
 *     inputSchema: z.object({ id: z.string() }),
 *     middleware: ['auth', 'logging']
 *   })
 *   getUser(request: { id: string }) {
 *     return { id: request.id, name: 'John' };
 *   }
 * }
 * ```
 */
export function McpTool(options: McpToolOptions): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Store metadata for the tool
    Reflect.defineMetadata('mcp:tool', options, target, propertyKey);
    
    // Return the original descriptor unchanged
    return descriptor;
  };
}