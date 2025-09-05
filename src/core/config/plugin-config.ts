/**
 * Plugin Configuration Management
 * 
 * This module provides specialized configuration management for plugins,
 * including plugin-specific settings, isolation configuration, and
 * plugin configuration validation and merging.
 */

import { 
  Config, 
  PluginConfig, 
  ConfigValidator,
  ConfigMerger
} from './config-schema.js';
import { ConfigManager } from './config-manager.js';
import { EnvironmentConfigProcessor } from './environment-config.js';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';

/**
 * Plugin configuration metadata
 */
export interface PluginConfigMeta {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Configuration schema version */
  schemaVersion?: string;
  /** Configuration dependencies */
  dependencies?: string[];
  /** Configuration validation rules */
  validation?: any;
  /** Default configuration */
  defaults?: any;
}

/**
 * Plugin-specific configuration
 */
export interface PluginSpecificConfig {
  /** Plugin metadata */
  meta: PluginConfigMeta;
  /** Plugin configuration data */
  config: any;
  /** Configuration source */
  source: 'default' | 'file' | 'environment' | 'runtime';
  /** Last update timestamp */
  lastUpdate: Date;
  /** Configuration validation status */
  isValid: boolean;
  /** Validation errors if any */
  validationErrors?: string[];
}

/**
 * Plugin configuration change event
 */
export interface PluginConfigChangeEvent {
  /** Plugin name */
  pluginName: string;
  /** Previous configuration */
  previous?: any;
  /** New configuration */
  current: any;
  /** Configuration changes */
  changes: string[];
  /** Change source */
  source: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Plugin isolation levels
 */
export enum PluginIsolationLevel {
  NONE = 'none',
  SERVICE = 'service',
  FULL = 'full'
}

/**
 * Plugin configuration manager
 */
export class PluginConfigManager extends EventEmitter {
  private readonly _configManager: ConfigManager;
  private readonly _pluginConfigs = new Map<string, PluginSpecificConfig>();
  private readonly _configSchemas = new Map<string, any>();
  private readonly _defaultConfigs = new Map<string, any>();
  
  constructor(configManager?: ConfigManager) {
    super();
    this._configManager = configManager || new ConfigManager();
    this.initialize();
  }
  
  /**
   * Initialize plugin configuration manager
   */
  private initialize(): void {
    // Listen for main configuration changes
    this._configManager.on('configChanged', (event) => {
      this.handleMainConfigChange(event);
    });
  }
  
  /**
   * Register plugin configuration schema
   */
  registerPluginSchema(pluginName: string, schema: any, defaults?: any): void {
    this._configSchemas.set(pluginName, schema);
    
    if (defaults) {
      this._defaultConfigs.set(pluginName, defaults);
    }
    
    // Load existing configuration for this plugin
    this.loadPluginConfig(pluginName);
  }
  
  /**
   * Get plugin configuration
   */
  getPluginConfig<T = any>(pluginName: string): T | undefined {
    const pluginConfig = this._pluginConfigs.get(pluginName);
    return pluginConfig?.config;
  }
  
  /**
   * Set plugin configuration
   */
  setPluginConfig(pluginName: string, config: any, source = 'runtime'): void {
    const previous = this.getPluginConfig(pluginName);
    
    // Validate configuration if schema is available
    const schema = this._configSchemas.get(pluginName);
    let isValid = true;
    let validationErrors: string[] = [];
    
    if (schema) {
      try {
        // Note: In a real implementation, you'd use the actual schema validation
        // For now, we'll just do basic validation
        isValid = this.validatePluginConfig(pluginName, config);
      } catch (error) {
        isValid = false;
        validationErrors = [error instanceof Error ? error.message : 'Validation failed'];
      }
    }
    
    // Create plugin configuration entry
    const pluginConfigEntry: PluginSpecificConfig = {
      meta: {
        name: pluginName,
        version: '1.0.0', // This would come from plugin metadata
        schemaVersion: '1.0.0'
      },
      config,
      source: source as any,
      lastUpdate: new Date(),
      isValid,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined
    };
    
    this._pluginConfigs.set(pluginName, pluginConfigEntry);
    
    // Update main configuration
    this.updateMainPluginConfig(pluginName, config);
    
    // Emit change event
    const changes = this.detectConfigChanges(previous, config);
    this.emit('pluginConfigChanged', {
      pluginName,
      previous,
      current: config,
      changes,
      source,
      timestamp: new Date()
    } as PluginConfigChangeEvent);
  }
  
