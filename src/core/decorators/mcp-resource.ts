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
   * Resource URI or URI template (e.g., "file:///{path}", "config://settings/{key}")
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
  
  /**
   * Optional title for display purposes
   * If not provided, name will be used for display
   */
  title?: string;
  
  /**
   * Indicates if this resource should be treated as a template
   * If true, the uri field should contain a URI template pattern (RFC 6570)
   * Template resources will be included in resources/templates/list response
   */
  isTemplate?: boolean;
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
 *   // Regular resource
 *   @McpResource({
 *     uri: 'file:///config.json',
 *     name: 'config-file',
 *     description: 'Application configuration file',
 *     mimeType: 'application/json'
 *   })
 *   getConfig() {
 *     return fs.readFileSync('/config.json', 'utf-8');
 *   }
 *
 *   // Template resource
 *   @McpResource({
 *     uri: 'file:///{path}',
 *     name: 'local-file',
 *     title: 'Local File',
 *     description: 'Access local files by path',
 *     mimeType: 'text/plain',
 *     isTemplate: true,
 *     middleware: ['fileAccess']
 *   })
 *   readFile(request: { uri: string }) {
 *     const path = new URL(request.uri).pathname;
 *     return fs.readFileSync(path, 'utf-8');
 *   }
 * }
 * ```
 */
export function McpResource(options: McpResourceOptions) {
  return function (target: any, propertyKey: string | symbol, descriptor?: PropertyDescriptor): PropertyDescriptor | void {
    // Store metadata for the resource
    Reflect.defineMetadata('mcp:resource', options, target, propertyKey);

    // Return the original descriptor unchanged if provided
    return descriptor;
  };
}