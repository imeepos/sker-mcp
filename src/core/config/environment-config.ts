/**
 * Environment Configuration Processing
 * 
 * This module handles environment variable processing and environment-specific
 * configuration loading. It provides utilities for loading configuration from
 * environment variables with proper type conversion and validation.
 */

import { Config, ConfigValidator, ConfigMerger, ConfigTemplates } from './config-schema.js';
import path from 'path';
import os from 'os';

/**
 * Environment variable mapping configuration
 */
interface EnvMapping {
  /** Environment variable name */
  envVar: string;
  /** Configuration path (dot notation) */
  configPath: string;
  /** Value transformer function */
  transform?: (value: string) => any;
  /** Default value if environment variable is not set */
  defaultValue?: any;
}

/**
 * Environment configuration processor
 */
export class EnvironmentConfigProcessor {
  private static readonly ENV_PREFIX = 'SKER_';
  
  /**
   * Environment variable mappings
   */
  private static readonly ENV_MAPPINGS: EnvMapping[] = [
    // Server configuration
    { envVar: 'SKER_SERVER_NAME', configPath: 'server.name' },
    { envVar: 'SKER_SERVER_VERSION', configPath: 'server.version' },
    { envVar: 'SKER_SERVER_TRANSPORT_TYPE', configPath: 'server.transport.type' },
    { envVar: 'SKER_SERVER_HTTP_PORT', configPath: 'server.transport.http.port', transform: parseInt },
    { envVar: 'SKER_SERVER_HTTP_HOST', configPath: 'server.transport.http.host' },
    { envVar: 'SKER_SERVER_HTTP_CORS', configPath: 'server.transport.http.cors', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_SERVER_HTTP_TIMEOUT', configPath: 'server.transport.http.timeout', transform: parseInt },
    
    // Server capabilities
    { envVar: 'SKER_SERVER_LOGGING', configPath: 'server.capabilities.logging', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_SERVER_SAMPLING', configPath: 'server.capabilities.sampling', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_SERVER_EXPERIMENTAL', configPath: 'server.capabilities.experimental', transform: EnvironmentConfigProcessor.parseBoolean },
    
    // Server limits
    { envVar: 'SKER_SERVER_MAX_CONCURRENT', configPath: 'server.limits.maxConcurrentRequests', transform: parseInt },
    { envVar: 'SKER_SERVER_REQUEST_TIMEOUT', configPath: 'server.limits.requestTimeout', transform: parseInt },
    { envVar: 'SKER_SERVER_MAX_REQUEST_SIZE', configPath: 'server.limits.maxRequestSize', transform: parseInt },
    { envVar: 'SKER_SERVER_MAX_RESPONSE_SIZE', configPath: 'server.limits.maxResponseSize', transform: parseInt },
    
    // Logging configuration
    { envVar: 'SKER_LOG_LEVEL', configPath: 'logging.level' },
    { envVar: 'SKER_LOG_FORMAT', configPath: 'logging.format' },
    { envVar: 'SKER_LOG_COLORIZE', configPath: 'logging.colorize', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_LOG_TIMESTAMP', configPath: 'logging.timestamp', transform: EnvironmentConfigProcessor.parseBoolean },
    
    // Layer-specific logging
    { envVar: 'SKER_LOG_PLATFORM_LEVEL', configPath: 'logging.layers.platform.level' },
    { envVar: 'SKER_LOG_PLATFORM_CONSOLE', configPath: 'logging.layers.platform.console', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_LOG_PLATFORM_FILE', configPath: 'logging.layers.platform.file', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_LOG_APP_LEVEL', configPath: 'logging.layers.application.level' },
    { envVar: 'SKER_LOG_APP_CONSOLE', configPath: 'logging.layers.application.console', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_LOG_APP_FILE', configPath: 'logging.layers.application.file', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_LOG_PLUGIN_LEVEL', configPath: 'logging.layers.plugin.level' },
    { envVar: 'SKER_LOG_PLUGIN_CONSOLE', configPath: 'logging.layers.plugin.console', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_LOG_PLUGIN_FILE', configPath: 'logging.layers.plugin.file', transform: EnvironmentConfigProcessor.parseBoolean },
    
    // Log rotation
    { envVar: 'SKER_LOG_MAX_SIZE', configPath: 'logging.rotation.maxSize' },
    { envVar: 'SKER_LOG_MAX_FILES', configPath: 'logging.rotation.maxFiles', transform: EnvironmentConfigProcessor.parseNumberOrString },
    { envVar: 'SKER_LOG_DATE_PATTERN', configPath: 'logging.rotation.datePattern' },
    { envVar: 'SKER_LOG_COMPRESS', configPath: 'logging.rotation.compress', transform: EnvironmentConfigProcessor.parseBoolean },
    
    // Plugin configuration
    { envVar: 'SKER_PLUGIN_DIRECTORIES', configPath: 'plugins.discovery.directories', transform: EnvironmentConfigProcessor.parseArray },
    { envVar: 'SKER_PLUGIN_MAX_DEPTH', configPath: 'plugins.discovery.maxDepth', transform: parseInt },
    { envVar: 'SKER_PLUGIN_WATCH', configPath: 'plugins.discovery.watch', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_PLUGIN_INCLUDE_DEV', configPath: 'plugins.discovery.includeDev', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_PLUGIN_PARALLEL_LOADING', configPath: 'plugins.loading.parallel', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_PLUGIN_LOADING_TIMEOUT', configPath: 'plugins.loading.timeout', transform: parseInt },
    { envVar: 'SKER_PLUGIN_MAX_CONCURRENT_LOADS', configPath: 'plugins.loading.maxConcurrent', transform: parseInt },
    { envVar: 'SKER_PLUGIN_DEFAULT_ISOLATION', configPath: 'plugins.isolation.default' },
    
    // Security configuration
    { envVar: 'SKER_SECURITY_AUTH', configPath: 'security.authentication', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_SECURITY_AUTHZ', configPath: 'security.authorization', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_SECURITY_API_KEY_ENABLED', configPath: 'security.apiKey.enabled', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_SECURITY_API_KEY_HEADER', configPath: 'security.apiKey.header' },
    { envVar: 'SKER_SECURITY_API_KEYS', configPath: 'security.apiKey.keys', transform: EnvironmentConfigProcessor.parseArray },
    { envVar: 'SKER_SECURITY_RATE_LIMIT', configPath: 'security.rateLimit.enabled', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_SECURITY_RATE_LIMIT_MAX', configPath: 'security.rateLimit.maxRequests', transform: parseInt },
    { envVar: 'SKER_SECURITY_RATE_LIMIT_WINDOW', configPath: 'security.rateLimit.windowMs', transform: parseInt },
    
    // Performance configuration
    { envVar: 'SKER_PERF_MONITORING', configPath: 'performance.monitoring', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_PERF_CACHE_ENABLED', configPath: 'performance.cache.enabled', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_PERF_CACHE_SIZE', configPath: 'performance.cache.maxSize', transform: parseInt },
    { envVar: 'SKER_PERF_CACHE_TTL', configPath: 'performance.cache.ttl', transform: parseInt },
    { envVar: 'SKER_PERF_MEMORY_MONITORING', configPath: 'performance.memory.monitoring', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_PERF_MEMORY_WARNING', configPath: 'performance.memory.warningThreshold', transform: parseFloat },
    
    // Environment configuration
    { envVar: 'NODE_ENV', configPath: 'environment.environment', transform: (val: string) => val as 'development' | 'testing' | 'production' },
    { envVar: 'SKER_ENV', configPath: 'environment.environment', transform: (val: string) => val as 'development' | 'testing' | 'production' },
    { envVar: 'SKER_DEV_ENABLED', configPath: 'environment.settings.development.enabled', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_DEV_HOT_RELOAD', configPath: 'environment.settings.development.hotReload', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_DEV_DEBUG', configPath: 'environment.settings.development.debug', transform: EnvironmentConfigProcessor.parseBoolean },
    { envVar: 'SKER_DEV_VERBOSE', configPath: 'environment.settings.development.verbose', transform: EnvironmentConfigProcessor.parseBoolean },
    
    // Special directories
    { envVar: 'SKER_HOME_DIR', configPath: '_skerHomeDir' }, // Special handling
    { envVar: 'SKER_CONFIG_DIR', configPath: '_configDir' }, // Special handling
    { envVar: 'SKER_LOG_DIR', configPath: '_logDir' } // Special handling
  ];
  
  /**
   * Load configuration from environment variables
   */
  static loadFromEnvironment(): Partial<Config> {
    const config: any = {};
    
    for (const mapping of EnvironmentConfigProcessor.ENV_MAPPINGS) {
      const envValue = process.env[mapping.envVar];
      
      if (envValue !== undefined) {
        const value = mapping.transform ? mapping.transform(envValue) : envValue;
        EnvironmentConfigProcessor.setNestedValue(config, mapping.configPath, value);
      } else if (mapping.defaultValue !== undefined) {
        EnvironmentConfigProcessor.setNestedValue(config, mapping.configPath, mapping.defaultValue);
      }
    }
    
    return config;
  }
  
  /**
   * Get environment-specific configuration template
   */
  static getEnvironmentTemplate(): Partial<Config> {
    const env = EnvironmentConfigProcessor.getCurrentEnvironment();
    
    switch (env) {
      case 'development':
        return ConfigTemplates.development();
      case 'production':
        return ConfigTemplates.production();
      case 'testing':
        return ConfigTemplates.testing();
      default:
        return ConfigTemplates.development();
    }
  }
  
  /**
   * Get current environment
   */
  static getCurrentEnvironment(): 'development' | 'testing' | 'production' {
    const env = process.env.NODE_ENV || process.env.SKER_ENV || 'development';
    
    if (env === 'test' || env === 'testing') {
      return 'testing';
    } else if (env === 'prod' || env === 'production') {
      return 'production';
    } else {
      return 'development';
    }
  }
  
  /**
   * Get Sker home directory
   */
  static getSkerHomeDir(): string {
    return process.env.SKER_HOME_DIR || path.join(os.homedir(), '.sker');
  }
  
  /**
   * Get configuration directory
   */
  static getConfigDir(): string {
    return process.env.SKER_CONFIG_DIR || path.join(EnvironmentConfigProcessor.getSkerHomeDir(), 'config');
  }
  
  /**
   * Get log directory
   */
  static getLogDir(): string {
    return process.env.SKER_LOG_DIR || path.join(EnvironmentConfigProcessor.getSkerHomeDir(), 'logs');
  }
  
  /**
   * Get plugin directory
   */
  static getPluginDir(): string {
    return process.env.SKER_PLUGIN_DIR || path.join(EnvironmentConfigProcessor.getSkerHomeDir(), 'plugins');
  }
  
  /**
   * Process special directory configurations
   */
  static processDirectoryConfig(config: Partial<Config>): Partial<Config> {
    const processed = { ...config } as any;
    
    // Update plugin directories if relative paths are used
    if (processed.plugins?.discovery?.directories) {
      processed.plugins.discovery.directories = processed.plugins.discovery.directories.map((dir: string) => {
        if (!path.isAbsolute(dir)) {
          return path.join(EnvironmentConfigProcessor.getSkerHomeDir(), dir);
        }
        return dir;
      });
    }
    
    // Clean up special internal properties
    delete processed._skerHomeDir;
    delete processed._configDir;
    delete processed._logDir;
    
    return processed;
  }
  
  /**
   * Create complete environment-based configuration
   */
  static createEnvironmentConfig(): Config {
    // Start with defaults
    const defaults = ConfigValidator.getDefaults();
    
    // Apply environment template
    const envTemplate = EnvironmentConfigProcessor.getEnvironmentTemplate();
    
    // Load from environment variables
    const envConfig = EnvironmentConfigProcessor.loadFromEnvironment();
    
    // Process directory configurations
    const processedEnvConfig = EnvironmentConfigProcessor.processDirectoryConfig(envConfig);
    
    // Merge configurations: defaults < environment template < environment variables
    const merged = ConfigMerger.mergeConfigs(defaults, envTemplate, processedEnvConfig);
    
    // Validate and return
    return ConfigValidator.validateConfig(merged);
  }
  
  /**
   * Get all environment variables with SKER prefix
   */
  static getSkerEnvironmentVariables(): Record<string, string> {
    const skerVars: Record<string, string> = {};
    
    for (const key in process.env) {
      if (key.startsWith(EnvironmentConfigProcessor.ENV_PREFIX)) {
        skerVars[key] = process.env[key] as string;
      }
    }
    
    // Also include NODE_ENV
    if (process.env.NODE_ENV) {
      skerVars.NODE_ENV = process.env.NODE_ENV;
    }
    
    return skerVars;
  }
  
  /**
   * Validate environment configuration
   */
  static validateEnvironmentConfig(): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      const config = EnvironmentConfigProcessor.createEnvironmentConfig();
      
      // Additional environment-specific validations
      const env = EnvironmentConfigProcessor.getCurrentEnvironment();
      
      if (env === 'production') {
        // Production-specific validations
        if (config.environment.settings?.development?.enabled) {
          warnings.push('Development mode is enabled in production environment');
        }
        
        if (config.logging.level === 'debug' || config.logging.level === 'verbose' || config.logging.level === 'silly') {
          warnings.push(`Verbose logging level '${config.logging.level}' in production may impact performance`);
        }
        
        if (!config.security.authentication && !config.security.authorization) {
          warnings.push('Security features are disabled in production');
        }
      }
      
      if (env === 'development') {
        // Development-specific validations
        if (config.security.authentication || config.security.authorization) {
          warnings.push('Security features are enabled in development (may not be necessary)');
        }
      }
      
      return { valid: true, errors, warnings };
      
    } catch (error) {
      if (error instanceof Error) {
        errors.push(`Configuration validation failed: ${error.message}`);
      } else {
        errors.push('Configuration validation failed with unknown error');
      }
      
      return { valid: false, errors, warnings };
    }
  }
  
  /**
   * Generate environment configuration documentation
   */
  static generateEnvironmentDocs(): string {
    const docs: string[] = [
      '# Sker Daemon Environment Variables',
      '',
      'This document lists all supported environment variables for configuring Sker Daemon.',
      '',
      '## Environment Variables',
      ''
    ];
    
    const categories: Record<string, EnvMapping[]> = {};
    
    // Group mappings by category
    for (const mapping of EnvironmentConfigProcessor.ENV_MAPPINGS) {
      const category = mapping.configPath.split('.')[0];
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(mapping);
    }
    
    // Generate documentation for each category
    for (const [category, mappings] of Object.entries(categories)) {
      docs.push(`### ${category.toUpperCase()} Configuration`);
      docs.push('');
      
      for (const mapping of mappings) {
        docs.push(`- **${mapping.envVar}**: ${mapping.configPath}`);
        if (mapping.defaultValue !== undefined) {
          docs.push(`  - Default: ${mapping.defaultValue}`);
        }
        if (mapping.transform) {
          docs.push(`  - Type: ${mapping.transform.name}`);
        }
      }
      
      docs.push('');
    }
    
    return docs.join('\n');
  }
  
  // === Private Helper Methods ===
  
  /**
   * Parse boolean value from string
   */
  private static parseBoolean(value: string): boolean {
    return value.toLowerCase() === 'true' || value === '1';
  }
  
  /**
   * Parse array value from string
   */
  private static parseArray(value: string): string[] {
    return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
  }
  
  /**
   * Parse number or string value
   */
  private static parseNumberOrString(value: string): number | string {
    const num = parseInt(value, 10);
    return isNaN(num) ? value : num;
  }
  
  /**
   * Set nested value in object using dot notation
   */
  private static setNestedValue(obj: any, path: string, value: any): void {
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
}

/**
 * Environment configuration utilities
 */
export const EnvironmentUtils = {
  /**
   * Check if running in development mode
   */
  isDevelopment: (): boolean => EnvironmentConfigProcessor.getCurrentEnvironment() === 'development',
  
  /**
   * Check if running in production mode
   */
  isProduction: (): boolean => EnvironmentConfigProcessor.getCurrentEnvironment() === 'production',
  
  /**
   * Check if running in testing mode
   */
  isTesting: (): boolean => EnvironmentConfigProcessor.getCurrentEnvironment() === 'testing',
  
  /**
   * Get environment name
   */
  getEnvironment: (): string => EnvironmentConfigProcessor.getCurrentEnvironment(),
  
  /**
   * Get all Sker directories
   */
  getDirectories: () => ({
    home: EnvironmentConfigProcessor.getSkerHomeDir(),
    config: EnvironmentConfigProcessor.getConfigDir(),
    logs: EnvironmentConfigProcessor.getLogDir(),
    plugins: EnvironmentConfigProcessor.getPluginDir()
  }),
  
  /**
   * Ensure all Sker directories exist
   */
  ensureDirectories: (): void => {
    const dirs = EnvironmentUtils.getDirectories();
    const fs = require('fs');
    
    for (const [name, dir] of Object.entries(dirs)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        console.warn(`Failed to create ${name} directory: ${dir}`, error);
      }
    }
  }
};

/**
 * Get processed environment configuration (lazy evaluation)
 */
export const getProcessedEnvConfig = () => EnvironmentConfigProcessor.createEnvironmentConfig();