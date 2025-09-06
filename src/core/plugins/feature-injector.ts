/**
 * Feature Injector - Plugin Isolation Architecture
 * 
 * This module provides a sophisticated plugin isolation system based on the
 * Feature Injector design pattern. It creates isolated dependency injection
 * containers for plugins while maintaining communication channels with the
 * main application.
 */

import {
  Injector,
  Provider,
  Injectable,
  InjectionToken,
  createFeatureInjector
} from '@sker/di';
import type {
  IPlugin,
  IEnhancedPlugin,
  IFeatureInjector,
  PluginContext,
  PluginIsolationOptions,
  PluginCommunicationBridge,
  IsolatedPluginInstance,
  Container
} from '../types.js';

/**
 * Plugin isolation levels
 */
export enum IsolationLevel {
  /** No isolation - direct access to parent container */
  NONE = 'none',
  /** Service isolation - separate service instances */
  SERVICE = 'service',
  /** Full isolation - completely separate container */
  FULL = 'full'
}

/**
 * Plugin resource access permissions
 */
export interface PluginPermissions {
  /** Can access parent container services */
  parentServices: boolean;
  /** Can register global services */
  globalRegistration: boolean;
  /** Can access other plugins */
  crossPluginAccess: boolean;
  /** Can modify core system services */
  coreSystemAccess: boolean;
  /** Custom permission flags */
  custom?: Record<string, boolean>;
}

/**
 * Default plugin permissions - secure by default
 */
const DEFAULT_PERMISSIONS: PluginPermissions = {
  parentServices: false,
  globalRegistration: false,
  crossPluginAccess: false,
  coreSystemAccess: false
};

/**
 * Communication bridge between parent and child containers
 */
class PluginCommunicationBridgeImpl implements PluginCommunicationBridge {
  constructor(
    private readonly parentInjector: Injector,
    private readonly childInjector: Injector,
    private readonly permissions: PluginPermissions,
    private readonly pluginId: string
  ) {}

