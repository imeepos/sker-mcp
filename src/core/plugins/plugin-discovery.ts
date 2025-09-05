/**
 * Plugin Discovery System
 * 
 * This module provides automatic plugin discovery and validation capabilities,
 * scanning plugin directories for valid plugin packages and performing
 * metadata validation according to the MCP server architecture.
 */

import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { Injectable, Inject } from '@sker/di';
import { z } from 'zod';
import { PROJECT_MANAGER, LOGGER } from '../tokens.js';
import type { ProjectManager } from '../project-manager.js';
import type { IWinstonLogger } from '../logging/winston-logger.js';

/**
 * Plugin package.json metadata schema
 */
export const PluginPackageSchema = z.object({
  name: z.string().min(1, 'Plugin name is required'),
  version: z.string().min(1, 'Plugin version is required'),
  description: z.string().optional(),
  author: z.union([
    z.string(),
    z.object({
      name: z.string(),
      email: z.string().optional(),
      url: z.string().optional()
    })
  ]).optional(),
  main: z.string().default('index.js'),
  type: z.enum(['module', 'commonjs']).optional(),
  keywords: z.array(z.string()).optional(),
  dependencies: z.record(z.string()).optional(),
  peerDependencies: z.record(z.string()).optional(),
  // MCP-specific metadata
  mcp: z.object({
    // Plugin type classification
    type: z.enum(['tool', 'resource', 'prompt', 'hybrid']).optional(),
    // Plugin category
    category: z.string().optional(),
    // Required permissions
    permissions: z.object({
      parentServices: z.boolean().default(false),
      globalRegistration: z.boolean().default(false),
      crossPluginAccess: z.boolean().default(false),
      coreSystemAccess: z.boolean().default(false)
    }).optional(),
    // Plugin isolation level preference
    isolationLevel: z.enum(['none', 'service', 'full']).default('service'),
    // Plugin compatibility
    compatibility: z.object({
      mcpVersion: z.string().optional(),
      nodeVersion: z.string().optional(),
      platform: z.array(z.enum(['win32', 'darwin', 'linux', 'freebsd', 'openbsd'])).optional()
    }).optional()
  }).optional()
});

export type PluginPackageMetadata = z.infer<typeof PluginPackageSchema>;

/**
 * Discovered plugin information
 */
export interface DiscoveredPlugin {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Absolute path to plugin directory */
  path: string;
  /** Plugin package.json metadata */
  metadata: PluginPackageMetadata;
  /** Entry point file path */
  entryPoint: string;
  /** Validation status */
  isValid: boolean;
  /** Validation errors if any */
  validationErrors: string[];
  /** File system statistics */
  stats: {
    size: number;
    created: Date;
    modified: Date;
  };
}

/**
 * Plugin discovery options
 */
export interface PluginDiscoveryOptions {
  /** Include subdirectories in scan */
  recursive?: boolean;
  /** Maximum recursion depth */
  maxDepth?: number;
  /** Skip invalid plugins */
  skipInvalid?: boolean;
  /** Plugin name patterns to include */
  include?: string[];
  /** Plugin name patterns to exclude */
  exclude?: string[];
  /** Validate plugin compatibility */
  validateCompatibility?: boolean;
}

/**
 * Plugin Discovery Service
 * 
 * Provides comprehensive plugin discovery capabilities including directory
 * scanning, metadata validation, and plugin compatibility checking.
 */
@Injectable()
export class PluginDiscovery {
  constructor(
    @Inject(PROJECT_MANAGER) private readonly projectManager: ProjectManager,
    @Inject(LOGGER) private readonly logger: IWinstonLogger
  ) {}

