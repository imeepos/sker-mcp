/**
 * Service Pre-binding System
 * 
 * This module provides service instance pre-binding capabilities for MCP tools,
 * resources, and prompts. It optimizes performance by pre-instantiating and
 * caching service instances, reducing latency during MCP operations.
 */

import { Injectable, Inject, Injector } from '@sker/di';
import { LOGGER } from './tokens.js';
import type { IWinstonLogger } from './logging/winston-logger.js';
import type { 
  IMcpTool, 
  IMcpResource, 
  IMcpPrompt,
  CallToolRequest,
  ReadResourceRequest,
  GetPromptRequest
} from './types.js';
import type { IsolatedPluginInstance } from './plugins/index.js';

/**
 * Pre-bound service instance interface
 */
export interface PreBoundService {
  /** Unique service identifier */
  id: string;
  /** Service instance */
  instance: any;
  /** Service type */
  type: 'tool' | 'resource' | 'prompt';
  /** Associated plugin name */
  pluginName?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last accessed timestamp */
  lastAccessed: Date;
  /** Access count for performance metrics */
  accessCount: number;
  /** Service metadata */
  metadata: {
    name: string;
    description?: string;
    version?: string;
  };
}

/**
 * Pre-bound tool instance with optimized handler
 */
export interface PreBoundTool extends IMcpTool {
  /** Pre-bound service instance */
  boundService: PreBoundService;
  /** Optimized handler that uses pre-bound instance */
  boundHandler: (request: CallToolRequest) => Promise<any>;
}

/**
 * Pre-bound resource instance with optimized handler
 */
export interface PreBoundResource extends IMcpResource {
  /** Pre-bound service instance */
  boundService: PreBoundService;
  /** Optimized handler that uses pre-bound instance */
  boundHandler: (request: ReadResourceRequest) => Promise<any>;
}

/**
 * Pre-bound prompt instance with optimized handler
 */
export interface PreBoundPrompt extends IMcpPrompt {
  /** Pre-bound service instance */
  boundService: PreBoundService;
  /** Optimized handler that uses pre-bound instance */
  boundHandler: (request: GetPromptRequest) => Promise<any>;
}

/**
 * Pre-binding configuration options
 */
export interface PreBindingOptions {
  /** Enable lazy loading of services */
  lazyLoading?: boolean;
  /** Service instance cache size limit */
  cacheLimit?: number;
  /** Service instance TTL in milliseconds */
  ttl?: number;
  /** Enable performance monitoring */
  enableMetrics?: boolean;
  /** Service initialization timeout */
  initTimeout?: number;
}

/**
 * Service Pre-binding Manager
 * 
 * Manages pre-instantiation and caching of service instances for optimal
 * performance during MCP operations. Supports plugin isolation awareness
 * and automatic cache management.
 */
@Injectable()
export class ServicePreBindingManager {
  private preBoundServices = new Map<string, PreBoundService>();
  private serviceCache = new Map<string, any>();
  private accessMetrics = new Map<string, { count: number; totalTime: number; avgTime: number }>();
  private cacheHitRate = { hits: 0, misses: 0 };

  constructor(
    @Inject(LOGGER) private readonly logger: IWinstonLogger
  ) {
    this.logger.debug('ServicePreBindingManager initialized');
  }

