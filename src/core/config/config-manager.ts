/**
 * Core Configuration Manager
 * 
 * This module provides the central configuration management system for Sker Daemon.
 * It supports layered configuration loading with hot reload capabilities, file watching,
 * and priority-based configuration merging.
 */

import { 
  Config, 
  ConfigValidator, 
  ConfigMerger, 
  ServerConfig,
  LoggingConfig,
  PluginConfig 
} from './config-schema.js';
import { 
  EnvironmentConfigProcessor, 
  EnvironmentUtils 
} from './environment-config.js';
import { Injectable, Inject } from '@sker/di';
import { PROJECT_MANAGER, LOGGER } from '../tokens.js';
import type { ProjectManager } from '../project-manager.js';
import type { IWinstonLogger } from '../logging/winston-logger.js';
import type { IMcpServerConfig } from '../types.js';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';

/**
 * Configuration source types
 */
export enum ConfigSource {
  DEFAULT = 'default',
  FILE_SYSTEM = 'file-system',
  ENVIRONMENT = 'environment',
  COMMAND_LINE = 'command-line',
  RUNTIME = 'runtime'
}

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  /** Previous configuration */
  previous: Config;
  /** New configuration */
  current: Config;
  /** Changed configuration paths */
  changes: string[];
  /** Change source */
  source: ConfigSource;
  /** Change timestamp */
  timestamp: Date;
}

/**
 * Configuration source metadata
 */
export interface ConfigSourceMeta {
  /** Source type */
  source: ConfigSource;
  /** Source priority (higher = more important) */
  priority: number;
  /** Source data */
  data: Partial<Config>;
  /** Last update timestamp */
  lastUpdate: Date;
  /** Source-specific metadata */
  metadata?: any;
}

/**
 * Configuration file formats
 */
export type ConfigFileFormat = 'json' | 'yaml' | 'js' | 'ts';

/**
 * Configuration loading options
 */
export interface ConfigLoadOptions {
  /** Watch for file changes */
  watch?: boolean;
  /** Validate configuration */
  validate?: boolean;
  /** Merge with existing configuration */
  merge?: boolean;
  /** Configuration file format */
  format?: ConfigFileFormat;
  /** Custom configuration sources */
  sources?: string[];
}

/**
 * Core configuration manager with dependency injection support
 */
@Injectable()
export class ConfigManager extends EventEmitter {
  private readonly _sources = new Map<string, ConfigSourceMeta>();
  private _config: Config;
  private _isWatching = false;
  private _fileWatchers = new Map<string, fs.FSWatcher>();
  private _hotReloadEnabled = false;
  
  constructor(
    @Inject(PROJECT_MANAGER) private readonly projectManager: ProjectManager,
    @Inject(LOGGER) private readonly logger: IWinstonLogger
  ) {
    super();
    this._config = ConfigValidator.getDefaults();
    this.initialize();
  }
  
  /**
   * Initialize configuration manager
   */
  private initialize(): void {
    // Load default configuration
    this.addSource('default', ConfigSource.DEFAULT, ConfigValidator.getDefaults(), 0);
    
    // Load environment-based template
    const envTemplate = EnvironmentConfigProcessor.getEnvironmentTemplate();
    this.addSource('environment-template', ConfigSource.ENVIRONMENT, envTemplate, 10);
    
    // Load from environment variables
    const envConfig = EnvironmentConfigProcessor.loadFromEnvironment();
    this.addSource('environment-variables', ConfigSource.ENVIRONMENT, envConfig, 20);
    
    // Rebuild configuration
    this.rebuildConfiguration();
    
    // Set up hot reload if in development
    if (EnvironmentUtils.isDevelopment()) {
      this.enableHotReload();
    }
  }
  
  /**
   * Get current configuration
   */
  getConfig(): Config {
    return this._config;
  }

