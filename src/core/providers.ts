/**
 * Provider Configuration Factory
 * 
 * This module provides factory functions to create dependency injection providers
 * for the Sker Daemon MCP system. It configures both MCP-specific providers
 * and platform-level providers.
 * 
 * Updated to use typed injection tokens for better type safety.
 */

import type { Provider } from '@sker/di';
import { Injector } from '@sker/di';
import {
  MCP_SERVER_CONFIG,
  MCP_TOOLS,
  MCP_RESOURCES,
  MCP_PROMPTS,
  SERVICE_MANAGER,
  PROJECT_MANAGER,
  PLUGIN_MANAGER,
  MIDDLEWARE_EXECUTOR,
  FEATURE_INJECTOR,
  PLUGIN_CONFLICT_DETECTOR,
  PLUGIN_ISOLATION_OPTIONS,
  PLUGIN_SYSTEM_CONFIG,
  ERROR_MANAGER,
  LOGGER,
  LOGGER_CONFIG,
  LOGGER_FACTORY,
  LAYERED_LOGGER_FACTORY,
  CONFIG_MANAGER,
  PLUGIN_CONFIG_MANAGER,
  CONFIGURATION_SYSTEM,
  ENVIRONMENT_CONFIG_PROCESSOR,
  APP_CONFIG,
  SERVER_CONFIG,
  LOGGING_CONFIG,
  PLUGIN_CONFIG,
  APP_NAME,
  type McpServerConfig,
  type McpToolDefinition,
  type McpResourceDefinition,
  type McpPromptDefinition,
  type LoggerConfig
} from './tokens.js';
import { ServiceManager } from './service-manager.js';
import { ProjectManager } from './project-manager.js';
import { PluginManager } from './plugin-manager.js';
import { ConsoleLogger } from './console-logger.js';
import { MiddlewareExecutor } from './middleware/index.js';
import { ErrorManager } from './errors/index.js';

/**
 * Default MCP server configuration
 * Now uses the typed McpServerConfig interface
 */
const DEFAULT_MCP_CONFIG: McpServerConfig = {
  name: 'sker-daemon-mcp',
  version: '1.0.0',
  transport: {
    type: 'stdio' as const
  },
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
};

/**
 * Creates MCP-specific providers for tools, resources, prompts, and server configuration.
 * These providers support multi-injection for collections and provide default configurations.
 * 
 * Now uses typed injection tokens with factory functions for better type safety.
 * Collections use factory functions to return empty arrays as defaults.
 * 
 * @returns Array of providers for MCP components
 */
export function createMcpProviders(): Provider[] {
  return [
    // MCP Server Configuration Provider - uses InjectionToken with factory
    {
      provide: MCP_SERVER_CONFIG,
      useValue: DEFAULT_MCP_CONFIG
    },
    
    // MCP Tools Collection Provider - supports multi-injection with type safety
    {
      provide: MCP_TOOLS,
      useValue: [] as McpToolDefinition[],
      multi: true
    },
    
    // MCP Resources Collection Provider - supports multi-injection with type safety
    {
      provide: MCP_RESOURCES,
      useValue: [] as McpResourceDefinition[],
      multi: true
    },
    
    // MCP Prompts Collection Provider - supports multi-injection with type safety
    {
      provide: MCP_PROMPTS,
      useValue: [] as McpPromptDefinition[],
      multi: true
    }
  ];
}

/**
 * Creates platform-level providers for managers, logging, and application infrastructure.
 * These providers use class-based injection and factory functions where appropriate.
 * 
 * @returns Array of providers for platform components
 */
export function createPlatformProviders(): Provider[] {
  return [
    // Application name for logging and identification
    {
      provide: APP_NAME,
      useValue: 'sker-mcp'
    },
    
    // Manager class providers - using actual implementations
    {
      provide: SERVICE_MANAGER,
      useClass: ServiceManager
    },
    
    {
      provide: PROJECT_MANAGER,
      useClass: ProjectManager
    },
    
    {
      provide: PLUGIN_MANAGER,
      useClass: PluginManager
    },
    
    {
      provide: MIDDLEWARE_EXECUTOR,
      useClass: MiddlewareExecutor
    },
    
    {
      provide: ERROR_MANAGER,
      useClass: ErrorManager
    },
    
    // Logger configuration provider - uses environment-based configuration
    {
      provide: LOGGER_CONFIG,
      useFactory: () => {
        const { getLoggingConfig } = require('./logging/logging-config.js');
        return getLoggingConfig();
      }
    },
    
    // Winston Logger Factory provider
    {
      provide: LOGGER_FACTORY,
      useFactory: (config: any, projectManager: any) => {
        const { WinstonLoggerFactory } = require('./logging/winston-logger.js');
        return new WinstonLoggerFactory(config, projectManager);
      },
      deps: [LOGGER_CONFIG, PROJECT_MANAGER]
    },
    
    // Layered Logger Factory provider
    {
      provide: LAYERED_LOGGER_FACTORY,
      useFactory: (config: any, projectManager: any) => {
        const { LayeredLoggerFactory } = require('./logging/layered-logger.js');
        return new LayeredLoggerFactory(config, projectManager);
      },
      deps: [LOGGER_CONFIG, PROJECT_MANAGER]
    },
    
    // Main logger provider - using Layered logger system
    {
      provide: LOGGER,
      useFactory: (layeredLoggerFactory: any) => {
        const factory = layeredLoggerFactory as any;
        return factory.createPlatformLogger('system');
      },
      deps: [LAYERED_LOGGER_FACTORY]
    },
    
    // Plugin system providers
    ...createPluginSystemProviders(),
    
    // Configuration system providers
    ...createConfigurationProviders()
  ];
}

