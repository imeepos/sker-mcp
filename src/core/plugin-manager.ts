/**
 * Enhanced Plugin Manager Implementation
 * 
 * This is a comprehensive plugin manager that integrates with the Feature Injector
 * architecture to provide secure plugin isolation, dynamic loading/unloading,
 * conflict detection, and service instance pre-binding capabilities.
 */

import { Injectable, Inject, Injector, Provider, createInjector, INJECTOR_REGISTRY } from '@sker/di';
import {
  LOGGER,
  type IPlugin,
  type IPluginManager,
  PluginStatus
} from './index.js';
import { ProjectManager } from './project-manager.js';
import {
  FeatureInjector,
  PluginDiscovery,
  PluginLoader
} from './plugins/index.js';
import { IsolationLevel } from './plugins/feature-injector.js';
import {
  PluginConflictDetector,
  PluginDiscoveryUtils,
  PluginLoaderUtils,
  PluginIsolationUtils,
  ConflictType,
  ResolutionStrategy
} from './plugins/index.js';
import type { IWinstonLogger } from './logging/winston-logger.js';
import type {
  DiscoveredPlugin,
  PluginLoadResult,
  IsolatedPluginInstance
} from './plugins/index.js';

/**
 * Enhanced Plugin Manager Implementation
 * 
 * Provides comprehensive plugin management with Feature Injector isolation,
 * dynamic discovery and loading, conflict detection, and service pre-binding.
 * Supports hot reloading, performance monitoring, and enterprise-grade security.
 */
@Injectable({ providedIn: 'application' })
export class PluginManager implements IPluginManager {
  private activePlugins: Map<string, IPlugin> = new Map();
  private pluginStatuses: Map<string, PluginStatus> = new Map();
  private isolatedInstances: Map<string, IsolatedPluginInstance> = new Map();
  private discoveredPlugins: Map<string, DiscoveredPlugin> = new Map();
  private pluginLoadResults: Map<string, PluginLoadResult> = new Map();
  private featureInjector: FeatureInjector;
  private pluginDiscovery: PluginDiscovery;
  private pluginLoader: PluginLoader;
  private conflictDetector: PluginConflictDetector;
  private isInitialized = false;

  constructor(
    @Inject(ProjectManager) private readonly projectManager: ProjectManager,
    @Inject(LOGGER) private readonly logger: IWinstonLogger,
    @Inject(INJECTOR_REGISTRY) private readonly injectorRegistry: any,
    private readonly applicationInjector?: Injector
  ) {
    // Initialize plugin system components with proper injector reference
    this.featureInjector = new FeatureInjector(
      this.injectorRegistry,
      this.applicationInjector || this.createFallbackInjector()
    );
    this.pluginDiscovery = new PluginDiscovery(this.projectManager, this.logger);
    this.pluginLoader = new PluginLoader(this.logger, this.projectManager);
    this.conflictDetector = new PluginConflictDetector(this.logger);

    this.logger.debug('PluginManager initialized with Feature Injector architecture');
  }

  /**
   * Create fallback injector when no application injector is provided
   */
  private createFallbackInjector(): Injector {
    // 🚀 使用服务化方式创建注入器
    const rootInjector = createInjector([
      { provide: LOGGER, useValue: this.logger }
    ]);
    
    return this.injectorRegistry.createApplicationInjector([
      { provide: LOGGER, useValue: this.logger }
    ]);
  }