  /**
   * Get MCP server compatible configuration
   */
  getMcpConfig(): IMcpServerConfig {
    return this.convertToMcpConfig(this._config);
  }
  
  /**
   * Get server configuration
   */
  getServerConfig(): ServerConfig {
    return this._config.server;
  }
  
  /**
   * Get logging configuration
   */
  getLoggingConfig(): LoggingConfig {
    return this._config.logging;
  }
  
  /**
   * Get plugin configuration
   */
  getPluginConfig(): PluginConfig {
    return this._config.plugins;
  }
  
  /**
   * Load configuration from file
   */
  async loadFromFile(filePath: string, options: ConfigLoadOptions = {}): Promise<void> {
    try {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
      
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Configuration file not found: ${absolutePath}`);
      }
      
      const data = await this.readConfigFile(absolutePath, options.format);
      const sourceKey = `file:${absolutePath}`;
      
      // Add or update file source
      this.addSource(sourceKey, ConfigSource.FILE_SYSTEM, data, 15, { filePath: absolutePath });
      
      // Set up file watching if enabled
      if (options.watch && !this._fileWatchers.has(sourceKey)) {
        this.watchConfigFile(absolutePath, sourceKey);
      }
      
      // Rebuild configuration
      this.rebuildConfiguration();
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to load configuration from ${filePath}: ${message}`);
    }
  }
  
  /**
   * Load configuration from directory
   */
  async loadFromDirectory(dirPath: string, options: ConfigLoadOptions = {}): Promise<void> {
    const configDir = path.isAbsolute(dirPath) ? dirPath : path.resolve(dirPath);
    
    if (!fs.existsSync(configDir)) {
      // Create directory if it doesn't exist
      fs.mkdirSync(configDir, { recursive: true });
      return;
    }
    
    const configFiles = this.findConfigFiles(configDir);
    
    for (const file of configFiles) {
      await this.loadFromFile(file, options);
    }
  }
  
  /**
   * Load default configuration files
   */
  async loadDefaults(options: ConfigLoadOptions = {}): Promise<void> {
    const configDir = EnvironmentConfigProcessor.getConfigDir();
    
    // Load main configuration file
    const mainConfigFiles = [
      path.join(configDir, 'config.json'),
      path.join(configDir, 'config.yaml'),
      path.join(configDir, 'config.yml'),
      path.join(configDir, 'config.js')
    ];
    
    for (const configFile of mainConfigFiles) {
      if (fs.existsSync(configFile)) {
        await this.loadFromFile(configFile, options);
        break;
      }
    }
    
    // Load environment-specific configuration
    const env = EnvironmentUtils.getEnvironment();
    const envConfigFiles = [
      path.join(configDir, `config.${env}.json`),
      path.join(configDir, `config.${env}.yaml`),
      path.join(configDir, `config.${env}.yml`),
      path.join(configDir, `config.${env}.js`)
    ];
    
    for (const configFile of envConfigFiles) {
      if (fs.existsSync(configFile)) {
        await this.loadFromFile(configFile, { ...options, merge: true });
        break;
      }
    }
  }
  
  /**
   * Update configuration at runtime
   */
  updateConfig(updates: Partial<Config>, source = 'runtime'): void {
    const sourceKey = `runtime:${source}`;
    this.addSource(sourceKey, ConfigSource.RUNTIME, updates, 30);
    this.rebuildConfiguration();
  }
  
  /**
   * Set configuration value by path
   */
  setConfigValue(path: string, value: any, source = 'runtime'): void {
    const updates: any = {};
    this.setNestedValue(updates, path, value);
    this.updateConfig(updates, source);
  }
  
  /**
   * Get configuration value by path
   */
  getConfigValue<T = any>(path: string, defaultValue?: T): T {
    return this.getNestedValue(this._config, path) ?? defaultValue;
  }
  
  /**
   * Remove configuration source
   */
  removeSource(sourceKey: string): void {
    // Stop watching file if applicable
    if (this._fileWatchers.has(sourceKey)) {
      this._fileWatchers.get(sourceKey)?.close();
      this._fileWatchers.delete(sourceKey);
    }
    
    // Remove source
    this._sources.delete(sourceKey);
    
    // Rebuild configuration
    this.rebuildConfiguration();
  }
  
  /**
   * Enable hot reload
   */
  enableHotReload(): void {
    this._hotReloadEnabled = true;
    
    // Watch configuration directory
    const configDir = EnvironmentConfigProcessor.getConfigDir();
    if (fs.existsSync(configDir)) {
      this.watchConfigDirectory(configDir);
    }
  }
  
  /**
   * Disable hot reload
   */
  disableHotReload(): void {
    this._hotReloadEnabled = false;
    
    // Close all file watchers
    for (const watcher of this._fileWatchers.values()) {
      watcher.close();
    }
    this._fileWatchers.clear();
    this._isWatching = false;
  }
  
  /**
   * Validate current configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    try {
      ConfigValidator.validateConfig(this._config);
      return { valid: true, errors: [] };
    } catch (error) {
      const errors = error instanceof Error ? [error.message] : ['Configuration validation failed'];
      return { valid: false, errors };
    }
  }
  
  /**
   * Export configuration to file
   */
  async exportConfiguration(filePath: string, format: ConfigFileFormat = 'json'): Promise<void> {
    const data = this.serializeConfig(this._config, format);
    await fs.promises.writeFile(filePath, data, 'utf8');
  }
  
  /**
   * Get configuration sources information
   */
  getSourcesInfo(): Array<{ key: string; source: ConfigSource; priority: number; lastUpdate: Date }> {
    return Array.from(this._sources.entries()).map(([key, meta]) => ({
      key,
      source: meta.source,
      priority: meta.priority,
      lastUpdate: meta.lastUpdate
    }));
  }
  
  /**
   * Reset to defaults
   */
  resetToDefaults(): void {
    // Clear all non-default sources
    const defaultSources = ['default', 'environment-template', 'environment-variables'];
    const sourcesToRemove = Array.from(this._sources.keys()).filter(key => !defaultSources.includes(key));
    
    for (const sourceKey of sourcesToRemove) {
      this.removeSource(sourceKey);
    }
    
    this.rebuildConfiguration();
  }
  
  // === Private Methods ===
  
  /**
   * Add configuration source
   */
  private addSource(
    key: string, 
    source: ConfigSource, 
    data: Partial<Config>, 
    priority: number, 
    metadata?: any
  ): void {
    const previous = this._config ? { ...this._config } : undefined;
    
    this._sources.set(key, {
      source,
      priority,
      data,
      lastUpdate: new Date(),
      metadata
    });
    
    // Emit source change event
    this.emit('sourceChanged', { key, source, data, metadata });
    
    // If we have a previous config, we'll handle change events after rebuild
    if (previous) {
      // Store for change detection after rebuild
      this.once('configRebuilt', (newConfig: Config) => {
        const changes = this.detectChanges(previous, newConfig);
        if (changes.length > 0) {
          this.emit('configChanged', {
            previous,
            current: newConfig,
            changes,
            source,
            timestamp: new Date()
          } as ConfigChangeEvent);
        }
      });
    }
  }
  
  /**
   * Rebuild configuration from all sources
   */
  private rebuildConfiguration(): void {
    try {
      // Sort sources by priority (ascending)
      const sortedSources = Array.from(this._sources.values()).sort((a, b) => a.priority - b.priority);
      
      // Merge configurations
      const configs = sortedSources.map(source => source.data);
      const merged = ConfigMerger.mergeConfigs(...configs);
      
      // Validate and set new configuration
      this._config = ConfigValidator.validateConfig(merged);
      
      this.emit('configRebuilt', this._config);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Configuration rebuild failed';
      this.emit('error', new Error(`Configuration rebuild failed: ${message}`));
    }
  }
  
  /**
   * Read configuration file
   */
  private async readConfigFile(filePath: string, format?: ConfigFileFormat): Promise<Partial<Config>> {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const detectedFormat = format || this.detectFileFormat(filePath);
    
    switch (detectedFormat) {
      case 'json':
        return JSON.parse(content);
        
      case 'yaml':
        // Note: In a real implementation, you'd use a YAML library like 'yaml'
        throw new Error('YAML support not implemented - please use JSON format');
        
      case 'js':
      case 'ts':
        // Note: In a real implementation, you'd use dynamic import or require
        throw new Error('JS/TS config support not implemented - please use JSON format');
        
      default:
        throw new Error(`Unsupported configuration format: ${detectedFormat}`);
    }
  }
  
  /**
   * Serialize configuration to string
   */
  private serializeConfig(config: Config, format: ConfigFileFormat): string {
    switch (format) {
      case 'json':
        return JSON.stringify(config, null, 2);
        
      default:
        throw new Error(`Serialization format not supported: ${format}`);
    }
  }
  
  /**
   * Detect configuration file format
   */
  private detectFileFormat(filePath: string): ConfigFileFormat {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.json':
        return 'json';
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.js':
        return 'js';
      case '.ts':
        return 'ts';
      default:
        return 'json';
    }
  }
  
  /**
   * Find configuration files in directory
   */
  private findConfigFiles(dirPath: string): string[] {
    const files: string[] = [];
    const configPatterns = [
      /^config\.(json|yaml|yml|js|ts)$/,
      /^config\..*\.(json|yaml|yml|js|ts)$/
    ];
    
    try {
      const entries = fs.readdirSync(dirPath);
      
      for (const entry of entries) {
        const filePath = path.join(dirPath, entry);
        const stat = fs.statSync(filePath);
        
        if (stat.isFile()) {
          for (const pattern of configPatterns) {
            if (pattern.test(entry)) {
              files.push(filePath);
              break;
            }
          }
        }
      }
      
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return files.sort(); // Sort for consistent loading order
  }
  
  /**
   * Watch configuration file for changes
   */
  private watchConfigFile(filePath: string, sourceKey: string): void {
    if (!this._hotReloadEnabled) return;
    
    const watcher = fs.watch(filePath, { persistent: false }, async (eventType) => {
      if (eventType === 'change') {
        try {
          const data = await this.readConfigFile(filePath);
          this.addSource(sourceKey, ConfigSource.FILE_SYSTEM, data, 15, { filePath });
          this.rebuildConfiguration();
          
          this.emit('fileChanged', { filePath, sourceKey });
          
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          this.emit('error', new Error(`Failed to reload configuration file ${filePath}: ${message}`));
        }
      }
    });
    
    this._fileWatchers.set(sourceKey, watcher);
  }
  
  /**
   * Watch configuration directory for changes
   */
  private watchConfigDirectory(dirPath: string): void {
    if (!this._hotReloadEnabled || this._isWatching) return;
    
    const watcher = fs.watch(dirPath, { persistent: false }, async (eventType, filename) => {
      if (filename && this.isConfigFile(filename)) {
        const filePath = path.join(dirPath, filename);
        
        if (eventType === 'change' && fs.existsSync(filePath)) {
          // Reload changed file
          try {
            await this.loadFromFile(filePath, { watch: true });
            this.emit('fileChanged', { filePath, eventType });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.emit('error', new Error(`Failed to reload configuration file ${filePath}: ${message}`));
          }
          
        } else if (eventType === 'rename') {
          // Handle file addition/removal
          const sourceKey = `file:${filePath}`;
          
          if (!fs.existsSync(filePath)) {
            // File was removed
            this.removeSource(sourceKey);
            this.emit('fileRemoved', { filePath });
          } else {
            // File was added
            try {
              await this.loadFromFile(filePath, { watch: true });
              this.emit('fileAdded', { filePath });
            } catch (error) {
              // Ignore errors for new files that might not be valid config files
            }
          }
        }
      }
    });
    
    this._fileWatchers.set('directory', watcher);
    this._isWatching = true;
  }
  
  /**
   * Check if filename is a configuration file
   */
  private isConfigFile(filename: string): boolean {
    return /^config.*\.(json|yaml|yml|js|ts)$/.test(filename);
  }
  
  /**
   * Detect configuration changes
   */
  private detectChanges(previous: Config, current: Config): string[] {
    const changes: string[] = [];
    this.detectObjectChanges(previous, current, '', changes);
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
  
  /**
   * Set nested object value by path
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }
  
  /**
   * Get nested object value by path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Convert internal Config to IMcpServerConfig format
   */
  private convertToMcpConfig(config: Config): IMcpServerConfig {
    return {
      name: config.server?.name || 'sker-daemon',
      version: config.server?.version || '1.0.0',
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      },
      plugins: {
        enabled: ['core']
      },
      transport: { type: 'stdio' as const },
      logging: {
        level: config.logging?.level || 'info',
        format: config.logging?.format || 'text'
      }
    };
  }

  /**
   * Load plugin-specific configuration (compatible with design docs)
   */
  async loadPluginConfig(pluginName: string, pluginPath: string): Promise<any> {
    const configPath = path.join(pluginPath, 'plugin.config.json');
    
    try {
      await fs.promises.access(configPath);
      const configData = await fs.promises.readFile(configPath, 'utf-8');
      const pluginConfig = JSON.parse(configData);
      
      this.logger.debug('Plugin configuration loaded', { pluginName, configPath });
      return pluginConfig;
      
    } catch (error) {
      // Create default plugin configuration if file doesn't exist
      const defaultConfig = {
        name: pluginName,
        enabled: true,
        autoLoad: true,
        version: '1.0.0',
        description: `Plugin ${pluginName}`,
        main: 'index.js'
      };
      
      this.logger.debug('Using default plugin configuration', { pluginName });
      return defaultConfig;
    }
  }
}

