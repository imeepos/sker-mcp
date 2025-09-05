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
import {
  MCP_SERVER_CONFIG,
  MCP_TOOLS,
  MCP_RESOURCES,
  MCP_PROMPTS,
  SERVICE_MANAGER,
  PROJECT_MANAGER,
  PLUGIN_MANAGER,
  MIDDLEWARE_EXECUTOR,
  ERROR_MANAGER,
  LOGGER,
  LOGGER_CONFIG,
  LOGGER_FACTORY,
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
    
    // Logger configuration provider - uses typed LoggerConfig interface
    {
      provide: LOGGER_CONFIG,
      useValue: {
        level: 'info',
        format: 'json',
        transports: {
          console: {
            enabled: true,
            level: 'info'
          },
          file: {
            enabled: true,
            level: 'debug',
            filename: 'sker-daemon.log'
          }
        }
      } as LoggerConfig
    },
    
    // Logger factory provider - placeholder for now
    {
      provide: LOGGER_FACTORY,
      useClass: class LoggerFactoryPlaceholder {
        constructor() {
          // Placeholder implementation
        }
      }
    },
    
    // Main logger provider - using console logger
    {
      provide: LOGGER,
      useClass: ConsoleLogger
    }
  ];
}