  /**
   * Get plugin isolation level
   */
  getPluginIsolationLevel(pluginName: string): PluginIsolationLevel {
    const mainConfig = this._configManager.getConfig();
    const pluginIsolation = mainConfig.plugins.isolation.plugins[pluginName] || 
                          mainConfig.plugins.isolation.default;
    
    return pluginIsolation as PluginIsolationLevel;
  }
  
  /**
   * Set plugin isolation level
   */
  setPluginIsolationLevel(pluginName: string, level: PluginIsolationLevel): void {
    const currentConfig = this._configManager.getConfig();
    const updates = {
      plugins: {
        ...currentConfig.plugins,
        isolation: {
          ...currentConfig.plugins.isolation,
          plugins: {
            ...currentConfig.plugins.isolation.plugins,
            [pluginName]: level
          }
        }
      }
    };
    
    this._configManager.updateConfig(updates, `plugin-isolation:${pluginName}`);
  }
  
  /**
   * Load plugin configuration from file
   */
  async loadPluginConfigFromFile(pluginName: string, configPath: string): Promise<void> {
    try {
      const absolutePath = path.isAbsolute(configPath) ? configPath : path.resolve(configPath);
      
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Plugin configuration file not found: ${absolutePath}`);
      }
      
      const configData = JSON.parse(await fs.promises.readFile(absolutePath, 'utf8'));
      this.setPluginConfig(pluginName, configData, 'file');
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to load plugin configuration from ${configPath}: ${message}`);
    }
  }
  
  /**
   * Save plugin configuration to file
   */
  async savePluginConfigToFile(pluginName: string, configPath: string): Promise<void> {
    const pluginConfig = this._pluginConfigs.get(pluginName);
    
    if (!pluginConfig) {
      throw new Error(`No configuration found for plugin: ${pluginName}`);
    }
    
    const configData = {
      meta: pluginConfig.meta,
      config: pluginConfig.config
    };
    
    await fs.promises.writeFile(configPath, JSON.stringify(configData, null, 2), 'utf8');
  }
  
  /**
   * Load plugin configuration from main configuration
   */
  loadPluginConfig(pluginName: string): void {
    const mainConfig = this._configManager.getConfig();
    const pluginConfig = mainConfig.plugins.plugins[pluginName];
    
    if (pluginConfig) {
      // Merge with defaults if available
      const defaults = this._defaultConfigs.get(pluginName);
      const merged = defaults ? ConfigMerger.mergeConfigs(defaults, pluginConfig) : pluginConfig;
      
      this.setPluginConfig(pluginName, merged, 'file');
    } else if (this._defaultConfigs.has(pluginName)) {
      // Use defaults if no configuration is found
      const defaults = this._defaultConfigs.get(pluginName);
      this.setPluginConfig(pluginName, defaults, 'default');
    }
  }
  
  /**
   * Get all plugin configurations
   */
  getAllPluginConfigs(): Map<string, PluginSpecificConfig> {
    return new Map(this._pluginConfigs);
  }
  
  /**
   * Get plugin configuration metadata
   */
  getPluginConfigMeta(pluginName: string): PluginConfigMeta | undefined {
    return this._pluginConfigs.get(pluginName)?.meta;
  }
  
