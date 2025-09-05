/**
 * Basic Plugin Manager Implementation
 * 
 * This is a basic implementation of the plugin manager to satisfy the application's
 * dependency requirements. This will be expanded in later stages with full
 * plugin discovery, loading, and feature injector capabilities.
 */

import { Injectable, Inject } from '@sker/di';
import { PROJECT_MANAGER, LOGGER } from './tokens.js';
import { ProjectManager } from './project-manager.js';
import type { IPlugin, IPluginManager } from './types.js';
import { PluginStatus } from './types.js';

/**
 * Basic Plugin Manager implementation
 * 
 * This is a minimal implementation that provides the core plugin management
 * interface required by the McpApplication. Full functionality will be
 * implemented in Stage 3 of the development roadmap.
 */
@Injectable()
export class PluginManager implements IPluginManager {
  private activePlugins: Map<string, IPlugin> = new Map();
  private pluginStatuses: Map<string, PluginStatus> = new Map();

  constructor(
    @Inject(PROJECT_MANAGER) private readonly projectManager: ProjectManager,
    @Inject(LOGGER) private readonly logger: any
  ) {
    this.logger?.debug('PluginManager initialized (basic implementation)');
  }

  /**
   * Load a plugin by name
   * 
   * @param pluginName - The name of the plugin to load
   * @returns Promise resolving to the loaded plugin
   */
  async loadPlugin(pluginName: string): Promise<IPlugin> {
    try {
      this.logger?.debug('Loading plugin (basic implementation)', { pluginName });
      
      // Set status to loading
      this.pluginStatuses.set(pluginName, PluginStatus.LOADING);

      // Check if plugin directory exists
      const pluginExists = await this.projectManager.pluginDirectoryExists(pluginName);
      if (!pluginExists) {
        throw new Error(`Plugin directory not found: ${pluginName}`);
      }

      // Check if plugin has valid package.json
      const hasValidPackageJson = await this.projectManager.hasValidPluginPackageJson(pluginName);
      if (!hasValidPackageJson) {
        throw new Error(`Plugin has invalid or missing package.json: ${pluginName}`);
      }

      // For now, create a basic plugin stub
      // In Stage 3, this will be replaced with actual plugin loading
      const plugin: IPlugin = {
        name: pluginName,
        version: '0.0.1',
        description: `Basic plugin stub for ${pluginName}`,
        author: 'unknown',
        dependencies: [],
        services: [], // No services for now
        hooks: {
          onLoad: async () => {
            this.logger?.debug(`Plugin ${pluginName} loaded (stub)`);
          },
          onUnload: async () => {
            this.logger?.debug(`Plugin ${pluginName} unloaded (stub)`);
          }
        }
      };

      // Call onLoad hook if available
      if (plugin.hooks?.onLoad) {
        await plugin.hooks.onLoad();
      }

      // Store the plugin
      this.activePlugins.set(pluginName, plugin);
      this.pluginStatuses.set(pluginName, PluginStatus.LOADED);

      this.logger?.info(`Plugin loaded successfully (basic stub)`, { 
        pluginName, 
        version: plugin.version 
      });

      return plugin;

    } catch (error) {
      this.pluginStatuses.set(pluginName, PluginStatus.FAILED);
      this.logger?.error('Failed to load plugin', { 
        pluginName, 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  /**
   * Unload a plugin by name
   * 
   * @param pluginName - The name of the plugin to unload
   */
  async unloadPlugin(pluginName: string): Promise<void> {
    try {
      this.logger?.debug('Unloading plugin', { pluginName });

      const plugin = this.activePlugins.get(pluginName);
      if (!plugin) {
        this.logger?.warn('Plugin not found for unloading', { pluginName });
        return;
      }

      // Call onUnload hook if available
      if (plugin.hooks?.onUnload) {
        await plugin.hooks.onUnload();
      }

      // Remove from active plugins
      this.activePlugins.delete(pluginName);
      this.pluginStatuses.set(pluginName, PluginStatus.UNLOADED);

      this.logger?.info('Plugin unloaded successfully', { pluginName });

    } catch (error) {
      this.logger?.error('Failed to unload plugin', { 
        pluginName, 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  /**
   * Reload a plugin by name
   * 
   * @param pluginName - The name of the plugin to reload
   * @returns Promise resolving to the reloaded plugin
   */
  async reloadPlugin(pluginName: string): Promise<IPlugin> {
    this.logger?.debug('Reloading plugin', { pluginName });

    // Unload if currently loaded
    if (this.activePlugins.has(pluginName)) {
      await this.unloadPlugin(pluginName);
    }

    // Load again
    return await this.loadPlugin(pluginName);
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
   * Get information about all plugins
   * 
   * @returns Plugin information summary
   */
  getPluginInfo(): {
    total: number;
    loaded: number;
    failed: number;
    activePlugins: string[];
    pluginStatuses: Record<string, PluginStatus>;
  } {
    const activePluginNames = Array.from(this.activePlugins.keys());
    const statusEntries = Array.from(this.pluginStatuses.entries());
    
    const loaded = statusEntries.filter(([_, status]) => status === PluginStatus.LOADED).length;
    const failed = statusEntries.filter(([_, status]) => status === PluginStatus.FAILED).length;

    return {
      total: statusEntries.length,
      loaded,
      failed,
      activePlugins: activePluginNames,
      pluginStatuses: Object.fromEntries(statusEntries)
    };
  }

  /**
   * Initialize the plugin manager
   * This method can be called during application startup
   */
  async initialize(): Promise<void> {
    this.logger?.debug('Initializing PluginManager (basic implementation)');
    
    try {
      // Ensure plugin directory exists
      await this.projectManager.ensureDirectoryExists(
        this.projectManager.getPluginsDirectory()
      );

      this.logger?.info('PluginManager initialized successfully', {
        pluginsDirectory: this.projectManager.getPluginsDirectory()
      });

    } catch (error) {
      this.logger?.error('Failed to initialize PluginManager', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Cleanup the plugin manager
   * This method should be called during application shutdown
   */
  async cleanup(): Promise<void> {
    this.logger?.debug('Cleaning up PluginManager');

    try {
      // Unload all active plugins
      const pluginNames = Array.from(this.activePlugins.keys());
      
      for (const pluginName of pluginNames) {
        try {
          await this.unloadPlugin(pluginName);
        } catch (error) {
          this.logger?.error('Error unloading plugin during cleanup', {
            pluginName,
            error: (error as Error).message
          });
          // Continue with other plugins even if one fails
        }
      }

      this.logger?.info('PluginManager cleanup completed');

    } catch (error) {
      this.logger?.error('Error during PluginManager cleanup', {
        error: (error as Error).message
      });
    }
  }
}