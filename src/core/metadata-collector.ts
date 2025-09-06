/**
 * Enhanced Metadata Collector with Service Pre-binding Support
 * 
 * This module provides functionality to collect metadata from decorated service classes
 * and convert it into the format required by the MCP system for registration.
 * 
 * Enhanced with service instance pre-binding functionality as required by the architecture.
 */

import 'reflect-metadata';
import { randomUUID } from 'crypto';
import type { Injector } from '@sker/di';
import type { 
  ToolMetadata, 
  ResourceMetadata, 
  ResourceTemplateMetadata,
  PromptMetadata, 
  ServiceConstructor,
  IMcpTool,
  IMcpResource,
  IMcpPrompt,
  CallToolRequest,
  ReadResourceRequest,
  GetPromptRequest,
  IsolatedPluginInstance
} from './types';
import type {
  PreBoundService as PreBoundServiceType,
  PreBoundTool,
  PreBoundResource,
  PreBoundPrompt
} from './service-prebinding.js';

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
   * Collected resource template metadata
   */
  resourceTemplates: ResourceTemplateMetadata[];
  
  /**
   * Collected prompt metadata
   */
  prompts: PromptMetadata[];
}

/**
 * Pre-bound service information for tools, resources, and prompts
 */
export interface PreBoundService {
  /**
   * The service instance that was pre-bound
   */
  serviceInstance: any;
  
  /**
   * The injector used to create the service instance
   */
  injector: Injector;
  
  /**
   * The original metadata
   */
  metadata: ToolMetadata | ResourceMetadata | PromptMetadata;
  
  /**
   * Plugin name if from a plugin
   */
  pluginName?: string;
  