  /**
   * Validate plugin configuration
   */
  validatePluginConfig(pluginName: string, config?: any): boolean {
    const configToValidate = config || this.getPluginConfig(pluginName);
    
    if (!configToValidate) {
      return false;
    }
    
    const schema = this._configSchemas.get(pluginName);
    
    if (!schema) {
      // No schema means we can't validate, assume valid
      return true;
    }
    
    try {
      // Note: In a real implementation, you'd use the actual schema validation library
      // This is a placeholder for schema validation
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get plugin configuration validation errors
   */
  getPluginConfigErrors(pluginName: string): string[] {
    const pluginConfig = this._pluginConfigs.get(pluginName);
    return pluginConfig?.validationErrors || [];
  }
  
  /**
   * Reset plugin configuration to defaults
   */
  resetPluginConfig(pluginName: string): void {
    const defaults = this._defaultConfigs.get(pluginName);
    
    if (defaults) {
      this.setPluginConfig(pluginName, defaults, 'default');
    } else {
      // Remove configuration if no defaults
      this._pluginConfigs.delete(pluginName);
      this.updateMainPluginConfig(pluginName, undefined);
    }
  }
  
  /**
   * Remove plugin configuration
   */
  removePluginConfig(pluginName: string): void {
    this._pluginConfigs.delete(pluginName);
    this._configSchemas.delete(pluginName);
    this._defaultConfigs.delete(pluginName);
    
    // Remove from main configuration
    this.updateMainPluginConfig(pluginName, undefined);
    
    this.emit('pluginConfigRemoved', { pluginName, timestamp: new Date() });
  }
  
  /**
   * Get plugin configuration directories
   */
  getPluginConfigDirectories(): string[] {
    const baseDir = EnvironmentConfigProcessor.getSkerHomeDir();
    
    return [
      path.join(baseDir, 'config', 'plugins'),
      path.join(baseDir, 'plugins', 'config'),
      path.join(baseDir, 'config')
    ];
  }
  
  /**
   * Discover plugin configuration files
   */
  async discoverPluginConfigs(): Promise<Map<string, string>> {
    const configDirs = this.getPluginConfigDirectories();
    const discoveredConfigs = new Map<string, string>();
    
    for (const dir of configDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = await fs.promises.readdir(dir);
          
          for (const file of files) {
            const match = file.match(/^(.+)\.config\.(json|yaml|yml)$/);
            if (match) {
              const pluginName = match[1];
              const filePath = path.join(dir, file);
              
              // Only add if not already discovered (first directory wins)
              if (!discoveredConfigs.has(pluginName)) {
                discoveredConfigs.set(pluginName, filePath);
              }
            }
          }
        } catch (error) {
          // Ignore directory read errors
        }
      }
    }
    
    return discoveredConfigs;
  }
  
  /**
   * Load all discovered plugin configurations
   */
  async loadDiscoveredConfigs(): Promise<void> {
    const discoveredConfigs = await this.discoverPluginConfigs();
    
    for (const [pluginName, configPath] of discoveredConfigs.entries()) {
      try {
        await this.loadPluginConfigFromFile(pluginName, configPath);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.emit('error', new Error(`Failed to load plugin config for ${pluginName}: ${message}`));
      }
    }
  }
  
  /**
   * Create plugin configuration template
   */
  createPluginConfigTemplate(pluginName: string): any {
    const defaults = this._defaultConfigs.get(pluginName) || {};
    const schema = this._configSchemas.get(pluginName);
    
    return {
      meta: {
        name: pluginName,
        version: '1.0.0',
        schemaVersion: '1.0.0',
        description: `Configuration for ${pluginName} plugin`,
        lastUpdate: new Date().toISOString()
      },
      config: defaults,
      schema: schema ? 'Schema available' : 'No schema defined'
    };
  }
  
  /**
   * Export plugin configuration
   */
  exportPluginConfig(pluginName: string): any {
    const pluginConfig = this._pluginConfigs.get(pluginName);
    
    if (!pluginConfig) {
      throw new Error(`No configuration found for plugin: ${pluginName}`);
    }
    
    return {
      meta: pluginConfig.meta,
      config: pluginConfig.config,
      validation: {
        isValid: pluginConfig.isValid,
        errors: pluginConfig.validationErrors
      },
      lastUpdate: pluginConfig.lastUpdate.toISOString()
    };
  }
  
  // === Private Methods ===
  
  /**
   * Handle main configuration changes
   */
  private handleMainConfigChange(event: any): void {
    // Check if plugin-related configuration changed
    if (event.changes.some((change: string) => change.startsWith('plugins.'))) {
      // Reload plugin configurations
      const mainConfig = this._configManager.getConfig();
      
      for (const [pluginName] of this._pluginConfigs) {
        this.loadPluginConfig(pluginName);
      }
    }
  }
  
