/**
 * Plugin Loader System
 * 
 * This module provides dynamic plugin loading capabilities with support for
 * ES modules, CommonJS modules, and various plugin architectures. It handles
 * module import, validation, and instantiation with proper error handling.
 */

import { pathToFileURL } from 'url';
import { join } from 'path';
import { Injectable, Inject } from '@sker/di';
import { LOGGER, PROJECT_MANAGER } from '../tokens.js';
import type { IWinstonLogger } from '../logging/winston-logger.js';
import type { ProjectManager } from '../project-manager.js';
import type { IPlugin } from '../types.js';
import type { DiscoveredPlugin } from './plugin-discovery.js';

/**
 * Plugin loading result
 */
export interface PluginLoadResult {
  /** Whether the plugin was loaded successfully */
  success: boolean;
  /** Loaded plugin instance */
  plugin?: IPlugin;
  /** Error message if loading failed */
  error?: string;
  /** Detailed error information */
  errorDetails?: any;
  /** Loading performance metrics */
  metrics: {
    loadTime: number;
    moduleSize?: number;
    dependencyCount?: number;
  };
}

/**
 * Plugin loader options
 */
export interface PluginLoaderOptions {
  /** Validate plugin exports */
  validateExports?: boolean;
  /** Timeout for loading operation */
  timeout?: number;
  /** Enable performance metrics collection */
  collectMetrics?: boolean;
  /** Custom module resolution paths */
  modulePaths?: string[];
  /** Environment variables to set during loading */
  env?: Record<string, string>;
}

/**
 * Plugin export validation interface
 */
export interface PluginExports {
  /** Default export (plugin definition or factory) */
  default?: any;
  /** Named exports */
  [key: string]: any;
  /** Plugin metadata */
  metadata?: {
    name: string;
    version: string;
    description?: string;
  };
  /** Plugin factory function */
  createPlugin?: () => IPlugin | Promise<IPlugin>;
  /** Plugin class constructor */
  Plugin?: new (...args: any[]) => IPlugin;
}

/**
 * Module cache entry
 */
interface ModuleCacheEntry {
  exports: PluginExports;
  loadedAt: Date;
  path: string;
  size: number;
}

/**
 * Plugin Loader Implementation
 * 
 * Provides comprehensive plugin loading capabilities with support for:
 * - Dynamic ES module imports
 * - CommonJS module compatibility
 * - Plugin export validation
 * - Module caching and hot reloading
 * - Performance metrics collection
 * - Error handling and recovery
 */
@Injectable()
export class PluginLoader {
  private readonly moduleCache = new Map<string, ModuleCacheEntry>();
  private readonly loadingPlugins = new Set<string>();

  constructor(
    @Inject(LOGGER) private readonly logger: IWinstonLogger,
    @Inject(PROJECT_MANAGER) private readonly projectManager: ProjectManager
  ) {}

  /**
   * Load a plugin from discovered plugin information
   */
  async loadPlugin(
    discoveredPlugin: DiscoveredPlugin,
    options: PluginLoaderOptions = {}
  ): Promise<PluginLoadResult> {
    const startTime = Date.now();
    const pluginKey = `${discoveredPlugin.name}@${discoveredPlugin.version}`;

    this.logger.debug('Starting plugin load', {
      plugin: discoveredPlugin.name,
      version: discoveredPlugin.version,
      path: discoveredPlugin.path
    });

    // Check if plugin is already being loaded
    if (this.loadingPlugins.has(pluginKey)) {
      return {
        success: false,
        error: `Plugin ${pluginKey} is already being loaded`,
        metrics: { loadTime: Date.now() - startTime }
      };
    }

    // Mark as loading
    this.loadingPlugins.add(pluginKey);

    try {
      // Validate discovered plugin
      if (!discoveredPlugin.isValid) {
        throw new Error(`Invalid plugin: ${discoveredPlugin.validationErrors.join(', ')}`);
      }

      // Load plugin module
      const moduleResult = await this.loadPluginModule(discoveredPlugin, options);
      if (!moduleResult.success || !moduleResult.exports) {
        throw new Error(moduleResult.error || 'Failed to load plugin module');
      }

      // Create plugin instance
      const plugin = await this.createPluginInstance(
        discoveredPlugin,
        moduleResult.exports,
        options
      );

      // Validate plugin instance
      const validationResult = this.validatePluginInstance(plugin);
      if (!validationResult.valid) {
        throw new Error(`Plugin validation failed: ${validationResult.errors.join(', ')}`);
      }

      const loadTime = Date.now() - startTime;
      
      this.logger.info('Plugin loaded successfully', {
        plugin: plugin.name,
        version: plugin.version,
        loadTime,
        services: plugin.services?.length || 0
      });

      return {
        success: true,
        plugin,
        metrics: {
          loadTime,
          moduleSize: moduleResult.size,
          dependencyCount: plugin.dependencies?.length || 0
        }
      };

    } catch (error) {
      const loadTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error('Plugin loading failed', {
        plugin: discoveredPlugin.name,
        error: errorMessage,
        loadTime
      });

      return {
        success: false,
        error: errorMessage,
        errorDetails: error,
        metrics: { loadTime }
      };

    } finally {
      this.loadingPlugins.delete(pluginKey);
    }
  }