  /**
   * Load a plugin by name with Feature Injector isolation
   * 
   * @param pluginName - The name of the plugin to load
   * @returns Promise resolving to the loaded plugin
   */
  async loadPlugin(pluginName: string): Promise<IPlugin> {
    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      this.logger.info('Loading plugin with Feature Injector', { pluginName });

      // Set status to loading
      this.pluginStatuses.set(pluginName, PluginStatus.LOADING);

      // Check if already loaded
      if (this.activePlugins.has(pluginName)) {
        throw new Error(`Plugin ${pluginName} is already loaded`);
      }

      // Discover plugin
      const discoveredPlugin = await this.pluginDiscovery.discoverPlugin(pluginName);
      if (!discoveredPlugin) {
        throw new Error(`Plugin not found: ${pluginName}`);
      }

      if (!discoveredPlugin.isValid) {
        throw new Error(`Invalid plugin: ${discoveredPlugin.validationErrors.join(', ')}`);
      }

      // Load plugin module
      const loadResult = await this.pluginLoader.loadPlugin(
        discoveredPlugin,
        PluginLoaderUtils.createDefaultOptions()
      );

      if (!loadResult.success || !loadResult.plugin) {
        throw new Error(loadResult.error || 'Failed to load plugin module');
      }

      const plugin = loadResult.plugin;

      // Detect conflicts before loading
      await this.detectAndResolveConflicts(plugin);

      // Create isolated instance with Feature Injector
      const isolationOptions = this.determineIsolationOptions(discoveredPlugin);
      const isolatedInstance = await this.featureInjector.createIsolatedPlugin(
        plugin,
        isolationOptions
      );

      // Store references
      this.activePlugins.set(pluginName, plugin);
      this.isolatedInstances.set(pluginName, isolatedInstance);
      this.discoveredPlugins.set(pluginName, discoveredPlugin);
      this.pluginLoadResults.set(pluginName, loadResult);
      this.pluginStatuses.set(pluginName, PluginStatus.LOADED);

      const duration = Date.now() - startTime;
      this.logger.info('Plugin loaded successfully with isolation', {
        pluginName,
        version: plugin.version,
        duration,
        isolationLevel: isolationOptions.isolationLevel,
        services: plugin.services?.length || 0
      });

      return plugin;

    } catch (error) {
      this.pluginStatuses.set(pluginName, PluginStatus.FAILED);
      const duration = Date.now() - startTime;

      this.logger.error('Failed to load plugin', {
        pluginName,
        error: error instanceof Error ? error.message : String(error),
        duration
      });

      throw error;
    }
  }

  /**
   * Unload a plugin by name with proper isolation cleanup
   * 
   * @param pluginName - The name of the plugin to unload
   */
  async unloadPlugin(pluginName: string): Promise<void> {
    try {
      this.logger.info('Unloading plugin with isolation cleanup', { pluginName });

      const plugin = this.activePlugins.get(pluginName);
      if (!plugin) {
        this.logger.warn('Plugin not found for unloading', { pluginName });
        return;
      }

      // Get isolated instance
      const isolatedInstance = this.isolatedInstances.get(pluginName);

      if (isolatedInstance) {
        // Destroy isolated instance (handles cleanup and onUnload hooks)
        await isolatedInstance.destroy();

        // Remove from Feature Injector
        await this.featureInjector.removeIsolatedPlugin(pluginName, plugin.version);
      } else {
        // Fallback: call onUnload hook directly
        if (plugin.hooks?.onUnload) {
          await plugin.hooks.onUnload();
        }
      }

      // Clean up all references
      this.activePlugins.delete(pluginName);
      this.isolatedInstances.delete(pluginName);
      this.discoveredPlugins.delete(pluginName);
      this.pluginLoadResults.delete(pluginName);
      this.pluginStatuses.set(pluginName, PluginStatus.UNLOADED);

      this.logger.info('Plugin unloaded successfully', { pluginName });

    } catch (error) {
      this.logger.error('Failed to unload plugin', {
        pluginName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Reload a plugin by name with hot reloading support
   * 
   * @param pluginName - The name of the plugin to reload
   * @returns Promise resolving to the reloaded plugin
   */
  async reloadPlugin(pluginName: string): Promise<IPlugin> {
    const startTime = Date.now();

    this.logger.info('Reloading plugin with hot reload', { pluginName });

    try {
      // Unload if currently loaded
      if (this.activePlugins.has(pluginName)) {
        await this.unloadPlugin(pluginName);
      }

      // Clear loader cache for hot reloading
      this.pluginLoader.clearCache();

      // Load again
      const plugin = await this.loadPlugin(pluginName);

      const duration = Date.now() - startTime;
      this.logger.info('Plugin reloaded successfully', {
        pluginName,
        version: plugin.version,
        duration
      });

      return plugin;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to reload plugin', {
        pluginName,
        error: error instanceof Error ? error.message : String(error),
        duration
      });
      throw error;
    }
  }

  /**
   * Get all active plugins
   * 
   * @returns Array of active plugins
   */
  getActivePlugins(): IPlugin[] {
    return Array.from(this.activePlugins.values());
  }

  /**
   * Get plugin status
   * 
   * @param pluginName - The name of the plugin
   * @returns The status of the plugin
   */
  getPluginStatus(pluginName: string): PluginStatus {
    return this.pluginStatuses.get(pluginName) || PluginStatus.UNLOADED;
  }

  /**
   * Check if a plugin is loaded
   * 
   * @param pluginName - The name of the plugin
   * @returns True if the plugin is loaded
   */
  isPluginLoaded(pluginName: string): boolean {
    return this.activePlugins.has(pluginName) &&
      this.getPluginStatus(pluginName) === PluginStatus.LOADED;
  }

  /**
   * Get comprehensive plugin information with isolation details
   * 
   * @returns Enhanced plugin information summary
   */
  getPluginInfo(): {
    total: number;
    loaded: number;
    failed: number;
    activePlugins: string[];
    pluginStatuses: Record<string, PluginStatus>;
    isolationStats: any;
    performanceMetrics: {
      averageLoadTime: number;
      totalLoadTime: number;
      slowestPlugin: string | null;
    };
  } {
    const activePluginNames = Array.from(this.activePlugins.keys());
    const statusEntries = Array.from(this.pluginStatuses.entries());

    const loaded = statusEntries.filter(([_, status]) => status === PluginStatus.LOADED).length;
    const failed = statusEntries.filter(([_, status]) => status === PluginStatus.FAILED).length;

    // Calculate performance metrics
    const loadResults = Array.from(this.pluginLoadResults.values());
    const loadTimes = loadResults.map(r => r.metrics.loadTime);
    const totalLoadTime = loadTimes.reduce((sum, time) => sum + time, 0);
    const averageLoadTime = loadTimes.length > 0 ? totalLoadTime / loadTimes.length : 0;

    let slowestPlugin: string | null = null;
    let maxLoadTime = 0;
    for (const [pluginName, result] of this.pluginLoadResults.entries()) {
      if (result.metrics.loadTime > maxLoadTime) {
        maxLoadTime = result.metrics.loadTime;
        slowestPlugin = pluginName;
      }
    }

    return {
      total: statusEntries.length,
      loaded,
      failed,
      activePlugins: activePluginNames,
      pluginStatuses: Object.fromEntries(statusEntries),
      isolationStats: this.featureInjector.getIsolationStats(),
      performanceMetrics: {
        averageLoadTime,
        totalLoadTime,
        slowestPlugin
      }
    };
  }

  /**
   * Initialize the plugin manager with Feature Injector architecture
   * This method can be called during application startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('PluginManager is already initialized');
      return;
    }

    const startTime = Date.now();
    this.logger.info('Initializing PluginManager with Feature Injector architecture');

    try {
      // Ensure plugin directory exists
      await this.projectManager.ensureDirectoryExists(
        this.projectManager.getPluginsDirectory()
      );

      // Configure conflict detector with default rules
      this.conflictDetector.configure({
        enabled: true,
        strategies: Object.values(ConflictType),
        defaultResolution: ResolutionStrategy.MANUAL,
        pluginPriorities: []
      });

      // Discover existing plugins
      const discoveryOptions = PluginDiscoveryUtils.createDefaultOptions();
      const discoveredPlugins = await this.pluginDiscovery.discoverPlugins(discoveryOptions);

      this.logger.info('Plugin discovery completed during initialization', {
        totalPlugins: discoveredPlugins.length,
        validPlugins: discoveredPlugins.filter(p => p.isValid).length
      });

      // Store discovered plugins
      for (const plugin of discoveredPlugins) {
        this.discoveredPlugins.set(plugin.name, plugin);
        this.pluginStatuses.set(plugin.name, PluginStatus.UNLOADED);
      }

      const duration = Date.now() - startTime;
      this.isInitialized = true;

      this.logger.info('PluginManager initialized successfully', {
        pluginsDirectory: this.projectManager.getPluginsDirectory(),
        discoveredPlugins: discoveredPlugins.length,
        duration
      });

    } catch (error) {
      this.logger.error('Failed to initialize PluginManager', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Cleanup the plugin manager with Feature Injector cleanup
   * This method should be called during application shutdown
   */
  async cleanup(): Promise<void> {
    const startTime = Date.now();
    this.logger.info('Cleaning up PluginManager with Feature Injector');

    try {
      // Unload all active plugins
      const pluginNames = Array.from(this.activePlugins.keys());

      for (const pluginName of pluginNames) {
        try {
          await this.unloadPlugin(pluginName);
        } catch (error) {
          this.logger.error('Error unloading plugin during cleanup', {
            pluginName,
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue with other plugins even if one fails
        }
      }

      // Cleanup Feature Injector
      await this.featureInjector.cleanup();

      // Clear loader cache
      this.pluginLoader.clearCache();

      // Reset state
      this.activePlugins.clear();
      this.isolatedInstances.clear();
      this.discoveredPlugins.clear();
      this.pluginLoadResults.clear();
      this.pluginStatuses.clear();
      this.isInitialized = false;

      const duration = Date.now() - startTime;
      this.logger.info('PluginManager cleanup completed', { duration });

    } catch (error) {
      this.logger.error('Error during PluginManager cleanup', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Load multiple plugins with batch processing
   */
  async loadPlugins(pluginNames: string[]): Promise<{
    successful: IPlugin[];
    failed: { name: string; error: string }[];
    summary: { total: number; loaded: number; failed: number; duration: number };
  }> {
    const startTime = Date.now();
    this.logger.info('Loading multiple plugins', { pluginNames, count: pluginNames.length });

    const successful: IPlugin[] = [];
    const failed: { name: string; error: string }[] = [];

    for (const pluginName of pluginNames) {
      try {
        const plugin = await this.loadPlugin(pluginName);
        successful.push(plugin);
      } catch (error) {
        failed.push({
          name: pluginName,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const duration = Date.now() - startTime;
    const summary = {
      total: pluginNames.length,
      loaded: successful.length,
      failed: failed.length,
      duration
    };

    this.logger.info('Batch plugin loading completed', summary);

    return { successful, failed, summary };
  }

  /**
   * Discover all available plugins without loading them
   */
  async discoverAllPlugins(): Promise<DiscoveredPlugin[]> {
    await this.ensureInitialized();

    const options = PluginDiscoveryUtils.createDefaultOptions();
    const discovered = await this.pluginDiscovery.discoverPlugins(options);

    // Update local cache
    for (const plugin of discovered) {
      this.discoveredPlugins.set(plugin.name, plugin);
      if (!this.pluginStatuses.has(plugin.name)) {
        this.pluginStatuses.set(plugin.name, PluginStatus.UNLOADED);
      }
    }

    return discovered;
  }

  /**
   * Get isolated plugin instance
   */
  getIsolatedPlugin(pluginName: string): IsolatedPluginInstance | null {
    return this.isolatedInstances.get(pluginName) || null;
  }

  /**
   * Get plugin discovery statistics
   */
  async getDiscoveryStats(): Promise<any> {
    await this.ensureInitialized();
    return this.pluginDiscovery.getDiscoveryStats();
  }

  /**
   * Get plugin loading performance metrics
   */
  getPerformanceMetrics(): {
    loaderStats: any;
    isolationStats: any;
    pluginMetrics: Array<{
      name: string;
      loadTime: number;
      moduleSize?: number;
      dependencyCount?: number;
    }>;
  } {
    const pluginMetrics = Array.from(this.pluginLoadResults.entries()).map(([name, result]) => ({
      name,
      loadTime: result.metrics.loadTime,
      moduleSize: result.metrics.moduleSize,
      dependencyCount: result.metrics.dependencyCount
    }));

    return {
      loaderStats: this.pluginLoader.getLoadingStats(),
      isolationStats: this.featureInjector.getIsolationStats(),
      pluginMetrics
    };
  }

  /**
   * Validate plugin compatibility
   */
  async validatePluginCompatibility(pluginName: string): Promise<{
    isCompatible: boolean;
    issues: string[];
  }> {
    await this.ensureInitialized();

    const discovered = this.discoveredPlugins.get(pluginName);
    if (!discovered) {
      return {
        isCompatible: false,
        issues: ['Plugin not found']
      };
    }

    return this.pluginDiscovery.validatePluginCompatibility(discovered);
  }

  /**
   * Enable or disable a loaded plugin
   */
  async togglePlugin(pluginName: string, enabled: boolean): Promise<void> {
    const plugin = this.activePlugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} is not loaded`);
    }

    const isolatedInstance = this.isolatedInstances.get(pluginName);
    if (!isolatedInstance) {
      throw new Error(`Isolated instance not found for plugin ${pluginName}`);
    }

    if (enabled) {
      if (plugin.hooks?.onEnable) {
        await plugin.hooks.onEnable();
      }
      this.logger.info('Plugin enabled', { pluginName });
    } else {
      if (plugin.hooks?.onDisable) {
        await plugin.hooks.onDisable();
      }
      this.logger.info('Plugin disabled', { pluginName });
    }
  }

  // Private helper methods

  /**
   * Ensure the plugin manager is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Detect and resolve plugin conflicts
   */
  private async detectAndResolveConflicts(plugin: IPlugin): Promise<void> {
    const existingPlugins = Array.from(this.activePlugins.values());
    const allPlugins = [...existingPlugins, plugin];
    const conflicts = this.conflictDetector.detectConflicts(allPlugins);

    if (conflicts.length > 0) {
      this.logger.warn('Plugin conflicts detected', {
        plugin: plugin.name,
        conflicts: conflicts.map((c: any) => ({ type: c.type, severity: c.severity }))
      });

      // For now, log conflicts but don't block loading
      // In production, you might want to resolve or block based on severity
      for (const conflict of conflicts) {
        if (conflict.severity === 'critical') {
          throw new Error(`Critical conflict detected: ${conflict.description}`);
        }
      }
    }
  }

  /**
   * Determine isolation options for a plugin
   */
  private determineIsolationOptions(discoveredPlugin: DiscoveredPlugin): any {
    const metadata = discoveredPlugin.metadata;
    const mcpConfig = metadata.mcp;

    // Determine isolation level
    let isolationLevel = IsolationLevel.SERVICE; // Default
    if (mcpConfig?.isolationLevel) {
      switch (mcpConfig.isolationLevel) {
        case 'none':
          isolationLevel = IsolationLevel.NONE;
          break;
        case 'service':
          isolationLevel = IsolationLevel.SERVICE;
          break;
        case 'full':
          isolationLevel = IsolationLevel.FULL;
          break;
      }
    }

    // Determine permissions based on plugin metadata
    const permissions = PluginIsolationUtils.createPermissions('trusted'); // Default to trusted
    if (mcpConfig?.permissions) {
      Object.assign(permissions, mcpConfig.permissions);
    }

    return {
      isolationLevel,
      permissions
    };
  }
}