  /**
   * Update plugin configuration in main configuration
   */
  private updateMainPluginConfig(pluginName: string, config: any): void {
    const updates: any = {
      plugins: {
        plugins: {
          [pluginName]: config
        }
      }
    };
    
    // Remove plugin configuration if config is undefined
    if (config === undefined) {
      const currentConfig = this._configManager.getConfig();
      const pluginConfigs = { ...currentConfig.plugins.plugins };
      delete pluginConfigs[pluginName];
      
      updates.plugins.plugins = pluginConfigs;
    }
    
    this._configManager.updateConfig(updates, `plugin:${pluginName}`);
  }
  
  /**
   * Detect configuration changes
   */
  private detectConfigChanges(previous: any, current: any): string[] {
    const changes: string[] = [];
    
    if (previous && current) {
      this.detectObjectChanges(previous, current, '', changes);
    } else if (!previous && current) {
      changes.push('*'); // All configuration is new
    } else if (previous && !current) {
      changes.push('*'); // All configuration removed
    }
    
    return changes;
  }
  
  /**
   * Recursively detect object changes
   */
  private detectObjectChanges(prev: any, curr: any, path: string, changes: string[]): void {
    const allKeys = new Set([...Object.keys(prev || {}), ...Object.keys(curr || {})]);
    
    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      const prevValue = prev?.[key];
      const currValue = curr?.[key];
      
      if (prevValue !== currValue) {
        if (typeof prevValue === 'object' && typeof currValue === 'object' && 
            prevValue !== null && currValue !== null && 
            !Array.isArray(prevValue) && !Array.isArray(currValue)) {
          this.detectObjectChanges(prevValue, currValue, currentPath, changes);
        } else {
          changes.push(currentPath);
        }
      }
    }
  }
}

/**
 * Plugin configuration utilities
 */
export class PluginConfigUtils {
  /**
   * Merge plugin configurations
   */
  static mergePluginConfigs(...configs: any[]): any {
    return ConfigMerger.mergeConfigs(...configs);
  }
  
  /**
   * Deep clone plugin configuration
   */
  static clonePluginConfig<T>(config: T): T {
    return JSON.parse(JSON.stringify(config));
  }
  
  /**
   * Validate plugin name
   */
  static validatePluginName(name: string): boolean {
    // Plugin names should be valid identifiers
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name);
  }
  
  /**
   * Sanitize plugin name
   */
  static sanitizePluginName(name: string): string {
    return name.toLowerCase()
               .replace(/[^a-z0-9_-]/g, '-')
               .replace(/--+/g, '-')
               .replace(/^-+|-+$/g, '');
  }
  
  /**
   * Generate plugin configuration file name
   */
  static getPluginConfigFileName(pluginName: string): string {
    return `${PluginConfigUtils.sanitizePluginName(pluginName)}.config.json`;
  }
  
  /**
   * Get plugin configuration file path
   */
  static getPluginConfigFilePath(pluginName: string): string {
    const configDir = path.join(EnvironmentConfigProcessor.getSkerHomeDir(), 'config', 'plugins');
    const fileName = PluginConfigUtils.getPluginConfigFileName(pluginName);
    return path.join(configDir, fileName);
  }
}

/**
 * Default plugin configuration manager instance
 */
let defaultPluginConfigManager: PluginConfigManager | undefined;

/**
 * Get default plugin configuration manager
 */
export function getDefaultPluginConfigManager(): PluginConfigManager {
  if (!defaultPluginConfigManager) {
    defaultPluginConfigManager = new PluginConfigManager();
  }
  return defaultPluginConfigManager;
}

/**
 * Plugin configuration manager factory
 */
export class PluginConfigManagerFactory {
  private static instances = new Map<string, PluginConfigManager>();
  
  /**
   * Get or create plugin configuration manager instance
   */
  static getInstance(name = 'default', configManager?: ConfigManager): PluginConfigManager {
    if (!PluginConfigManagerFactory.instances.has(name)) {
      PluginConfigManagerFactory.instances.set(name, new PluginConfigManager(configManager));
    }
    
    return PluginConfigManagerFactory.instances.get(name)!;
  }
  
  /**
   * Remove plugin configuration manager instance
   */
  static removeInstance(name: string): void {
    const instance = PluginConfigManagerFactory.instances.get(name);
    if (instance) {
      instance.removeAllListeners();
      PluginConfigManagerFactory.instances.delete(name);
    }
  }
}