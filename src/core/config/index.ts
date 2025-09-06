/**
 * Configuration Management System
 * 
 * This module provides the main exports for the Sker Daemon configuration management system.
 * It includes schema definitions, environment processing, core configuration management,
 * and plugin-specific configuration handling.
 * 
 * Key Features:
 * - Zod-based schema validation
 * - Multi-layer configuration priority (defaults < environment template < environment variables < files < runtime)
 * - Hot reload support with file watching
 * - Plugin configuration isolation
 * - Environment-specific configuration templates
 * - Type-safe configuration access
 */

import type { ProjectManager } from '../project-manager.js';
import type { IWinstonLogger } from '../logging/winston-logger.js';

// === Core Exports ===

// Schema definitions and validation
export {
  // Configuration schemas
  ConfigSchema,
  ServerConfigSchema,
  LoggingConfigSchema,
  PluginConfigSchema,
  SecurityConfigSchema,
  PerformanceConfigSchema,
  DevelopmentConfigSchema,
  EnvironmentConfigSchema,
  
  // Configuration types
  Config,
  ServerConfig,
  LoggingConfig,
  PluginConfig as ConfigPluginConfig, // Rename to avoid conflict
  SecurityConfig,
  PerformanceConfig,
  DevelopmentConfig,
  EnvironmentConfig,
  
  // Validation utilities
  ConfigValidator,
  ConfigMerger,
  ConfigTemplates
} from './config-schema.js';

// Environment configuration processing
export {
  EnvironmentConfigProcessor,
  EnvironmentUtils,
  getProcessedEnvConfig
} from './environment-config.js';

// Core configuration manager
export {
  ConfigManager,
  ConfigManagerFactory,
  getConfigManager,
  ConfigSource,
  ConfigChangeEvent,
  ConfigLoadOptions
} from './config-manager.js';

// Plugin configuration management
export {
  PluginConfigManager,
  PluginConfigManagerFactory,
  PluginConfigUtils,
  getDefaultPluginConfigManager,
  PluginConfigMeta,
  PluginSpecificConfig,
  PluginConfigChangeEvent,
  PluginIsolationLevel
} from './plugin-config.js';

// === Configuration Factory ===

import { ConfigManager } from './config-manager.js';
import { PluginConfigManager } from './plugin-config.js';
import { EnvironmentUtils } from './environment-config.js';

/**
 * Configuration system factory
 */
export class ConfigurationSystem {
  private static instance: ConfigurationSystem | undefined;
  private _configManager: ConfigManager;
  private _pluginConfigManager: PluginConfigManager;
  private _initialized = false;
  
  constructor(logger: IWinstonLogger) {
    this._configManager = new ConfigManager(logger);
    this._pluginConfigManager = new PluginConfigManager(this._configManager);
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(projectManager?: ProjectManager, logger?: IWinstonLogger): ConfigurationSystem {
    if (!ConfigurationSystem.instance) {
      if (!projectManager || !logger) {
        throw new Error('ConfigurationSystem requires ProjectManager and Logger dependencies on first initialization');
      }
      ConfigurationSystem.instance = new ConfigurationSystem(logger);
    }
    return ConfigurationSystem.instance;
  }
  
  /**
   * Initialize configuration system
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }
    
    try {
      // Ensure directories exist
      EnvironmentUtils.ensureDirectories();
      
      // Load default configuration files
      await this._configManager.loadDefaults({ watch: true });
      
      // Load plugin configurations
      await this._pluginConfigManager.loadDiscoveredConfigs();
      
      this._initialized = true;
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize configuration system: ${message}`);
    }
  }
  
  /**
   * Get configuration manager
   */
  getConfigManager(): ConfigManager {
    return this._configManager;
  }
  
  /**
   * Get plugin configuration manager
   */
  getPluginConfigManager(): PluginConfigManager {
    return this._pluginConfigManager;
  }
  
  /**
   * Get current configuration
   */
  getConfig() {
    return this._configManager.getConfig();
  }
  
  /**
   * Update configuration
   */
  updateConfig(updates: any, source?: string): void {
    this._configManager.updateConfig(updates, source);
  }
  
  /**
   * Get plugin configuration
   */
  getPluginConfig<T = any>(pluginName: string): T | undefined {
    return this._pluginConfigManager.getPluginConfig<T>(pluginName);
  }
  
  /**
   * Set plugin configuration
   */
  setPluginConfig(pluginName: string, config: any, source?: string): void {
    this._pluginConfigManager.setPluginConfig(pluginName, config, source);
  }
  
  /**
   * Validate configuration
   */
  validateConfiguration() {
    return this._configManager.validateConfiguration();
  }
  
  /**
   * Enable hot reload
   */
  enableHotReload(): void {
    this._configManager.enableHotReload();
  }
  
  /**
   * Disable hot reload
   */
  disableHotReload(): void {
    this._configManager.disableHotReload();
  }
  
  /**
   * Reset to defaults
   */
  resetToDefaults(): void {
    this._configManager.resetToDefaults();
  }
  
  /**
   * Export configuration
   */
  async exportConfiguration(filePath: string): Promise<void> {
    await this._configManager.exportConfiguration(filePath);
  }
  
  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this._initialized;
  }
}

// === Convenience Functions ===

/**
 * Get default configuration system instance
 */
export function getConfigurationSystem(): ConfigurationSystem {
  return ConfigurationSystem.getInstance();
}

/**
 * Initialize default configuration system
 */
export async function initializeConfiguration(): Promise<ConfigurationSystem> {
  const system = ConfigurationSystem.getInstance();
  await system.initialize();
  return system;
}

/**
 * Get current configuration (convenience function)
 */
export function getConfig() {
  return ConfigurationSystem.getInstance().getConfig();
}

/**
 * Get server configuration (convenience function)
 */
export function getServerConfig() {
  return ConfigurationSystem.getInstance().getConfig().server;
}

/**
 * Get logging configuration (convenience function)
 */
export function getLoggingConfig() {
  return ConfigurationSystem.getInstance().getConfig().logging;
}

/**
 * Get plugin configuration (convenience function)
 */
export function getPluginConfig<T = any>(pluginName: string): T | undefined {
  return ConfigurationSystem.getInstance().getPluginConfig<T>(pluginName);
}

/**
 * Get environment information (convenience function)
 */
export function getEnvironmentInfo() {
  return {
    environment: EnvironmentUtils.getEnvironment(),
    isDevelopment: EnvironmentUtils.isDevelopment(),
    isProduction: EnvironmentUtils.isProduction(),
    isTesting: EnvironmentUtils.isTesting(),
    directories: EnvironmentUtils.getDirectories()
  };
}

// === Default Export ===

/**
 * Default configuration system instance factory
 * Note: Returns null by default to prevent initialization errors
 * Use ConfigurationSystem.getInstance(projectManager, logger) explicitly
 */
export default null;

// === Type-only Exports ===

export type {
  ConfigSourceMeta,
  ConfigFileFormat
} from './config-manager.js';

// Re-export types to avoid conflicts
export type { Config as CoreConfig } from './config-schema.js';