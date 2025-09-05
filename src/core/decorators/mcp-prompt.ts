/**
 * MCP Prompt Decorator
 * 
 * This decorator marks methods as MCP prompts and stores their metadata
 * using reflect-metadata for later discovery and registration.
 */

import 'reflect-metadata';
import type { z } from 'zod';

/**
 * Options for the @McpPrompt decorator
 */
export interface McpPromptOptions {
  /**
   * Prompt name (must be unique)
   */
  name: string;
  
  /**
   * Prompt description
   */
  description: string;
  
  /**
   * Optional arguments schema for the prompt using Zod
   */
  arguments?: z.ZodSchema<any>;
  
  /**
   * Optional middleware to apply to this prompt
   */
  middleware?: string[];
  
  /**
   * Optional error handler method name
   */
  errorHandler?: string;
}

/**
 * @McpPrompt decorator for marking methods as MCP prompts
 * 
 * @param options - Prompt configuration options
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * class PromptService {
 *   @McpPrompt({
 *     name: 'generate-summary',
 *     description: 'Generate text summary',
 *     arguments: z.object({ 
 *       text: z.string(),
 *       maxLength: z.number().optional()
 *     }),
 *     middleware: ['validate']
 *   })
 *   generateSummary(request: { text: string; maxLength?: number }) {
 *     return {
 *       messages: [
 *         { role: 'user', content: `Summarize: ${request.text}` }
 *       ]
 *     };
 *   }
 * }
 * ```
 */
export function McpPrompt(options: McpPromptOptions): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Store metadata for the prompt
    Reflect.defineMetadata('mcp:prompt', options, target, propertyKey);
    
    // Return the original descriptor unchanged
    return descriptor;
  };
}