  /**
   * Request service from parent container
   */
  async requestFromParent<T>(token: InjectionToken<T> | string): Promise<T | null> {
    if (!this.permissions.parentServices) {
      throw new Error(`Plugin ${this.pluginId} does not have permission to access parent services`);
    }

    try {
      return this.parentInjector.get(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Provide service to parent container
   */
  async provideToParent<T>(token: InjectionToken<T> | string, provider: Provider<T>): Promise<void> {
    if (!this.permissions.globalRegistration) {
      throw new Error(`Plugin ${this.pluginId} does not have permission for global service registration`);
    }

    // In a real implementation, this would require careful consideration
    // of service lifecycle and potential conflicts
    throw new Error('Global service registration not yet implemented');
  }

  /**
   * Get service from child container
   */
  async getFromChild<T>(token: InjectionToken<T> | string): Promise<T | null> {
    try {
      return this.childInjector.get(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Send message between containers
   */
  async sendMessage(target: 'parent' | 'child', message: any): Promise<any> {
    // Plugin inter-communication system
    // This could be extended with event-based messaging
    return null;
  }
}

/**
 * Isolated plugin instance wrapper
 */
class IsolatedPluginInstanceImpl implements IsolatedPluginInstance {
  constructor(
    public readonly plugin: IPlugin,
    public readonly container: Container,
    public readonly injector: Injector,
    public readonly bridge: PluginCommunicationBridge,
    public readonly permissions: PluginPermissions,
    public readonly isolationLevel: IsolationLevel
  ) {}

  /**
   * Get service from plugin's isolated container
   */
  async getService<T>(token: InjectionToken<T> | string): Promise<T> {
    return this.injector.get(token);
  }

  /**
   * Check if plugin has specific permission
   */
  hasPermission(permission: keyof PluginPermissions): boolean {
    return this.permissions[permission] === true;
  }

  /**
   * Destroy the isolated plugin instance
   */
  async destroy(): Promise<void> {
    // Call plugin's cleanup hooks
    if (this.plugin.hooks?.onUnload) {
      await this.plugin.hooks.onUnload();
    }

    // Dispose of the container if it has a dispose method
    if ('dispose' in this.container && typeof this.container.dispose === 'function') {
      await this.container.dispose();
    }
  }
}

/**
 * Feature Injector Implementation
 * 
 * Creates and manages isolated dependency injection containers for plugins,
 * providing secure plugin execution environments with configurable access
 * to parent container services.
 */
@Injectable()
export class FeatureInjector implements IFeatureInjector {
  private readonly isolatedPlugins = new Map<string, IsolatedPluginInstance>();
  private readonly pluginContainers = new Map<string, Container>();

  constructor(
    private readonly parentInjector: Injector
  ) {}

  /**
   * Create isolated plugin instance with dependency injection
   */
  async createIsolatedPlugin(
    plugin: IPlugin,
    options: PluginIsolationOptions = {}
  ): Promise<IsolatedPluginInstance> {
    const pluginId = `${plugin.name}@${plugin.version}`;
    
    // Check if plugin is already isolated
    if (this.isolatedPlugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is already isolated`);
    }

    // Configure isolation options
    const isolationLevel = options.isolationLevel || IsolationLevel.SERVICE;
    const permissions: PluginPermissions = {
      ...DEFAULT_PERMISSIONS,
      ...options.permissions
    };

    // Create isolated container
    const isolatedContainer = await this.createIsolatedContainer(
      plugin,
      isolationLevel,
      permissions
    );

    // Create injector for the isolated container
    const childInjector = isolatedContainer.injector || this.parentInjector;

    // Create communication bridge
    const bridge = new PluginCommunicationBridgeImpl(
      this.parentInjector,
      childInjector,
      permissions,
      pluginId
    );

    // Create isolated plugin instance
    const isolatedInstance = new IsolatedPluginInstanceImpl(
      plugin,
      isolatedContainer,
      childInjector,
      bridge,
      permissions,
      isolationLevel
    );

    // Store references
    this.isolatedPlugins.set(pluginId, isolatedInstance);
    this.pluginContainers.set(pluginId, isolatedContainer);

    // Initialize plugin in isolated environment
    await this.initializePluginInIsolation(isolatedInstance);

    return isolatedInstance;
  }

  /**
   * Get isolated plugin instance
   */
  getIsolatedPlugin(pluginName: string, version?: string): IsolatedPluginInstance | null {
    const pluginId = version ? `${pluginName}@${version}` : 
      Array.from(this.isolatedPlugins.keys()).find(key => key.startsWith(`${pluginName}@`));
    
    return pluginId ? this.isolatedPlugins.get(pluginId) || null : null;
  }

  /**
   * List all isolated plugins
   */
  listIsolatedPlugins(): IsolatedPluginInstance[] {
    return Array.from(this.isolatedPlugins.values());
  }

  /**
   * Remove isolated plugin
   */
  async removeIsolatedPlugin(pluginName: string, version?: string): Promise<boolean> {
    const pluginId = version ? `${pluginName}@${version}` : 
      Array.from(this.isolatedPlugins.keys()).find(key => key.startsWith(`${pluginName}@`));

    if (!pluginId) {
      return false;
    }

    const isolatedInstance = this.isolatedPlugins.get(pluginId);
    if (isolatedInstance) {
      await isolatedInstance.destroy();
      this.isolatedPlugins.delete(pluginId);
      this.pluginContainers.delete(pluginId);
      return true;
    }

    return false;
  }

  /**
   * Create isolated dependency injection container
   */
  private async createIsolatedContainer(
    plugin: IEnhancedPlugin,
    isolationLevel: IsolationLevel,
    permissions: PluginPermissions
  ): Promise<Container> {
    switch (isolationLevel) {
      case IsolationLevel.NONE:
        // No isolation - return parent container
        return this.parentInjector as any; // Type assertion for compatibility

      case IsolationLevel.SERVICE:
        // Service-level isolation - create child container with shared parent services
        return this.createChildContainer(plugin, permissions);

      case IsolationLevel.FULL:
        // Full isolation - completely separate container
        return this.createFullyIsolatedContainer(plugin);

      default:
        throw new Error(`Unknown isolation level: ${isolationLevel}`);
    }
  }

  /**
   * Create child container with controlled access to parent services
   */
  private createChildContainer(plugin: IEnhancedPlugin, permissions: PluginPermissions): Container {
    const providers: Provider[] = [];

    // Add plugin-specific providers
    if (plugin.providers) {
      providers.push(...plugin.providers);
    }

    // Add plugin services as providers
    if (plugin.services) {
      for (const serviceClass of plugin.services) {
        providers.push({ provide: serviceClass, useClass: serviceClass });
      }
    }

    // Create child injector with selective parent access
    const childProviders = permissions.parentServices 
      ? [...providers] // Allow access to parent services
      : [...providers]; // Only plugin-specific providers

    // Create a new container/injector
    // Note: This is a simplified implementation
    // In a real system, you'd use the actual DI framework's child container creation
    const childInjector = createFeatureInjector(childProviders, this.parentInjector as any);

    return {
      injector: childInjector,
      providers: childProviders
    } as Container;
  }

  /**
   * Create fully isolated container with no parent access
   */
  private createFullyIsolatedContainer(plugin: IEnhancedPlugin): Container {
    const providers: Provider[] = [];

    // Add plugin-specific providers
    if (plugin.providers) {
      providers.push(...plugin.providers);
    }

    // Add plugin services as providers
    if (plugin.services) {
      for (const serviceClass of plugin.services) {
        providers.push({ provide: serviceClass, useClass: serviceClass });
      }
    }

    // Add minimal core services if needed
    // This might include essential services like logging, etc.

    const isolatedInjector = createFeatureInjector(providers, this.parentInjector as any);

    return {
      injector: isolatedInjector,
      providers: providers
    } as Container;
  }

  /**
   * Initialize plugin in its isolated environment
   */
  private async initializePluginInIsolation(isolatedInstance: IsolatedPluginInstance): Promise<void> {
    const { plugin } = isolatedInstance;

    try {
      // Call plugin initialization hook
      if (plugin.hooks?.onLoad) {
        await plugin.hooks.onLoad();
      }

      // Initialize plugin services in isolated container
      if (plugin.services) {
        for (const serviceClass of plugin.services) {
          try {
            // Instantiate service in isolated container
            const serviceInstance = isolatedInstance.injector.get(serviceClass);
            
            // If service has initialization method, call it
            if (serviceInstance && typeof serviceInstance.initialize === 'function') {
              await serviceInstance.initialize();
            }
          } catch (error) {
            console.error(`Failed to initialize service ${serviceClass.name} for plugin ${plugin.name}:`, error);
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to initialize plugin ${plugin.name} in isolation: ${error}`);
    }
  }

  /**
   * Get plugin isolation statistics
   */
  getIsolationStats(): {
    totalIsolatedPlugins: number;
    isolationLevels: Record<IsolationLevel, number>;
    memoryUsage?: number;
  } {
    const isolationLevels: Record<IsolationLevel, number> = {
      [IsolationLevel.NONE]: 0,
      [IsolationLevel.SERVICE]: 0,
      [IsolationLevel.FULL]: 0
    };

    for (const instance of this.isolatedPlugins.values()) {
      isolationLevels[instance.isolationLevel]++;
    }

    return {
      totalIsolatedPlugins: this.isolatedPlugins.size,
      isolationLevels
    };
  }

  /**
   * Cleanup all isolated plugins
   */
  async cleanup(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    for (const [pluginId, instance] of this.isolatedPlugins.entries()) {
      cleanupPromises.push(instance.destroy());
    }

    await Promise.allSettled(cleanupPromises);

    this.isolatedPlugins.clear();
    this.pluginContainers.clear();
  }
}

/**
 * Plugin isolation utilities
 */
export class PluginIsolationUtils {
  /**
   * Create secure plugin permissions for different trust levels
   */
  static createPermissions(trustLevel: 'untrusted' | 'trusted' | 'system'): PluginPermissions {
    switch (trustLevel) {
      case 'untrusted':
        return {
          parentServices: false,
          globalRegistration: false,
          crossPluginAccess: false,
          coreSystemAccess: false
        };

      case 'trusted':
        return {
          parentServices: true,
          globalRegistration: false,
          crossPluginAccess: false,
          coreSystemAccess: false
        };

      case 'system':
        return {
          parentServices: true,
          globalRegistration: true,
          crossPluginAccess: true,
          coreSystemAccess: true
        };

      default:
        return DEFAULT_PERMISSIONS;
    }
  }

  /**
   * Validate plugin isolation configuration
   */
  static validateIsolationOptions(options: PluginIsolationOptions): string[] {
    const errors: string[] = [];

    // Validate isolation level
    if (options.isolationLevel && !Object.values(IsolationLevel).includes(options.isolationLevel)) {
      errors.push(`Invalid isolation level: ${options.isolationLevel}`);
    }

    // Validate permissions
    if (options.permissions) {
      const validPermissionKeys: (keyof PluginPermissions)[] = [
        'parentServices', 'globalRegistration', 'crossPluginAccess', 'coreSystemAccess'
      ];

      for (const key of Object.keys(options.permissions)) {
        if (!validPermissionKeys.includes(key as keyof PluginPermissions) && key !== 'custom') {
          errors.push(`Invalid permission key: ${key}`);
        }
      }
    }

    return errors;
  }
}