  /**
   * Discover all plugins in the plugins directory
   */
  async discoverPlugins(options: PluginDiscoveryOptions = {}): Promise<DiscoveredPlugin[]> {
    const startTime = Date.now();
    this.logger.info('Starting plugin discovery', { options });

    try {
      const pluginsDirectory = this.projectManager.getPluginsDirectory();
      
      // Ensure plugins directory exists
      await this.projectManager.ensureDirectoryExists(pluginsDirectory);

      // Scan for plugins
      const discoveredPlugins = await this.scanDirectory(pluginsDirectory, options);

      // Filter plugins based on options
      const filteredPlugins = this.filterPlugins(discoveredPlugins, options);

      // Sort by name for consistent ordering
      const sortedPlugins = filteredPlugins.sort((a, b) => a.name.localeCompare(b.name));

      const duration = Date.now() - startTime;
      this.logger.info('Plugin discovery completed', {
        totalDiscovered: sortedPlugins.length,
        validPlugins: sortedPlugins.filter(p => p.isValid).length,
        invalidPlugins: sortedPlugins.filter(p => !p.isValid).length,
        duration
      });

      return sortedPlugins;

    } catch (error) {
      this.logger.error('Plugin discovery failed', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Discover a specific plugin by name
   */
  async discoverPlugin(pluginName: string): Promise<DiscoveredPlugin | null> {
    this.logger.debug('Discovering specific plugin', { pluginName });

    try {
      const pluginsDirectory = this.projectManager.getPluginsDirectory();
      const pluginPath = join(pluginsDirectory, pluginName);

      // Check if plugin directory exists
      const exists = await this.directoryExists(pluginPath);
      if (!exists) {
        this.logger.debug('Plugin directory not found', { pluginName, pluginPath });
        return null;
      }

      // Discover the plugin
      const plugin = await this.discoverSinglePlugin(pluginPath);
      
      if (plugin) {
        this.logger.debug('Plugin discovered successfully', { 
          pluginName, 
          version: plugin.version,
          isValid: plugin.isValid 
        });
      }

      return plugin;

    } catch (error) {
      this.logger.error('Failed to discover specific plugin', {
        pluginName,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Validate plugin compatibility with current system
   */
  async validatePluginCompatibility(plugin: DiscoveredPlugin): Promise<{
    isCompatible: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const compatibility = plugin.metadata.mcp?.compatibility;
      
      if (compatibility) {
        // Check Node.js version compatibility
        if (compatibility.nodeVersion) {
          const currentNodeVersion = process.version;
          // Simple version check - in production, use semver for proper comparison
          if (!this.isVersionCompatible(currentNodeVersion, compatibility.nodeVersion)) {
            issues.push(`Node.js version incompatible. Required: ${compatibility.nodeVersion}, Current: ${currentNodeVersion}`);
          }
        }

        // Check platform compatibility
        if (compatibility.platform) {
          const currentPlatform = process.platform as any;
          if (!compatibility.platform.includes(currentPlatform)) {
            issues.push(`Platform incompatible. Required: ${compatibility.platform.join(', ')}, Current: ${currentPlatform}`);
          }
        }

        // Check MCP version compatibility
        if (compatibility.mcpVersion) {
          // This would check against the current MCP SDK version
          // For now, just log the requirement
          this.logger.debug('MCP version requirement noted', {
            plugin: plugin.name,
            required: compatibility.mcpVersion
          });
        }
      }

      return {
        isCompatible: issues.length === 0,
        issues
      };

    } catch (error) {
      this.logger.error('Failed to validate plugin compatibility', {
        plugin: plugin.name,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        isCompatible: false,
        issues: ['Failed to validate compatibility']
      };
    }
  }

  /**
   * Get plugin discovery statistics
   */
  async getDiscoveryStats(): Promise<{
    totalPlugins: number;
    validPlugins: number;
    invalidPlugins: number;
    pluginsByCategory: Record<string, number>;
    pluginsByType: Record<string, number>;
  }> {
    try {
      const plugins = await this.discoverPlugins();
      
      const stats = {
        totalPlugins: plugins.length,
        validPlugins: plugins.filter(p => p.isValid).length,
        invalidPlugins: plugins.filter(p => !p.isValid).length,
        pluginsByCategory: {} as Record<string, number>,
        pluginsByType: {} as Record<string, number>
      };

      // Group by category and type
      for (const plugin of plugins) {
        if (plugin.isValid && plugin.metadata.mcp) {
          const category = plugin.metadata.mcp.category || 'uncategorized';
          const type = plugin.metadata.mcp.type || 'unknown';

          stats.pluginsByCategory[category] = (stats.pluginsByCategory[category] || 0) + 1;
          stats.pluginsByType[type] = (stats.pluginsByType[type] || 0) + 1;
        }
      }

      return stats;

    } catch (error) {
      this.logger.error('Failed to get discovery stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        totalPlugins: 0,
        validPlugins: 0,
        invalidPlugins: 0,
        pluginsByCategory: {},
        pluginsByType: {}
      };
    }
  }

  /**
   * Scan directory for plugins
   */
  private async scanDirectory(
    directory: string, 
    options: PluginDiscoveryOptions,
    currentDepth: number = 0
  ): Promise<DiscoveredPlugin[]> {
    const maxDepth = options.maxDepth || 2;
    const recursive = options.recursive !== false; // Default to true

    if (currentDepth > maxDepth) {
      return [];
    }

    const plugins: DiscoveredPlugin[] = [];

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const entryPath = join(directory, entry.name);

          // Try to discover plugin in this directory
          const plugin = await this.discoverSinglePlugin(entryPath);
          if (plugin) {
            plugins.push(plugin);
          }

          // Recurse into subdirectories if enabled
          if (recursive && currentDepth < maxDepth) {
            const subPlugins = await this.scanDirectory(entryPath, options, currentDepth + 1);
            plugins.push(...subPlugins);
          }
        }
      }

    } catch (error) {
      this.logger.warn('Failed to scan directory', {
        directory,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return plugins;
  }

  /**
   * Discover a single plugin from directory
   */
  private async discoverSinglePlugin(pluginPath: string): Promise<DiscoveredPlugin | null> {
    try {
      const packageJsonPath = join(pluginPath, 'package.json');

      // Check if package.json exists
      const packageJsonExists = await this.fileExists(packageJsonPath);
      if (!packageJsonExists) {
        return null;
      }

      // Read and parse package.json
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const rawMetadata = JSON.parse(packageJsonContent);

      // Validate metadata
      const { metadata, validationErrors } = await this.validatePluginMetadata(rawMetadata);
      
      // Get file stats
      const stats = await fs.stat(pluginPath);
      
      // Determine entry point
      const entryPoint = join(pluginPath, metadata.main || 'index.js');
      const entryPointExists = await this.fileExists(entryPoint);

      if (!entryPointExists) {
        validationErrors.push(`Entry point file not found: ${metadata.main || 'index.js'}`);
      }

      const plugin: DiscoveredPlugin = {
        name: metadata.name,
        version: metadata.version,
        path: pluginPath,
        metadata,
        entryPoint,
        isValid: validationErrors.length === 0 && entryPointExists,
        validationErrors,
        stats: {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        }
      };

      return plugin;

    } catch (error) {
      this.logger.debug('Failed to discover plugin', {
        pluginPath,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Validate plugin metadata against schema
   */
  private async validatePluginMetadata(rawMetadata: any): Promise<{
    metadata: PluginPackageMetadata;
    validationErrors: string[];
  }> {
    try {
      const metadata = PluginPackageSchema.parse(rawMetadata);
      return { metadata, validationErrors: [] };

    } catch (error) {
      const validationErrors: string[] = [];
      
      if (error instanceof z.ZodError) {
        validationErrors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
      } else {
        validationErrors.push('Invalid metadata format');
      }

      // Return partial metadata for analysis
      const metadata: PluginPackageMetadata = {
        name: rawMetadata.name || 'unknown',
        version: rawMetadata.version || '0.0.0',
        description: rawMetadata.description,
        author: rawMetadata.author,
        main: rawMetadata.main || 'index.js'
      };

      return { metadata, validationErrors };
    }
  }

  /**
   * Filter plugins based on options
   */
  private filterPlugins(plugins: DiscoveredPlugin[], options: PluginDiscoveryOptions): DiscoveredPlugin[] {
    let filtered = plugins;

    // Skip invalid plugins if requested
    if (options.skipInvalid) {
      filtered = filtered.filter(p => p.isValid);
    }

    // Include patterns
    if (options.include && options.include.length > 0) {
      filtered = filtered.filter(p => 
        options.include!.some(pattern => this.matchPattern(p.name, pattern))
      );
    }

    // Exclude patterns
    if (options.exclude && options.exclude.length > 0) {
      filtered = filtered.filter(p => 
        !options.exclude!.some(pattern => this.matchPattern(p.name, pattern))
      );
    }

    return filtered;
  }

  /**
   * Simple pattern matching (supports * wildcard)
   */
  private matchPattern(name: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(name);
  }

  /**
   * Check if directory exists
   */
  private async directoryExists(path: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Simple version compatibility check
   */
  private isVersionCompatible(current: string, required: string): boolean {
    // This is a simplified version check
    // In production, use a proper semver library
    const cleanCurrent = current.replace(/^v/, '');
    const cleanRequired = required.replace(/^v/, '').replace(/[>=<~^]/, '');
    
    // For now, just check if versions match
    return cleanCurrent >= cleanRequired;
  }
}

/**
 * Plugin discovery utilities
 */
export class PluginDiscoveryUtils {
  /**
   * Create default discovery options
   */
  static createDefaultOptions(): PluginDiscoveryOptions {
    return {
      recursive: true,
      maxDepth: 2,
      skipInvalid: false,
      validateCompatibility: true
    };
  }

  /**
   * Create discovery options for development
   */
  static createDevelopmentOptions(): PluginDiscoveryOptions {
    return {
      recursive: true,
      maxDepth: 3,
      skipInvalid: false,
      validateCompatibility: false // Allow incompatible plugins during development
    };
  }

  /**
   * Create discovery options for production
   */
  static createProductionOptions(): PluginDiscoveryOptions {
    return {
      recursive: false,
      maxDepth: 1,
      skipInvalid: true,
      validateCompatibility: true
    };
  }

  /**
   * Validate plugin name format
   */
  static validatePluginName(name: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!name || typeof name !== 'string') {
      errors.push('Plugin name must be a non-empty string');
      return { isValid: false, errors };
    }

    if (name.length < 3) {
      errors.push('Plugin name must be at least 3 characters long');
    }

    if (name.length > 100) {
      errors.push('Plugin name must be no more than 100 characters long');
    }

    if (!/^[a-z0-9@][a-z0-9-_.]*$/.test(name)) {
      errors.push('Plugin name must contain only lowercase letters, numbers, hyphens, underscores, and dots');
    }

    if (name.startsWith('-') || name.startsWith('.') || name.startsWith('_')) {
      errors.push('Plugin name cannot start with a hyphen, dot, or underscore');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}