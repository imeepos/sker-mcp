/**
 * MCP Tool Decorator
 * 
 * This decorator marks methods as MCP tools and stores their metadata
 * using reflect-metadata for later discovery and registration.
 * Enhanced to support @Input parameter decorators for automatic schema building.
 */

import 'reflect-metadata';
import { z } from 'zod';
import { getParameterSchemas, buildInputSchemaFromParams } from './input.js';

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
   * If not provided, will attempt to build from @Input parameter decorators
   */
  inputSchema?: z.ZodSchema<any>;

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
 * Enhanced to support automatic schema building from @Input parameter decorators.
 * If inputSchema is not provided, it will attempt to build one from parameter decorators.
 *
 * @param options - Tool configuration options
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * class MyService {
 *   // Traditional usage with explicit schema
 *   @McpTool({
 *     name: 'get-user',
 *     description: 'Get user information',
 *     inputSchema: z.object({ id: z.string() }),
 *     middleware: ['auth', 'logging']
 *   })
 *   getUser(request: { id: string }) {
 *     return { id: request.id, name: 'John' };
 *   }
 *   
 *   // New usage with @Input parameter decorators
 *   @McpTool({
 *     name: 'calculate',
 *     description: 'Perform calculation'
 *   })
 *   calculate(
 *     @Input(z.number().min(0)) a: number,
 *     @Input(z.number().min(0)) b: number
 *   ) {
 *     return a + b;
 *   }
 * }
 * ```
 */
export const McpTool = (options: McpToolOptions): MethodDecorator => {
  return function <T>(target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>) {
    // Get parameter schemas from @Input decorators
    const parameterSchemas = getParameterSchemas(target, propertyKey);
    
    // Determine final input schema
    let finalInputSchema = options.inputSchema;
    
    // If no explicit schema provided and we have parameter schemas, build one
    if (!finalInputSchema && parameterSchemas.length > 0) {
      try {
        finalInputSchema = buildInputSchemaFromParams(parameterSchemas);
      } catch (error) {
        console.warn(`Failed to build input schema for ${String(propertyKey)} from parameter decorators:`, error);
        // Fall back to empty object schema
        finalInputSchema = z.object({});
      }
    }
    
    // If still no schema, use empty object as fallback
    if (!finalInputSchema) {
      finalInputSchema = z.object({});
    }
    
    // Create enhanced options with the final schema
    const enhancedOptions = {
      ...options,
      inputSchema: finalInputSchema
    };
    
    // Store metadata for the tool
    Reflect.defineMetadata('mcp:tool', enhancedOptions, target, propertyKey);
    
    // Also store parameter schema metadata for runtime access
    if (parameterSchemas.length > 0) {
      Reflect.defineMetadata('mcp:tool:params', parameterSchemas, target, propertyKey);
    }

    // Return the original descriptor unchanged if provided
    return descriptor;
  };
}