  /**
   * Load multiple plugins in parallel
   */
  async loadPlugins(
    discoveredPlugins: DiscoveredPlugin[],
    options: PluginLoaderOptions = {}
  ): Promise<PluginLoadResult[]> {
    this.logger.info('Loading multiple plugins', {
      count: discoveredPlugins.length,
      plugins: discoveredPlugins.map(p => `${p.name}@${p.version}`)
    });

    const startTime = Date.now();

    // Load plugins in parallel with controlled concurrency
    const concurrency = 5; // Limit concurrent loads
    const results: PluginLoadResult[] = [];
    
    for (let i = 0; i < discoveredPlugins.length; i += concurrency) {
      const batch = discoveredPlugins.slice(i, i + concurrency);
      const batchPromises = batch.map(plugin => this.loadPlugin(plugin, options));
      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: result.reason?.message || 'Unknown loading error',
            errorDetails: result.reason,
            metrics: { loadTime: 0 }
          });
        }
      }
    }

    const totalTime = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;

    this.logger.info('Batch plugin loading completed', {
      total: discoveredPlugins.length,
      successful: successCount,
      failed: discoveredPlugins.length - successCount,
      totalTime
    });

    return results;
  }

  /**
   * Reload a plugin with hot reloading support
   */
  async reloadPlugin(
    discoveredPlugin: DiscoveredPlugin,
    options: PluginLoaderOptions = {}
  ): Promise<PluginLoadResult> {
    const pluginKey = `${discoveredPlugin.name}@${discoveredPlugin.version}`;
    
    this.logger.debug('Reloading plugin', { plugin: pluginKey });

    // Clear module from cache
    this.clearModuleFromCache(discoveredPlugin.entryPoint);

    // Load the plugin again
    return this.loadPlugin(discoveredPlugin, { ...options, validateExports: true });
  }

  /**
   * Get loading statistics
   */
  getLoadingStats(): {
    cacheSize: number;
    loadingCount: number;
    cachedModules: string[];
    memoryUsage: {
      totalSize: number;
      averageSize: number;
    };
  } {
    const cachedModules = Array.from(this.moduleCache.keys());
    const totalSize = Array.from(this.moduleCache.values())
      .reduce((sum, entry) => sum + entry.size, 0);

    return {
      cacheSize: this.moduleCache.size,
      loadingCount: this.loadingPlugins.size,
      cachedModules,
      memoryUsage: {
        totalSize,
        averageSize: this.moduleCache.size > 0 ? totalSize / this.moduleCache.size : 0
      }
    };
  }

  /**
   * Clear all cached modules
   */
  clearCache(): void {
    this.logger.debug('Clearing plugin module cache', {
      cachedCount: this.moduleCache.size
    });
    
    this.moduleCache.clear();
  }

  /**
   * Load plugin module from file system
   */
  private async loadPluginModule(
    discoveredPlugin: DiscoveredPlugin,
    options: PluginLoaderOptions
  ): Promise<{
    success: boolean;
    exports?: PluginExports;
    error?: string;
    size?: number;
  }> {
    const entryPath = discoveredPlugin.entryPoint;
    
    try {
      // Check cache first
      const cached = this.moduleCache.get(entryPath);
      if (cached) {
        this.logger.debug('Using cached module', { path: entryPath });
        return {
          success: true,
          exports: cached.exports,
          size: cached.size
        };
      }

      // Prepare module loading
      const timeout = options.timeout || 30000; // 30 second timeout
      const loadPromise = this.importModule(entryPath, discoveredPlugin);

      // Load with timeout
      const exports = await Promise.race([
        loadPromise,
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Module loading timeout')), timeout)
        )
      ]);

      // Estimate module size (simplified)
      const size = JSON.stringify(exports).length;

      // Cache the loaded module
      this.moduleCache.set(entryPath, {
        exports,
        loadedAt: new Date(),
        path: entryPath,
        size
      });

      // Validate exports if requested
      if (options.validateExports) {
        const validation = this.validatePluginExports(exports);
        if (!validation.valid) {
          return {
            success: false,
            error: `Invalid plugin exports: ${validation.errors.join(', ')}`
          };
        }
      }

      return {
        success: true,
        exports,
        size
      };

    } catch (error) {
      this.logger.error('Failed to load plugin module', {
        path: entryPath,
        plugin: discoveredPlugin.name,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown module loading error'
      };
    }
  }

  /**
   * Import module with proper ES/CommonJS handling
   */
  private async importModule(entryPath: string, discoveredPlugin: DiscoveredPlugin): Promise<PluginExports> {
    try {
      // Convert to file URL for ES module imports
      const fileUrl = pathToFileURL(entryPath).href;
      
      this.logger.debug('Importing module', {
        path: entryPath,
        fileUrl,
        type: discoveredPlugin.metadata.type || 'unknown'
      });

      // Dynamic import (works for both ES modules and CommonJS)
      const importedModule = await import(fileUrl);

      // Handle different export patterns
      if (importedModule.default) {
        return importedModule as PluginExports;
      } else if (Object.keys(importedModule).length > 0) {
        return importedModule as PluginExports;
      } else {
        throw new Error('Module has no valid exports');
      }

    } catch (error) {
      // If dynamic import fails, try alternative methods
      this.logger.debug('Dynamic import failed, trying alternative methods', {
        path: entryPath,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error; // Re-throw for now, could implement fallback mechanisms
    }
  }

  /**
   * Create plugin instance from module exports
   */
  private async createPluginInstance(
    discoveredPlugin: DiscoveredPlugin,
    exports: PluginExports,
    options: PluginLoaderOptions
  ): Promise<IPlugin> {
    this.logger.debug('Creating plugin instance', {
      plugin: discoveredPlugin.name,
      hasDefault: !!exports.default,
      hasCreatePlugin: !!exports.createPlugin,
      hasPluginClass: !!exports.Plugin
    });

    try {
      // Try different plugin instantiation patterns

      // Pattern 1: Factory function
      if (typeof exports.createPlugin === 'function') {
        const plugin = await exports.createPlugin();
        return this.enrichPluginInstance(plugin, discoveredPlugin);
      }

      // Pattern 2: Plugin class constructor
      if (typeof exports.Plugin === 'function') {
        const plugin = new exports.Plugin();
        return this.enrichPluginInstance(plugin, discoveredPlugin);
      }

      // Pattern 3: Default export as plugin instance
      if (exports.default && typeof exports.default === 'object') {
        return this.enrichPluginInstance(exports.default, discoveredPlugin);
      }

      // Pattern 4: Default export as factory function
      if (typeof exports.default === 'function') {
        const plugin = await exports.default();
        return this.enrichPluginInstance(plugin, discoveredPlugin);
      }

      // Pattern 5: Direct export as plugin
      if (exports.name && exports.version) {
        return this.enrichPluginInstance(exports as IPlugin, discoveredPlugin);
      }

      throw new Error('No valid plugin instantiation pattern found');

    } catch (error) {
      throw new Error(`Failed to create plugin instance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Enrich plugin instance with metadata from discovery
   */
  private enrichPluginInstance(plugin: any, discoveredPlugin: DiscoveredPlugin): IPlugin {
    // Ensure plugin has required properties
    const enriched: IPlugin = {
      name: plugin.name || discoveredPlugin.name,
      version: plugin.version || discoveredPlugin.version,
      description: plugin.description || discoveredPlugin.metadata.description || '',
      author: plugin.author || discoveredPlugin.metadata.author,
      dependencies: plugin.dependencies || [],
      services: plugin.services || [],
      configSchema: plugin.configSchema,
      hooks: plugin.hooks || {}
    };

    // Add path information
    (enriched as any).__pluginPath = discoveredPlugin.path;
    (enriched as any).__entryPoint = discoveredPlugin.entryPoint;

    return enriched;
  }

  /**
   * Validate plugin exports structure
   */
  private validatePluginExports(exports: PluginExports): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for at least one valid export pattern
    const hasFactory = typeof exports.createPlugin === 'function';
    const hasClass = typeof exports.Plugin === 'function';
    const hasDefault = !!exports.default;
    const hasDirectExport = !!(exports.name && exports.version);

    if (!hasFactory && !hasClass && !hasDefault && !hasDirectExport) {
      errors.push('No valid plugin export pattern found');
    }

    // Validate metadata if present
    if (exports.metadata) {
      if (!exports.metadata.name) {
        errors.push('Plugin metadata missing name');
      }
      if (!exports.metadata.version) {
        errors.push('Plugin metadata missing version');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate plugin instance structure
   */
  private validatePluginInstance(plugin: IPlugin): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Required properties
    if (!plugin.name || typeof plugin.name !== 'string') {
      errors.push('Plugin name is required and must be a string');
    }

    if (!plugin.version || typeof plugin.version !== 'string') {
      errors.push('Plugin version is required and must be a string');
    }

    if (!plugin.description || typeof plugin.description !== 'string') {
      errors.push('Plugin description is required and must be a string');
    }

    // Optional but typed properties
    if (plugin.dependencies && !Array.isArray(plugin.dependencies)) {
      errors.push('Plugin dependencies must be an array');
    }

    if (plugin.services && !Array.isArray(plugin.services)) {
      errors.push('Plugin services must be an array');
    }

    // Validate hooks structure
    if (plugin.hooks) {
      const validHooks = ['onLoad', 'onUnload', 'onEnable', 'onDisable'];
      for (const [hookName, hookFunc] of Object.entries(plugin.hooks)) {
        if (!validHooks.includes(hookName)) {
          errors.push(`Unknown hook: ${hookName}`);
        }
        if (typeof hookFunc !== 'function') {
          errors.push(`Hook ${hookName} must be a function`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Clear specific module from cache
   */
  private clearModuleFromCache(modulePath: string): void {
    if (this.moduleCache.has(modulePath)) {
      this.moduleCache.delete(modulePath);
      this.logger.debug('Cleared module from cache', { path: modulePath });
    }
  }
}

/**
 * Plugin loader utilities
 */
export class PluginLoaderUtils {
  /**
   * Create default loader options
   */
  static createDefaultOptions(): PluginLoaderOptions {
    return {
      validateExports: true,
      timeout: 30000,
      collectMetrics: true
    };
  }

  /**
   * Create development loader options
   */
  static createDevelopmentOptions(): PluginLoaderOptions {
    return {
      validateExports: true,
      timeout: 60000, // Longer timeout for development
      collectMetrics: true
    };
  }

  /**
   * Create production loader options
   */
  static createProductionOptions(): PluginLoaderOptions {
    return {
      validateExports: true,
      timeout: 15000, // Shorter timeout for production
      collectMetrics: false // Disable metrics collection
    };
  }

  /**
   * Estimate plugin complexity based on exports
   */
  static estimatePluginComplexity(exports: PluginExports): {
    complexity: 'simple' | 'medium' | 'complex';
    factors: string[];
  } {
    const factors: string[] = [];
    let score = 0;

    // Check export patterns
    if (exports.default) {
      factors.push('default export');
      score += 1;
    }

    if (exports.createPlugin) {
      factors.push('factory function');
      score += 2;
    }

    if (exports.Plugin) {
      factors.push('plugin class');
      score += 2;
    }

    // Check metadata complexity
    if (exports.metadata) {
      factors.push('metadata');
      score += 1;
    }

    // Estimate based on export count
    const exportCount = Object.keys(exports).length;
    if (exportCount > 10) {
      factors.push('many exports');
      score += 3;
    } else if (exportCount > 5) {
      factors.push('several exports');
      score += 1;
    }

    let complexity: 'simple' | 'medium' | 'complex';
    if (score <= 2) {
      complexity = 'simple';
    } else if (score <= 5) {
      complexity = 'medium';
    } else {
      complexity = 'complex';
    }

    return { complexity, factors };
  }
}