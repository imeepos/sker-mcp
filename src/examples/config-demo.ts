/**
 * Configuration System Demo
 * 
 * This demo showcases the key features of the Sker Daemon configuration management system.
 * It demonstrates schema validation, environment processing, plugin configuration,
 * hot reload capabilities, and integration with the dependency injection system.
 */

import {
  ConfigurationSystem,
  ConfigValidator,
  EnvironmentConfigProcessor,
  EnvironmentUtils,
  PluginConfigManager,
  PluginIsolationLevel
} from '../core/config/index.js';

/**
 * Configuration System Demo
 */
export class ConfigDemo {
  private configSystem: ConfigurationSystem;
  
  constructor() {
    this.configSystem = ConfigurationSystem.getInstance();
  }
  
  /**
   * Run complete configuration demo
   */
  async runDemo(): Promise<void> {
    console.log('🔧 Sker Daemon Configuration Management System Demo');
    console.log('==================================================\n');
    
    try {
      // Initialize configuration system
      await this.initializeDemo();
      
      // Demonstrate core features
      await this.demonstrateSchemaValidation();
      await this.demonstrateEnvironmentProcessing();
      await this.demonstrateConfigurationLayers();
      await this.demonstratePluginConfiguration();
      await this.demonstrateRuntimeUpdates();
      await this.demonstrateFileOperations();
      await this.demonstrateHotReload();
      
      console.log('✅ Configuration system demo completed successfully!');
      
    } catch (error) {
      console.error('❌ Demo failed:', error);
      throw error;
    }
  }
  
  /**
   * Initialize configuration demo
   */
  private async initializeDemo(): Promise<void> {
    console.log('📋 1. Initializing Configuration System');
    console.log('--------------------------------------');
    
    await this.configSystem.initialize();
    
    const config = this.configSystem.getConfig();
    console.log(`✓ Configuration loaded successfully`);
    console.log(`  - Environment: ${config.environment.environment}`);
    console.log(`  - Server Name: ${config.server.name}`);
    console.log(`  - Log Level: ${config.logging.level}`);
    console.log(`  - Plugin Directories: ${config.plugins.discovery.directories.join(', ')}`);
    console.log();
  }
  
  /**
   * Demonstrate schema validation
   */
  private async demonstrateSchemaValidation(): Promise<void> {
    console.log('🔍 2. Schema Validation Demo');
    console.log('----------------------------');
    
    // Valid configuration
    const validConfig = {
      version: '1.0.0',
      server: { name: 'demo-server', version: '1.0.0' },
      logging: { level: 'info' as const },
      plugins: { discovery: { directories: ['plugins'] } }
    };
    
    try {
      const validated = ConfigValidator.validateConfig(validConfig);
      console.log('✓ Valid configuration passed validation');
      console.log(`  - Validated server name: ${validated.server.name}`);
    } catch (error) {
      console.log('❌ Valid configuration failed validation:', error);
    }
    
    // Invalid configuration
    const invalidConfig = {
      server: { name: 123 }, // Should be string
      logging: { level: 'invalid-level' }
    };
    
    const result = ConfigValidator.safeValidateConfig(invalidConfig);
    if (!result.success) {
      console.log('✓ Invalid configuration correctly rejected');
      console.log(`  - Validation errors detected: ${result.error.issues.length} issues`);
    }
    
    // Demonstrate defaults
    const defaults = ConfigValidator.getDefaults();
    console.log('✓ Configuration defaults loaded');
    console.log(`  - Default server name: ${defaults.server.name}`);
    console.log(`  - Default log level: ${defaults.logging.level}`);
    console.log();
  }
  
