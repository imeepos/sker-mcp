/**
 * Metadata Collector
 * 
 * This module provides functionality to collect metadata from decorated service classes
 * and convert it into the format required by the MCP system for registration.
 */

import 'reflect-metadata';
import type { 
  ToolMetadata, 
  ResourceMetadata, 
  PromptMetadata, 
  ServiceConstructor 
} from './types';

/**
 * Complete metadata collection result
 */
export interface AllMetadata {
  /**
   * Collected tool metadata
   */
  tools: ToolMetadata[];
  
  /**
   * Collected resource metadata
   */
  resources: ResourceMetadata[];
  
  /**
   * Collected prompt metadata
   */
  prompts: PromptMetadata[];
}

/**
 * MetadataCollector class responsible for discovering and collecting
 * metadata from decorated service classes.
 */
export class MetadataCollector {
  private registeredServices: Set<ServiceConstructor> = new Set();

  /**
   * Register a service class for metadata collection
   * 
   * @param serviceClass - The service class to register
   */
  registerService(serviceClass: ServiceConstructor): void {
    this.registeredServices.add(serviceClass);
  }

  /**
   * Get all registered service classes
   * 
   * @returns Array of registered service classes
   */
  getRegisteredServices(): ServiceConstructor[] {
    return Array.from(this.registeredServices);
  }

  /**
   * Clear all registered services
   */
  clearServices(): void {
    this.registeredServices.clear();
  }

  /**
   * Collect tool metadata from all registered services
   * 
   * @returns Array of tool metadata
   */
  collectToolMetadata(): ToolMetadata[] {
    const toolMetadata: ToolMetadata[] = [];

    for (const serviceClass of this.registeredServices) {
      const prototype = serviceClass.prototype;
      
      // Get all property names from the prototype chain
      const propertyNames = this.getAllPropertyNames(prototype);
      
      for (const propertyName of propertyNames) {
        if (typeof prototype[propertyName] === 'function') {
          const metadata = Reflect.getMetadata('mcp:tool', prototype, propertyName);
          
          if (metadata) {
            toolMetadata.push({
              name: metadata.name,
              description: metadata.description,
              inputSchema: metadata.inputSchema,
              serviceClass,
              methodName: propertyName,
              middleware: metadata.middleware || [],
              errorHandler: metadata.errorHandler
            });
          }
        }
      }
    }

    return toolMetadata;
  }

  /**
   * Collect resource metadata from all registered services
   * 
   * @returns Array of resource metadata
   */
  collectResourceMetadata(): ResourceMetadata[] {
    const resourceMetadata: ResourceMetadata[] = [];

    for (const serviceClass of this.registeredServices) {
      const prototype = serviceClass.prototype;
      
      // Get all property names from the prototype chain
      const propertyNames = this.getAllPropertyNames(prototype);
      
      for (const propertyName of propertyNames) {
        if (typeof prototype[propertyName] === 'function') {
          const metadata = Reflect.getMetadata('mcp:resource', prototype, propertyName);
          
          if (metadata) {
            resourceMetadata.push({
              uri: metadata.uri,
              name: metadata.name,
              description: metadata.description,
              mimeType: metadata.mimeType,
              serviceClass,
              methodName: propertyName,
              middleware: metadata.middleware || [],
              errorHandler: metadata.errorHandler
            });
          }
        }
      }
    }

    return resourceMetadata;
  }

  /**
   * Collect prompt metadata from all registered services
   * 
   * @returns Array of prompt metadata
   */
  collectPromptMetadata(): PromptMetadata[] {
    const promptMetadata: PromptMetadata[] = [];

    for (const serviceClass of this.registeredServices) {
      const prototype = serviceClass.prototype;
      
      // Get all property names from the prototype chain
      const propertyNames = this.getAllPropertyNames(prototype);
      
      for (const propertyName of propertyNames) {
        if (typeof prototype[propertyName] === 'function') {
          const metadata = Reflect.getMetadata('mcp:prompt', prototype, propertyName);
          
          if (metadata) {
            promptMetadata.push({
              name: metadata.name,
              description: metadata.description,
              arguments: metadata.arguments,
              serviceClass,
              methodName: propertyName,
              middleware: metadata.middleware || [],
              errorHandler: metadata.errorHandler
            });
          }
        }
      }
    }

    return promptMetadata;
  }

  /**
   * Collect all metadata types from all registered services
   * 
   * @returns Complete metadata collection result
   */
  collectAllMetadata(): AllMetadata {
    return {
      tools: this.collectToolMetadata(),
      resources: this.collectResourceMetadata(),
      prompts: this.collectPromptMetadata()
    };
  }

  /**
   * Get all property names from the prototype chain, including inherited ones
   * 
   * @param obj - The object to get property names from
   * @returns Array of property names
   */
  private getAllPropertyNames(obj: any): string[] {
    const propertyNames = new Set<string>();
    let currentObj = obj;

    while (currentObj && currentObj !== Object.prototype) {
      // Get own property names (methods defined directly on this prototype)
      Object.getOwnPropertyNames(currentObj).forEach(name => {
        if (name !== 'constructor') {
          propertyNames.add(name);
        }
      });
      
      // Move up the prototype chain
      currentObj = Object.getPrototypeOf(currentObj);
    }

    return Array.from(propertyNames);
  }
}