/**
 * Get global configuration manager instance (lazy initialization)
 */
export const getConfigManager = (projectManager?: ProjectManager, logger?: IWinstonLogger) => {
  if (projectManager && logger) {
    return new ConfigManager(projectManager, logger);
  }
  throw new Error('ConfigManager requires ProjectManager and Logger dependencies');
};

/**
 * Configuration manager factory
 */
export class ConfigManagerFactory {
  private static instances = new Map<string, ConfigManager>();
  
  /**
   * Get or create configuration manager instance
   */
  static getInstance(name = 'default', projectManager?: ProjectManager, logger?: IWinstonLogger): ConfigManager {
    if (!ConfigManagerFactory.instances.has(name)) {
      if (!projectManager || !logger) {
        throw new Error('ConfigManager requires ProjectManager and Logger dependencies');
      }
      ConfigManagerFactory.instances.set(name, new ConfigManager(projectManager, logger));
    }
    
    return ConfigManagerFactory.instances.get(name)!;
  }
  
  /**
   * Create new configuration manager instance
   */
  static createInstance(name: string, projectManager: ProjectManager, logger: IWinstonLogger): ConfigManager {
    const instance = new ConfigManager(projectManager, logger);
    ConfigManagerFactory.instances.set(name, instance);
    return instance;
  }
  
  /**
   * Remove configuration manager instance
   */
  static removeInstance(name: string): void {
    const instance = ConfigManagerFactory.instances.get(name);
    if (instance) {
      instance.disableHotReload();
      instance.removeAllListeners();
      ConfigManagerFactory.instances.delete(name);
    }
  }
  
  /**
   * Get all instance names
   */
  static getInstanceNames(): string[] {
    return Array.from(ConfigManagerFactory.instances.keys());
  }
}