  /**
   * Demonstrate environment processing
   */
  private async demonstrateEnvironmentProcessing(): Promise<void> {
    console.log('🌍 3. Environment Processing Demo');
    console.log('----------------------------------');
    
    const environment = EnvironmentUtils.getEnvironment();
    console.log(`✓ Current environment: ${environment}`);
    console.log(`  - Is development: ${EnvironmentUtils.isDevelopment()}`);
    console.log(`  - Is production: ${EnvironmentUtils.isProduction()}`);
    console.log(`  - Is testing: ${EnvironmentUtils.isTesting()}`);
    
    const directories = EnvironmentUtils.getDirectories();
    console.log('✓ Environment directories:');
    console.log(`  - Home: ${directories.home}`);
    console.log(`  - Config: ${directories.config}`);
    console.log(`  - Logs: ${directories.logs}`);
    console.log(`  - Plugins: ${directories.plugins}`);
    
    // Show environment variables
    const skerVars = EnvironmentConfigProcessor.getSkerEnvironmentVariables();
    const skerVarCount = Object.keys(skerVars).length;
    console.log(`✓ Sker environment variables found: ${skerVarCount}`);
    
    if (skerVarCount > 0) {
      console.log('  Environment variables:');
      Object.entries(skerVars).forEach(([key, value]) => {
        console.log(`    ${key}=${value}`);
      });
    }
    
    console.log();
  }
  
  /**
   * Demonstrate configuration layers
   */
  private async demonstrateConfigurationLayers(): Promise<void> {
    console.log('📚 4. Configuration Layers Demo');
    console.log('-------------------------------');
    
    const configManager = this.configSystem.getConfigManager();
    const sources = configManager.getSourcesInfo();
    
    console.log('✓ Configuration sources (in priority order):');
    sources.sort((a, b) => a.priority - b.priority).forEach(source => {
      console.log(`  - ${source.key} (${source.source}) - Priority: ${source.priority}`);
      console.log(`    Last updated: ${source.lastUpdate.toISOString()}`);
    });
    
    // Demonstrate runtime updates
    console.log('\n✓ Adding runtime configuration...');
    const currentConfig = configManager.getConfig();
    configManager.updateConfig({
      server: { ...currentConfig.server, name: 'demo-runtime-server' }
    }, 'demo-runtime');
    
    const updatedConfig = configManager.getConfig();
    console.log(`  - Server name updated to: ${updatedConfig.server.name}`);
    
    const updatedSources = configManager.getSourcesInfo();
    console.log(`  - Configuration sources now: ${updatedSources.length}`);
    console.log();
  }
  
  /**
   * Demonstrate plugin configuration
   */
  private async demonstratePluginConfiguration(): Promise<void> {
    console.log('🔌 5. Plugin Configuration Demo');
    console.log('-------------------------------');
    
    const pluginConfigManager = this.configSystem.getPluginConfigManager();
    
    // Register a demo plugin
    const pluginName = 'demo-plugin';
    const pluginSchema = {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        apiUrl: { type: 'string' },
        timeout: { type: 'number' }
      }
    };
    const pluginDefaults = {
      enabled: true,
      apiUrl: 'https://api.example.com',
      timeout: 5000
    };
    
    pluginConfigManager.registerPluginSchema(pluginName, pluginSchema, pluginDefaults);
    console.log(`✓ Registered plugin schema for: ${pluginName}`);
    
    // Get plugin configuration
    let pluginConfig = pluginConfigManager.getPluginConfig(pluginName);
    console.log(`✓ Plugin configuration loaded:`, pluginConfig);
    
    // Update plugin configuration
    const newPluginConfig = {
      enabled: true,
      apiUrl: 'https://demo-api.example.com',
      timeout: 10000,
      customSetting: 'demo-value'
    };
    
    pluginConfigManager.setPluginConfig(pluginName, newPluginConfig);
    pluginConfig = pluginConfigManager.getPluginConfig(pluginName);
    console.log(`✓ Plugin configuration updated:`, pluginConfig);
    
    // Demonstrate isolation levels
    console.log('\n✓ Plugin isolation management:');
    const currentIsolation = pluginConfigManager.getPluginIsolationLevel(pluginName);
    console.log(`  - Current isolation level: ${currentIsolation}`);
    