  /**
   * Create pre-bound tool from plugin service
   */
  async createPreBoundTool(
    toolMetadata: Omit<IMcpTool, 'handler'> & { name: string },
    serviceClass: new (...args: any[]) => any,
    injector: Injector,
    pluginName?: string,
    options: PreBindingOptions = {}
  ): Promise<PreBoundTool> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Creating pre-bound tool', {
        tool: toolMetadata.name,
        plugin: pluginName,
        serviceClass: serviceClass.name
      });

      // Create or get cached service instance
      const serviceId = this.generateServiceId('tool', toolMetadata.name, pluginName);
      let serviceInstance = this.serviceCache.get(serviceId);

      if (!serviceInstance) {
        // Create new service instance
        serviceInstance = await this.createServiceInstance(
          serviceClass,
          injector,
          options.initTimeout || 10000
        );
        
        this.serviceCache.set(serviceId, serviceInstance);
        this.cacheHitRate.misses++;
      } else {
        this.cacheHitRate.hits++;
      }

      // Create pre-bound service metadata
      const preBoundService: PreBoundService = {
        id: serviceId,
        instance: serviceInstance,
        type: 'tool',
        pluginName,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        metadata: {
          name: toolMetadata.name,
          description: toolMetadata.description as string | undefined,
          version: pluginName ? 'plugin' : 'core'
        }
      };

      this.preBoundServices.set(serviceId, preBoundService);

      // Create optimized bound handler
      const boundHandler = this.createBoundToolHandler(preBoundService, toolMetadata);

      // Create pre-bound tool
      const preBoundTool: PreBoundTool = {
        ...toolMetadata,
        boundService: preBoundService,
        boundHandler,
        handler: boundHandler // Use the bound handler as the main handler
      };

      const duration = Date.now() - startTime;
      this.logger.info('Pre-bound tool created successfully', {
        tool: toolMetadata.name,
        plugin: pluginName,
        duration,
        serviceId
      });

      return preBoundTool;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to create pre-bound tool', {
        tool: toolMetadata.name,
        plugin: pluginName,
        error: error instanceof Error ? error.message : String(error),
        duration
      });
      throw error;
    }
  }

  /**
   * Create pre-bound resource from plugin service
   */
  async createPreBoundResource(
    resourceMetadata: Omit<IMcpResource, 'handler'> & { name?: string, uri: string },
    serviceClass: new (...args: any[]) => any,
    injector: Injector,
    pluginName?: string,
    options: PreBindingOptions = {}
  ): Promise<PreBoundResource> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Creating pre-bound resource', {
        resource: resourceMetadata.name,
        plugin: pluginName,
        serviceClass: serviceClass.name
      });

      // Create or get cached service instance
      const serviceId = this.generateServiceId('resource', resourceMetadata.name || resourceMetadata.uri, pluginName);
      let serviceInstance = this.serviceCache.get(serviceId);

      if (!serviceInstance) {
        serviceInstance = await this.createServiceInstance(
          serviceClass,
          injector,
          options.initTimeout || 10000
        );
        
        this.serviceCache.set(serviceId, serviceInstance);
        this.cacheHitRate.misses++;
      } else {
        this.cacheHitRate.hits++;
      }

      // Create pre-bound service metadata
      const preBoundService: PreBoundService = {
        id: serviceId,
        instance: serviceInstance,
        type: 'resource',
        pluginName,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        metadata: {
          name: resourceMetadata.name || resourceMetadata.uri,
          description: resourceMetadata.description as string | undefined,
          version: pluginName ? 'plugin' : 'core'
        }
      };

      this.preBoundServices.set(serviceId, preBoundService);

      // Create optimized bound handler
      const boundHandler = this.createBoundResourceHandler(preBoundService, resourceMetadata);

      // Create pre-bound resource
      const preBoundResource: PreBoundResource = {
        ...resourceMetadata,
        name: resourceMetadata.name || resourceMetadata.uri,
        boundService: preBoundService,
        boundHandler,
        handler: boundHandler
      };

      const duration = Date.now() - startTime;
      this.logger.info('Pre-bound resource created successfully', {
        resource: resourceMetadata.name || resourceMetadata.uri,
        plugin: pluginName,
        duration,
        serviceId
      });

      return preBoundResource;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to create pre-bound resource', {
        resource: resourceMetadata.name || resourceMetadata.uri,
        plugin: pluginName,
        error: error instanceof Error ? error.message : String(error),
        duration
      });
      throw error;
    }
  }

  /**
   * Create pre-bound prompt from plugin service
   */
  async createPreBoundPrompt(
    promptMetadata: Omit<IMcpPrompt, 'handler'> & { name: string },
    serviceClass: new (...args: any[]) => any,
    injector: Injector,
    pluginName?: string,
    options: PreBindingOptions = {}
  ): Promise<PreBoundPrompt> {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Creating pre-bound prompt', {
        prompt: promptMetadata.name,
        plugin: pluginName,
        serviceClass: serviceClass.name
      });

      // Create or get cached service instance
      const serviceId = this.generateServiceId('prompt', promptMetadata.name, pluginName);
      let serviceInstance = this.serviceCache.get(serviceId);

      if (!serviceInstance) {
        serviceInstance = await this.createServiceInstance(
          serviceClass,
          injector,
          options.initTimeout || 10000
        );
        
        this.serviceCache.set(serviceId, serviceInstance);
        this.cacheHitRate.misses++;
      } else {
        this.cacheHitRate.hits++;
      }

      // Create pre-bound service metadata
      const preBoundService: PreBoundService = {
        id: serviceId,
        instance: serviceInstance,
        type: 'prompt',
        pluginName,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        metadata: {
          name: promptMetadata.name,
          description: promptMetadata.description as string | undefined,
          version: pluginName ? 'plugin' : 'core'
        }
      };

      this.preBoundServices.set(serviceId, preBoundService);

      // Create optimized bound handler
      const boundHandler = this.createBoundPromptHandler(preBoundService, promptMetadata);

      // Create pre-bound prompt
      const preBoundPrompt: PreBoundPrompt = {
        ...promptMetadata,
        name: promptMetadata.name,
        boundService: preBoundService,
        boundHandler,
        handler: boundHandler
      };

      const duration = Date.now() - startTime;
      this.logger.info('Pre-bound prompt created successfully', {
        prompt: promptMetadata.name,
        plugin: pluginName,
        duration,
        serviceId
      });

      return preBoundPrompt;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to create pre-bound prompt', {
        prompt: promptMetadata.name,
        plugin: pluginName,
        error: error instanceof Error ? error.message : String(error),
        duration
      });
      throw error;
    }
  }

  /**
   * Create pre-bound services from isolated plugin instance
   */
  async createPreBoundServicesFromPlugin(
    isolatedInstance: IsolatedPluginInstance,
    options: PreBindingOptions = {}
  ): Promise<{
    tools: PreBoundTool[];
    resources: PreBoundResource[];
    prompts: PreBoundPrompt[];
  }> {
    const startTime = Date.now();
    const plugin = isolatedInstance.plugin;
    
    this.logger.info('Creating pre-bound services from plugin', {
      plugin: plugin.name,
      version: plugin.version,
      services: plugin.services?.length || 0
    });

    const tools: PreBoundTool[] = [];
    const resources: PreBoundResource[] = [];
    const prompts: PreBoundPrompt[] = [];

    try {
      // Process each service class in the plugin
      for (const serviceClass of plugin.services || []) {
        try {
          // Use the isolated plugin's injector
          const metadata = await this.extractServiceMetadata(serviceClass, isolatedInstance);
          
          // Create pre-bound services based on metadata
          if (metadata.tools) {
            for (const toolMeta of metadata.tools) {
              const preBoundTool = await this.createPreBoundTool(
                toolMeta,
                serviceClass,
                isolatedInstance.injector,
                plugin.name,
                options
              );
              tools.push(preBoundTool);
            }
          }

          if (metadata.resources) {
            for (const resourceMeta of metadata.resources) {
              const preBoundResource = await this.createPreBoundResource(
                resourceMeta,
                serviceClass,
                isolatedInstance.injector,
                plugin.name,
                options
              );
              resources.push(preBoundResource);
            }
          }

          if (metadata.prompts) {
            for (const promptMeta of metadata.prompts) {
              const preBoundPrompt = await this.createPreBoundPrompt(
                promptMeta,
                serviceClass,
                isolatedInstance.injector,
                plugin.name,
                options
              );
              prompts.push(preBoundPrompt);
            }
          }

        } catch (error) {
          this.logger.error('Failed to create pre-bound service from class', {
            plugin: plugin.name,
            serviceClass: serviceClass.name,
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue with other services
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info('Pre-bound services created from plugin', {
        plugin: plugin.name,
        tools: tools.length,
        resources: resources.length,
        prompts: prompts.length,
        duration
      });

      return { tools, resources, prompts };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to create pre-bound services from plugin', {
        plugin: plugin.name,
        error: error instanceof Error ? error.message : String(error),
        duration
      });
      throw error;
    }
  }

  /**
   * Get pre-binding performance metrics
   */
  getPerformanceMetrics(): {
    totalServices: number;
    cacheHitRate: number;
    servicesByType: Record<string, number>;
    servicesByPlugin: Record<string, number>;
    averageAccessTime: number;
    topAccessedServices: Array<{
      id: string;
      accessCount: number;
      avgTime: number;
    }>;
  } {
    const servicesByType: Record<string, number> = { tool: 0, resource: 0, prompt: 0 };
    const servicesByPlugin: Record<string, number> = {};
    
    for (const service of this.preBoundServices.values()) {
      servicesByType[service.type]++;
      
      if (service.pluginName) {
        servicesByPlugin[service.pluginName] = (servicesByPlugin[service.pluginName] || 0) + 1;
      } else {
        servicesByPlugin['core'] = (servicesByPlugin['core'] || 0) + 1;
      }
    }

    const totalAccesses = this.cacheHitRate.hits + this.cacheHitRate.misses;
    const cacheHitRate = totalAccesses > 0 ? this.cacheHitRate.hits / totalAccesses : 0;
    
    const accessTimes = Array.from(this.accessMetrics.values());
    const averageAccessTime = accessTimes.length > 0 
      ? accessTimes.reduce((sum, metric) => sum + metric.avgTime, 0) / accessTimes.length 
      : 0;

    const topAccessedServices = Array.from(this.preBoundServices.entries())
      .sort(([, a], [, b]) => b.accessCount - a.accessCount)
      .slice(0, 10)
      .map(([id, service]) => ({
        id,
        accessCount: service.accessCount,
        avgTime: this.accessMetrics.get(id)?.avgTime || 0
      }));

    return {
      totalServices: this.preBoundServices.size,
      cacheHitRate,
      servicesByType,
      servicesByPlugin,
      averageAccessTime,
      topAccessedServices
    };
  }

  /**
   * Clear pre-bound services for a specific plugin
   */
  async clearPluginServices(pluginName: string): Promise<void> {
    this.logger.debug('Clearing pre-bound services for plugin', { pluginName });

    const servicesToClear: string[] = [];
    
    for (const [serviceId, service] of this.preBoundServices.entries()) {
      if (service.pluginName === pluginName) {
        servicesToClear.push(serviceId);
      }
    }

    for (const serviceId of servicesToClear) {
      this.preBoundServices.delete(serviceId);
      this.serviceCache.delete(serviceId);
      this.accessMetrics.delete(serviceId);
    }

    this.logger.info('Cleared pre-bound services for plugin', {
      pluginName,
      servicesCleared: servicesToClear.length
    });
  }

  /**
   * Cleanup all pre-bound services
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up all pre-bound services', {
      totalServices: this.preBoundServices.size
    });

    this.preBoundServices.clear();
    this.serviceCache.clear();
    this.accessMetrics.clear();
    this.cacheHitRate = { hits: 0, misses: 0 };
  }

  // Private helper methods

  /**
   * Generate unique service ID
   */
  private generateServiceId(type: string, name: string, pluginName?: string): string {
    const plugin = pluginName || 'core';
    return `${type}:${plugin}:${name}`;
  }

  /**
   * Create service instance with timeout
   */
  private async createServiceInstance(
    serviceClass: new (...args: any[]) => any,
    injector: Injector,
    timeout: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Service instantiation timeout after ${timeout}ms`));
      }, timeout);

      try {
        const instance = injector.get(serviceClass);
        clearTimeout(timeoutId);
        resolve(instance);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Create bound tool handler
   */
  private createBoundToolHandler(
    preBoundService: PreBoundService,
    toolMetadata: Omit<IMcpTool, 'handler'>
  ): (request: CallToolRequest) => Promise<any> {
    return async (request: CallToolRequest) => {
      const startTime = Date.now();
      
      try {
        // Update access metrics
        preBoundService.lastAccessed = new Date();
        preBoundService.accessCount++;

        const instance = preBoundService.instance;
        
        // Call the tool method on the pre-bound instance
        let result: any;
        const methodName = toolMetadata.name as string;
        if (typeof (instance as any)[methodName] === 'function') {
          result = await (instance as any)[methodName](request);
        } else if (typeof instance.handle === 'function') {
          result = await instance.handle(request);
        } else {
          throw new Error(`No handler method found for tool ${toolMetadata.name}`);
        }

        // Update performance metrics
        const duration = Date.now() - startTime;
        this.updateAccessMetrics(preBoundService.id, duration);

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;
        this.updateAccessMetrics(preBoundService.id, duration);
        
        this.logger.error('Pre-bound tool handler failed', {
          tool: toolMetadata.name,
          plugin: preBoundService.pluginName,
          duration,
          error: error instanceof Error ? error.message : String(error)
        });
        
        throw error;
      }
    };
  }

  /**
   * Create bound resource handler
   */
  private createBoundResourceHandler(
    preBoundService: PreBoundService,
    resourceMetadata: Omit<IMcpResource, 'handler'>
  ): (request: ReadResourceRequest) => Promise<any> {
    return async (request: ReadResourceRequest) => {
      const startTime = Date.now();
      
      try {
        preBoundService.lastAccessed = new Date();
        preBoundService.accessCount++;

        const instance = preBoundService.instance;
        
        let result: any;
        if (typeof instance.readResource === 'function') {
          result = await instance.readResource(request);
        } else if (typeof instance.handle === 'function') {
          result = await instance.handle(request);
        } else {
          throw new Error(`No handler method found for resource ${resourceMetadata.uri}`);
        }

        const duration = Date.now() - startTime;
        this.updateAccessMetrics(preBoundService.id, duration);

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;
        this.updateAccessMetrics(preBoundService.id, duration);
        
        this.logger.error('Pre-bound resource handler failed', {
          resource: resourceMetadata.uri,
          plugin: preBoundService.pluginName,
          duration,
          error: error instanceof Error ? error.message : String(error)
        });
        
        throw error;
      }
    };
  }

  /**
   * Create bound prompt handler
   */
  private createBoundPromptHandler(
    preBoundService: PreBoundService,
    promptMetadata: Omit<IMcpPrompt, 'handler'>
  ): (request: GetPromptRequest) => Promise<any> {
    return async (request: GetPromptRequest) => {
      const startTime = Date.now();
      
      try {
        preBoundService.lastAccessed = new Date();
        preBoundService.accessCount++;

        const instance = preBoundService.instance;
        
        let result: any;
        const methodName = promptMetadata.name as string;
        if (typeof (instance as any)[methodName] === 'function') {
          result = await (instance as any)[methodName](request);
        } else if (typeof instance.handle === 'function') {
          result = await instance.handle(request);
        } else {
          throw new Error(`No handler method found for prompt ${promptMetadata.name}`);
        }

        const duration = Date.now() - startTime;
        this.updateAccessMetrics(preBoundService.id, duration);

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;
        this.updateAccessMetrics(preBoundService.id, duration);
        
        this.logger.error('Pre-bound prompt handler failed', {
          prompt: promptMetadata.name,
          plugin: preBoundService.pluginName,
          duration,
          error: error instanceof Error ? error.message : String(error)
        });
        
        throw error;
      }
    };
  }

  /**
   * Extract service metadata from service class
   */
  private async extractServiceMetadata(
    serviceClass: new (...args: any[]) => any,
    isolatedInstance: IsolatedPluginInstance
  ): Promise<{
    tools?: Array<Omit<IMcpTool, 'handler'>>;
    resources?: Array<Omit<IMcpResource, 'handler'>>;
    prompts?: Array<Omit<IMcpPrompt, 'handler'>>;
  }> {
    // This would use reflection to extract metadata from decorators
    // For now, return empty metadata - this would be implemented based on
    // how the decorators store metadata
    return {};
  }

  /**
   * Update access metrics for a service
   */
  private updateAccessMetrics(serviceId: string, duration: number): void {
    const current = this.accessMetrics.get(serviceId) || { count: 0, totalTime: 0, avgTime: 0 };
    
    current.count++;
    current.totalTime += duration;
    current.avgTime = current.totalTime / current.count;
    
    this.accessMetrics.set(serviceId, current);
  }
}