  /**
   * Plugin version if from a plugin
   */
  pluginVersion?: string;
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
              errorHandler: metadata.errorHandler,
              isTemplate: metadata.isTemplate
            });
          }
        }
      }
    }

    return resourceMetadata;
  }

  /**
   * Collect resource template metadata from all registered services
   * 
   * @returns Array of resource template metadata
   */
  collectResourceTemplateMetadata(): ResourceTemplateMetadata[] {
    const resourceTemplateMetadata: ResourceTemplateMetadata[] = [];

    for (const serviceClass of this.registeredServices) {
      const prototype = serviceClass.prototype;
      
      // Get all property names from the prototype chain
      const propertyNames = this.getAllPropertyNames(prototype);
      
      for (const propertyName of propertyNames) {
        if (typeof prototype[propertyName] === 'function') {
          const metadata = Reflect.getMetadata('mcp:resource', prototype, propertyName);
          
          // Only collect resources marked as templates
          if (metadata && metadata.isTemplate) {
            resourceTemplateMetadata.push({
              uriTemplate: metadata.uri, // For templates, uri contains the template
              name: metadata.name,
              title: metadata.title,
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

    return resourceTemplateMetadata;
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
      resourceTemplates: this.collectResourceTemplateMetadata(),
      prompts: this.collectPromptMetadata()
    };
  }

  // ==================== Service Pre-binding Methods ====================

  /**
   * Create a pre-bound tool with service instance
   * 
   * This method creates a tool that is pre-bound to a specific service instance,
   * ensuring optimal performance and correct dependency injection context.
   * 
   * @param metadata - Tool metadata
   * @param serviceInstance - Pre-created service instance
   * @param injector - Injector that created the service instance
   * @param pluginName - Optional plugin name for plugin tools
   * @param pluginVersion - Optional plugin version
   * @returns Pre-bound MCP tool
   */
  static createBoundTool(
    metadata: ToolMetadata,
    serviceInstance: any,
    injector: Injector,
    pluginName?: string,
    pluginVersion?: string
  ): PreBoundTool {
    const serviceId = `tool:${pluginName || 'core'}:${metadata.name}`;
    const boundService: PreBoundServiceType = {
      id: serviceId,
      instance: serviceInstance,
      type: 'tool',
      pluginName,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
      metadata: {
        name: metadata.name,
        description: metadata.description,
        version: pluginVersion
      }
    };

    const handler = async (request: CallToolRequest): Promise<any> => {
      try {
        const method = serviceInstance[metadata.methodName];
        if (typeof method !== 'function') {
          throw new Error(`Method ${metadata.methodName} not found on service instance`);
        }

        // Get parameter schemas to determine if we need parameter mapping
        const parameterSchemas = Reflect.getMetadata('mcp:tool:params', serviceInstance, metadata.methodName);
        
        // Prepare method arguments
        let methodArgs: any[];
        if (parameterSchemas && parameterSchemas.length > 0) {
          // Map object parameters to method parameters based on @Input decorators
          methodArgs = [];
          const args = request.params.arguments || {};
          
          for (const paramSchema of parameterSchemas) {
            if (paramSchema && paramSchema.name) {
              methodArgs[paramSchema.index] = args[paramSchema.name];
            }
          }
        } else {
          // Legacy mode: pass entire arguments object
          methodArgs = [request.params.arguments];
        }

        // Apply middleware if present
        if (metadata.middleware && metadata.middleware.length > 0) {
          return await MetadataCollector.executeWithMiddleware(
            boundService,
            'tool',
            request,
            () => method.apply(serviceInstance, methodArgs),
            metadata,
            injector
          );
        }

        // Direct method call
        return await method.apply(serviceInstance, methodArgs);
      } catch (error) {
        // Apply error handler if present
        if (metadata.errorHandler) {
          try {
            const errorHandler = injector.get(metadata.errorHandler);
            if (errorHandler && typeof (errorHandler as any).handleError === 'function') {
              return await (errorHandler as any).handleError(error, {
                toolName: metadata.name,
                args: request.params.arguments,
                timestamp: new Date(),
                pluginName
              });
            }
          } catch (handlerError) {
            // Error handler failed, continue with original error
          }
        }
        throw error;
      }
    };

    const result: PreBoundTool = {
      name: metadata.name,
      description: metadata.description,
      inputSchema: metadata.inputSchema as any,
      handler,
      boundService,
      boundHandler: handler,
      // Additional metadata for tracking pre-bound services
      pluginInjector: injector,
      serviceInstance,
      pluginMetadata: metadata as any
    } as PreBoundTool;

    return result;
  }

  /**
   * Create a pre-bound resource with service instance
   * 
   * @param metadata - Resource metadata
   * @param serviceInstance - Pre-created service instance
   * @param injector - Injector that created the service instance
   * @param pluginName - Optional plugin name for plugin resources
   * @param pluginVersion - Optional plugin version
   * @returns Pre-bound MCP resource
   */
  static createBoundResource(
    metadata: ResourceMetadata,
    serviceInstance: any,
    injector: Injector,
    pluginName?: string,
    pluginVersion?: string
  ): PreBoundResource {
    const serviceId = `resource:${pluginName || 'core'}:${metadata.uri || metadata.name || 'unnamed'}`;
    const boundService: PreBoundServiceType = {
      id: serviceId,
      instance: serviceInstance,
      type: 'resource',
      pluginName,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
      metadata: {
        name: metadata.name || metadata.uri || 'unnamed',
        description: metadata.description,
        version: pluginVersion
      }
    };

    const handler = async (request: ReadResourceRequest): Promise<any> => {
      try {
        const method = serviceInstance[metadata.methodName];
        if (typeof method !== 'function') {
          throw new Error(`Method ${metadata.methodName} not found on service instance`);
        }

        // Apply middleware if present
        if (metadata.middleware && metadata.middleware.length > 0) {
          return await MetadataCollector.executeWithMiddleware(
            boundService,
            'resource',
            request,
            () => method.call(serviceInstance, request.params),
            metadata,
            injector
          );
        }

        // Direct method call
        return await method.call(serviceInstance, request.params);
      } catch (error) {
        // Apply error handler if present
        if (metadata.errorHandler) {
          try {
            const errorHandler = injector.get(metadata.errorHandler);
            if (errorHandler && typeof (errorHandler as any).handleError === 'function') {
              return await (errorHandler as any).handleError(error, {
                resourceUri: metadata.uri,
                requestUri: request.params.uri,
                timestamp: new Date(),
                pluginName
              });
            }
          } catch (handlerError) {
            // Error handler failed, continue with original error
          }
        }
        throw error;
      }
    };

    const result: PreBoundResource = {
      uri: metadata.uri,
      name: metadata.name,
      description: metadata.description,
      mimeType: metadata.mimeType,
      handler,
      boundService,
      boundHandler: handler,
      // Additional metadata for tracking pre-bound services
      pluginInjector: injector,
      serviceInstance,
      pluginMetadata: metadata as any
    } as PreBoundResource;

    return result;
  }

  /**
   * Create a pre-bound prompt with service instance
   * 
   * @param metadata - Prompt metadata
   * @param serviceInstance - Pre-created service instance
   * @param injector - Injector that created the service instance
   * @param pluginName - Optional plugin name for plugin prompts
   * @param pluginVersion - Optional plugin version
   * @returns Pre-bound MCP prompt
   */
  static createBoundPrompt(
    metadata: PromptMetadata,
    serviceInstance: any,
    injector: Injector,
    pluginName?: string,
    pluginVersion?: string
  ): PreBoundPrompt {
    const serviceId = `prompt:${pluginName || 'core'}:${metadata.name}`;
    const boundService: PreBoundServiceType = {
      id: serviceId,
      instance: serviceInstance,
      type: 'prompt',
      pluginName,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0,
      metadata: {
        name: metadata.name,
        description: metadata.description,
        version: pluginVersion
      }
    };

    const handler = async (request: GetPromptRequest): Promise<any> => {
      try {
        const method = serviceInstance[metadata.methodName];
        if (typeof method !== 'function') {
          throw new Error(`Method ${metadata.methodName} not found on service instance`);
        }

        // Get parameter schemas to determine if we need parameter mapping
        const parameterSchemas = Reflect.getMetadata('mcp:tool:params', serviceInstance, metadata.methodName);
        
        // Prepare method arguments
        let methodArgs: any[];
        if (parameterSchemas && parameterSchemas.length > 0) {
          // Map object parameters to method parameters based on @Input decorators
          methodArgs = [];
          const args = request.params.arguments || {};
          
          for (const paramSchema of parameterSchemas) {
            if (paramSchema && paramSchema.name) {
              methodArgs[paramSchema.index] = args[paramSchema.name];
            }
          }
        } else {
          // Legacy mode: pass entire arguments object
          methodArgs = [request.params.arguments];
        }

        // Apply middleware if present
        if (metadata.middleware && metadata.middleware.length > 0) {
          return await MetadataCollector.executeWithMiddleware(
            boundService,
            'prompt',
            request,
            () => method.apply(serviceInstance, methodArgs),
            metadata,
            injector
          );
        }

        // Direct method call
        return await method.apply(serviceInstance, methodArgs);
      } catch (error) {
        // Apply error handler if present
        if (metadata.errorHandler) {
          try {
            const errorHandler = injector.get(metadata.errorHandler);
            if (errorHandler && typeof (errorHandler as any).handleError === 'function') {
              return await (errorHandler as any).handleError(error, {
                promptName: metadata.name,
                args: request.params.arguments,
                timestamp: new Date(),
                pluginName
              });
            }
          } catch (handlerError) {
            // Error handler failed, continue with original error
          }
        }
        throw error;
      }
    };

    const result: PreBoundPrompt = {
      name: metadata.name,
      description: metadata.description,
      arguments: metadata.arguments as any,
      handler,
      boundService,
      boundHandler: handler,
      // Additional metadata for tracking pre-bound services
      pluginInjector: injector,
      serviceInstance,
      pluginMetadata: metadata as any
    } as PreBoundPrompt;

    return result;
  }

  /**
   * Create pre-bound services from an isolated plugin instance
   * 
   * This method processes an isolated plugin instance and creates all pre-bound
   * tools, resources, and prompts with the correct service instances and injector context.
   * 
   * @param isolatedInstance - The isolated plugin instance
   * @returns Object containing all pre-bound services
   */
  static async createPreBoundServicesFromPlugin(
    isolatedInstance: IsolatedPluginInstance
  ): Promise<{
    tools: PreBoundTool[];
    resources: PreBoundResource[];
    prompts: PreBoundPrompt[];
  }> {
    const { plugin, injector } = isolatedInstance;
    const tools: PreBoundTool[] = [];
    const resources: PreBoundResource[] = [];
    const prompts: PreBoundPrompt[] = [];

    // Process each service class in the plugin
    for (const ServiceClass of plugin.services) {
      try {
        // Create service instance using the plugin's isolated injector
        const serviceInstance = injector.get(ServiceClass);
        
        // Collect metadata from the service class
        const toolMetadata = MetadataCollector.getToolsMetadataFromService(ServiceClass);
        const resourceMetadata = MetadataCollector.getResourcesMetadataFromService(ServiceClass);
        const promptMetadata = MetadataCollector.getPromptsMetadataFromService(ServiceClass);

        // Create pre-bound tools
        for (const metadata of toolMetadata) {
          const boundTool = MetadataCollector.createBoundTool(
            metadata,
            serviceInstance,
            injector,
            plugin.name,
            plugin.version
          );
          tools.push(boundTool);
        }

        // Create pre-bound resources
        for (const metadata of resourceMetadata) {
          const boundResource = MetadataCollector.createBoundResource(
            metadata,
            serviceInstance,
            injector,
            plugin.name,
            plugin.version
          );
          resources.push(boundResource);
        }

        // Create pre-bound prompts
        for (const metadata of promptMetadata) {
          const boundPrompt = MetadataCollector.createBoundPrompt(
            metadata,
            serviceInstance,
            injector,
            plugin.name,
            plugin.version
          );
          prompts.push(boundPrompt);
        }
      } catch (error) {
        console.error(`Error creating service instance for ${ServiceClass.name}:`, error);
        // Continue with other services even if one fails
      }
    }

    return { tools, resources, prompts };
  }

  /**
   * Get tool metadata from a single service class
   * 
   * @param ServiceClass - The service class to extract metadata from
   * @returns Array of tool metadata
   */
  static getToolsMetadataFromService(ServiceClass: ServiceConstructor): ToolMetadata[] {
    const toolMetadata: ToolMetadata[] = [];
    const prototype = ServiceClass.prototype;
    const propertyNames = MetadataCollector.getAllPropertyNamesStatic(prototype);

    for (const propertyName of propertyNames) {
      if (typeof prototype[propertyName] === 'function') {
        const metadata = Reflect.getMetadata('mcp:tool', prototype, propertyName);
        
        if (metadata) {
          toolMetadata.push({
            name: metadata.name,
            description: metadata.description,
            inputSchema: metadata.inputSchema,
            serviceClass: ServiceClass,
            methodName: propertyName,
            middleware: metadata.middleware || [],
            errorHandler: metadata.errorHandler
          });
        }
      }
    }

    return toolMetadata;
  }

  /**
   * Get resource metadata from a single service class
   * 
   * @param ServiceClass - The service class to extract metadata from
   * @returns Array of resource metadata
   */
  static getResourcesMetadataFromService(ServiceClass: ServiceConstructor): ResourceMetadata[] {
    const resourceMetadata: ResourceMetadata[] = [];
    const prototype = ServiceClass.prototype;
    const propertyNames = MetadataCollector.getAllPropertyNamesStatic(prototype);

    for (const propertyName of propertyNames) {
      if (typeof prototype[propertyName] === 'function') {
        const metadata = Reflect.getMetadata('mcp:resource', prototype, propertyName);
        
        if (metadata) {
          resourceMetadata.push({
            uri: metadata.uri,
            name: metadata.name,
            description: metadata.description,
            mimeType: metadata.mimeType,
            serviceClass: ServiceClass,
            methodName: propertyName,
            middleware: metadata.middleware || [],
            errorHandler: metadata.errorHandler
          });
        }
      }
    }

    return resourceMetadata;
  }

  /**
   * Get prompt metadata from a single service class
   * 
   * @param ServiceClass - The service class to extract metadata from
   * @returns Array of prompt metadata
   */
  static getPromptsMetadataFromService(ServiceClass: ServiceConstructor): PromptMetadata[] {
    const promptMetadata: PromptMetadata[] = [];
    const prototype = ServiceClass.prototype;
    const propertyNames = MetadataCollector.getAllPropertyNamesStatic(prototype);

    for (const propertyName of propertyNames) {
      if (typeof prototype[propertyName] === 'function') {
        const metadata = Reflect.getMetadata('mcp:prompt', prototype, propertyName);
        
        if (metadata) {
          promptMetadata.push({
            name: metadata.name,
            description: metadata.description,
            arguments: metadata.arguments,
            serviceClass: ServiceClass,
            methodName: propertyName,
            middleware: metadata.middleware || [],
            errorHandler: metadata.errorHandler
          });
        }
      }
    }

    return promptMetadata;
  }

  /**
   * Execute middleware chain for pre-bound services with enhanced plugin support
   * 
   * @param boundService - The pre-bound service information
   * @param type - Type of service (tool, resource, prompt)
   * @param request - The request object
   * @param handler - The actual handler function
   * @returns Result from handler after middleware execution
   */
  private static async executeWithMiddleware(
    boundService: PreBoundServiceType,
    type: 'tool' | 'resource' | 'prompt',
    request: any,
    handler: () => Promise<any>,
    metadata?: any,
    injector?: any
  ): Promise<any> {
    const pluginName = boundService.pluginName;
    const middlewareClasses = metadata.middleware;

    if (!middlewareClasses || middlewareClasses.length === 0) {
      return await handler();
    }

    // Enhanced middleware context with plugin awareness
    const context = {
      type,
      name: 'name' in metadata ? metadata.name : 'uri' in metadata ? metadata.uri : 'unknown',
      request,
      metadata,
      requestId: randomUUID(),
      startTime: new Date(),
      pluginName,
      injector,
      // Additional context for plugin-aware middleware
      serviceClass: metadata.serviceClass?.name,
      methodName: metadata.methodName,
      pluginContext: pluginName ? {
        name: pluginName,
        injector,
        version: boundService.metadata.version
      } : undefined
    };

    // Try to use MiddlewareExecutor if available for better orchestration
    try {
      const middlewareExecutor = injector.get('MiddlewareExecutor');
      if (middlewareExecutor && typeof middlewareExecutor.execute === 'function') {
        const result = await middlewareExecutor.execute(
          context,
          middlewareClasses.map((cls: any) => cls.name || cls.toString()),
          handler
        );
        return result.result;
      }
    } catch (error) {
      // Fall back to manual middleware execution if MiddlewareExecutor is not available
    }

    // Manual middleware chain execution with enhanced error handling
    let index = 0;
    const middlewareStack: any[] = [];
    
    const next = async (): Promise<any> => {
      if (index < middlewareClasses.length) {
        const MiddlewareClass = middlewareClasses[index++];
        let middleware: any;

        try {
          // Try to get middleware instance from injector
          middleware = injector.get(MiddlewareClass);
        } catch (injectionError) {
          // If injection fails, try to create instance directly
          try {
            if (typeof MiddlewareClass === 'function') {
              middleware = new MiddlewareClass();
            } else {
              console.warn(`Unable to resolve middleware: ${MiddlewareClass}`);
              return await next(); // Skip this middleware
            }
          } catch (instantiationError) {
            console.warn(`Failed to instantiate middleware: ${MiddlewareClass}`, instantiationError);
            return await next(); // Skip this middleware
          }
        }

        middlewareStack.push({
          class: MiddlewareClass,
          instance: middleware,
          index: index - 1
        });

        if (middleware && typeof middleware.execute === 'function') {
          try {
            return await middleware.execute(context, next);
          } catch (middlewareError) {
            console.error(`Middleware ${MiddlewareClass.name || 'unknown'} failed:`, middlewareError);
            
            // Apply middleware error recovery strategy
            const errorRecoveryStrategy = metadata.errorRecoveryStrategy || 'continue';
            
            if (errorRecoveryStrategy === 'abort') {
              throw middlewareError;
            } else if (errorRecoveryStrategy === 'skip') {
              return await next(); // Continue to next middleware
            } else {
              // Default: continue but log error
              console.warn(`Continuing after middleware error in ${MiddlewareClass.name || 'unknown'}`);
              return await next();
            }
          }
        } else {
          console.warn(`Middleware ${MiddlewareClass.name || 'unknown'} does not have execute method`);
          return await next(); // Skip invalid middleware
        }
      } else {
        // All middleware executed, call the actual handler
        try {
          return await handler();
        } catch (handlerError) {
          // Enhance error with middleware context
          const enhancedError = new Error(
            `Handler execution failed after ${middlewareStack.length} middleware(s): ${(handlerError as Error).message || String(handlerError)}`
          );
          (enhancedError as any).originalError = handlerError;
          (enhancedError as any).middlewareStack = middlewareStack.map(m => ({
            name: m.class.name || 'unknown',
            index: m.index
          }));
          (enhancedError as any).context = {
            type,
            name: context.name,
            pluginName,
            requestId: context.requestId
          };
          
          throw enhancedError;
        }
      }
    };

    return await next();
  }

  /**
   * Create plugin-aware middleware configuration
   * 
   * This method helps configure middleware for plugin services with proper
   * plugin isolation and configuration inheritance.
   */
  static createPluginMiddlewareConfig(
    pluginName: string,
    pluginConfig: any,
    globalMiddleware: string[] = []
  ): {
    enabledMiddleware: string[];
    disabledMiddleware: string[];
    customConfig: Record<string, any>;
    executionOrder: string[];
  } {
    const config = pluginConfig?.middleware || {};
    
    return {
      enabledMiddleware: [
        ...globalMiddleware,
        ...(config.enabled || [])
      ].filter(m => !config.disabled?.includes(m)),
      
      disabledMiddleware: config.disabled || [],
      
      customConfig: config.custom || {},
      
      executionOrder: config.order || [
        ...globalMiddleware,
        ...(config.enabled || [])
      ]
    };
  }

  /**
   * Get all property names from the prototype chain (static version)
   * 
   * @param obj - The object to get property names from
   * @returns Array of property names
   */
  private static getAllPropertyNamesStatic(obj: any): string[] {
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

  /**
   * Get all property names from the prototype chain, including inherited ones
   * 
   * @param obj - The object to get property names from
   * @returns Array of property names
   */
  private getAllPropertyNames(obj: any): string[] {
    return MetadataCollector.getAllPropertyNamesStatic(obj);
  }
}