    pluginConfigManager.setPluginIsolationLevel(pluginName, PluginIsolationLevel.FULL);
    const newIsolation = pluginConfigManager.getPluginIsolationLevel(pluginName);
    console.log(`  - Updated isolation level: ${newIsolation}`);
    
    // Show all plugin configurations
    const allPluginConfigs = pluginConfigManager.getAllPluginConfigs();
    console.log(`✓ Total plugin configurations: ${allPluginConfigs.size}`);
    
    console.log();
  }
  
  /**
   * Demonstrate runtime updates
   */
  private async demonstrateRuntimeUpdates(): Promise<void> {
    console.log('⚡ 6. Runtime Configuration Updates');
    console.log('-----------------------------------');
    
    const configManager = this.configSystem.getConfigManager();
    
    // Set up change listener
    configManager.on('configChanged', (event) => {
      console.log(`✓ Configuration changed by: ${event.source}`);
      console.log(`  - Changed paths: ${event.changes.join(', ')}`);
    });
    
    // Update by path
    console.log('✓ Updating configuration by path...');
    configManager.setConfigValue('server.version', '2.0.0');
    
    // Bulk update
    console.log('✓ Performing bulk configuration update...');
    const currentConfig2 = configManager.getConfig();
    configManager.updateConfig({
      logging: {
        ...currentConfig2.logging,
        level: 'debug' as const,
        format: 'dev' as const
      },
      server: {
        ...currentConfig2.server,
        capabilities: {
          ...currentConfig2.server.capabilities,
          experimental: true
        }
      }
    }, 'demo-bulk-update');
    
    const finalConfig = configManager.getConfig();
    console.log(`✓ Final configuration state:`);
    console.log(`  - Server version: ${finalConfig.server.version}`);
    console.log(`  - Log level: ${finalConfig.logging.level}`);
    console.log(`  - Experimental features: ${finalConfig.server.capabilities.experimental}`);
    
    console.log();
  }
  
  /**
   * Demonstrate file operations
   */
  private async demonstrateFileOperations(): Promise<void> {
    console.log('📁 7. File Operations Demo');
    console.log('--------------------------');
    
    const configManager = this.configSystem.getConfigManager();
    const pluginConfigManager = this.configSystem.getPluginConfigManager();
    
    try {
      // Export main configuration
      const exportPath = './demo-config-export.json';
      await configManager.exportConfiguration(exportPath);
      console.log(`✓ Configuration exported to: ${exportPath}`);
      
      // Demonstrate plugin config directories
      const pluginConfigDirs = pluginConfigManager.getPluginConfigDirectories();
      console.log('✓ Plugin configuration directories:');
      pluginConfigDirs.forEach(dir => {
        console.log(`  - ${dir}`);
      });
      
      console.log('✓ File operations completed successfully');
      
    } catch (error) {
      console.log('⚠️  File operations demo (expected in test environment)');
      console.log(`    Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    console.log();
  }
  
  /**
   * Demonstrate hot reload capabilities
   */
  private async demonstrateHotReload(): Promise<void> {
    console.log('🔥 8. Hot Reload Demo');
    console.log('--------------------');
    
    const configManager = this.configSystem.getConfigManager();
    
    if (EnvironmentUtils.isDevelopment()) {
      console.log('✓ Development environment detected - hot reload is available');
      
      // Set up file change listeners
      configManager.on('fileChanged', (event) => {
        console.log(`✓ Configuration file changed: ${event.filePath}`);
      });
      
      configManager.on('fileAdded', (event) => {
        console.log(`✓ Configuration file added: ${event.filePath}`);
      });
      
      configManager.on('fileRemoved', (event) => {
        console.log(`✓ Configuration file removed: ${event.filePath}`);
      });
      
      configManager.enableHotReload();
      console.log('✓ Hot reload enabled - configuration files are being watched');
      
    } else {
      console.log('⚠️  Hot reload is disabled in non-development environments');
    }
    
    console.log();
  }
}

/**
 * Run configuration demo if this file is executed directly
 */
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('config-demo.ts')) {
  const demo = new ConfigDemo();
  demo.runDemo().catch(console.error);
}