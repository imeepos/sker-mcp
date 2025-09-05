/**
 * MCP Resource Decorator
 * 
 * This decorator marks methods as MCP resources and stores their metadata
 * using reflect-metadata for later discovery and registration.
 */

import 'reflect-metadata';

/**
 * Options for the @McpResource decorator
 */
export interface McpResourceOptions {
  /**
   * Resource URI template (e.g., "file:///{path}", "config://settings/{key}")
   */
  uri: string;
  
  /**
   * Resource name
   */
  name: string;
  
  /**
   * Resource description
   */
  description: string;
  
  /**
   * Optional MIME type for the resource
   */
  mimeType?: string;
  
  /**
   * Optional middleware to apply to this resource
   */
  middleware?: string[];
  
  /**
   * Optional error handler method name
   */
  errorHandler?: string;
}

/**
 * @McpResource decorator for marking methods as MCP resources
 * 
 * @param options - Resource configuration options
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * class FileService {
 *   @McpResource({
 *     uri: 'file:///{path}',
 *     name: 'local-file',
 *     description: 'Access local files',
 *     mimeType: 'text/plain',
 *     middleware: ['fileAccess']
 *   })
 *   readFile(request: { path: string }) {
 *     return fs.readFileSync(request.path, 'utf-8');
 *   }
 * }
 * ```
 */
export function McpResource(options: McpResourceOptions): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Store metadata for the resource
    Reflect.defineMetadata('mcp:resource', options, target, propertyKey);
    
    // Return the original descriptor unchanged
    return descriptor;
  };
}