/**
 * Create plugin system providers
 */
function createPluginSystemProviders(): Provider[] {
  return [
    // Feature Injector provider
    {
      provide: FEATURE_INJECTOR,
      useFactory: (injector: any) => {
        const { FeatureInjector } = require('./plugins/feature-injector.js');
        return new FeatureInjector(injector);
      },
      deps: [Injector]
    },
    
    // Plugin Conflict Detector provider
    {
      provide: PLUGIN_CONFLICT_DETECTOR,
      useFactory: (logger: any) => {
        const { PluginConflictDetector } = require('./plugins/conflict-detector.js');
        return new PluginConflictDetector(logger);
      },
      deps: [LOGGER]
    },
    
    // Plugin Isolation Options provider
    {
      provide: PLUGIN_ISOLATION_OPTIONS,
      useValue: {
        isolationLevel: 'service',
        permissions: {
          parentServices: false,
          globalRegistration: false,
          crossPluginAccess: false,
          coreSystemAccess: false
        }
      }
    },
    
    // Plugin System Configuration provider
    {
      provide: PLUGIN_SYSTEM_CONFIG,
      useValue: {
        conflictDetection: {
          enabled: true,
          strategies: ['tool_name', 'resource_uri', 'prompt_name', 'service_class'],
          defaultResolution: 'manual',
          pluginPriorities: []
        },
        isolation: {
          defaultLevel: 'service',
          allowPrivilegeEscalation: false
        }
      }
    }
  ];
}

/**
 * Create configuration system providers
 */
function createConfigurationProviders(): Provider[] {
  return [
    // Environment Configuration Processor provider
    {
      provide: ENVIRONMENT_CONFIG_PROCESSOR,
      useFactory: () => {
        const { EnvironmentConfigProcessor } = require('./config/environment-config.js');
        return EnvironmentConfigProcessor;
      }
    },
    
    // Configuration Manager provider
    {
      provide: CONFIG_MANAGER,
      useFactory: () => {
        const { ConfigManager } = require('./config/config-manager.js');
        return new ConfigManager();
      }
    },
    
    // Plugin Configuration Manager provider
    {
      provide: PLUGIN_CONFIG_MANAGER,
      useFactory: (configManager: any) => {
        const { PluginConfigManager } = require('./config/plugin-config.js');
        return new PluginConfigManager(configManager);
      },
      deps: [CONFIG_MANAGER]
    },
    
    // Configuration System Factory provider
    {
      provide: CONFIGURATION_SYSTEM,
      useFactory: () => {
        const { ConfigurationSystem } = require('./config/index.js');
        return ConfigurationSystem.getInstance();
      }
    },
    
    // Application Configuration provider
    {
      provide: APP_CONFIG,
      useFactory: (configSystem: any) => {
        return configSystem.getConfig();
      },
      deps: [CONFIGURATION_SYSTEM]
    },
    
    // Server Configuration provider
    {
      provide: SERVER_CONFIG,
      useFactory: (configSystem: any) => {
        return configSystem.getConfig().server;
      },
      deps: [CONFIGURATION_SYSTEM]
    },
    
    // Logging Configuration provider
    {
      provide: LOGGING_CONFIG,
      useFactory: (configSystem: any) => {
        return configSystem.getConfig().logging;
      },
      deps: [CONFIGURATION_SYSTEM]
    },
    
    // Plugin Configuration provider
    {
      provide: PLUGIN_CONFIG,
      useFactory: (configSystem: any) => {
        return configSystem.getConfig().plugins;
      },
      deps: [CONFIGURATION_SYSTEM]
    }
  ];
}