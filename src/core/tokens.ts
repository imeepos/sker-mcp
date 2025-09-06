/**
 * Core Dependency Injection Tokens
 * 
 * This module defines all injection tokens used throughout the Sker Daemon MCP system.
 * Uses typed injection tokens from @sker/di for better type safety and IntelliSense support.
 * 
 * Token Types:
 * - InjectionToken<T>: Type-safe injection tokens with optional factory functions
 * - StringToken<T>: String-based tokens with type information  
 * - SymbolToken<T>: Symbol-based tokens with type information
 * 
 * Tokens are organized by functional areas:
 * - MCP Service tokens for core MCP protocol components
 * - Manager tokens for system managers
 * - Logger tokens for logging infrastructure
 */

import { InjectionToken, StringToken, SymbolToken } from '@sker/di';
import { Logger } from './console-logger';

// === Type Definitions ===
/**
 * MCP server configuration interface
 */
export interface McpServerConfig {
  name: string;
  version: string;
  transport: {
    type: 'stdio' | 'http';
    port?: number;
  };
  capabilities: {
    tools: Record<string, any>;
    resources: Record<string, any>;
    prompts: Record<string, any>;
  };
}

/**
 * MCP tool definition interface
 */
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  handler: (params: any) => Promise<any>;
}

/**
 * MCP resource definition interface
 */
export interface McpResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  handler: (uri: string) => Promise<any>;
}

/**
 * MCP prompt definition interface
 */
export interface McpPromptDefinition {
  name: string;
  description: string;
  arguments?: any[];
  handler: (args: any) => Promise<any>;
}

/**
 * Logger configuration interface
 */
export interface LoggerConfig {
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  format: 'json' | 'simple';
  transports: {
    console: {
      enabled: boolean;
      level: string;
    };
    file: {
      enabled: boolean;
      level: string;
      filename: string;
    };
  };
}

// === MCP Service Tokens ===
/**
 * Token for MCP server configuration
 */
export const MCP_SERVER_CONFIG = new InjectionToken<McpServerConfig>('MCP_SERVER_CONFIG', {
  factory: () => ({
    name: 'sker-daemon-mcp',
    version: '1.0.0',
    transport: { type: 'stdio' as const },
    capabilities: { tools: {}, resources: {}, prompts: {} }
  })
});
/**
 * Token for collection of MCP tools
 */
export const MCP_TOOLS = new InjectionToken<McpToolDefinition[]>('MCP_TOOLS', {
  factory: () => []
});

/**
 * Token for collection of MCP resources  
 */
export const MCP_RESOURCES = new InjectionToken<McpResourceDefinition[]>('MCP_RESOURCES', {
  factory: () => []
});

/**
 * Token for collection of MCP prompts
 */
export const MCP_PROMPTS = new InjectionToken<McpPromptDefinition[]>('MCP_PROMPTS', {
  factory: () => []
});

// === Manager Tokens ===

// === Logger Tokens ===
/**
 * Token for the main logger instance
 */
export const LOGGER = new InjectionToken<Logger>('LOGGER');

/**
 * Token for logger configuration
 */
export const LOGGER_CONFIG = new InjectionToken<LoggerConfig>('LOGGER_CONFIG', {
  factory: () => ({
    level: 'info',
    format: 'json',
    transports: {
      console: { enabled: true, level: 'info' },
      file: { enabled: true, level: 'debug', filename: 'sker-daemon.log' }
    }
  })
});


/**
 * Token for layered logger factory
 */
export const LAYERED_LOGGER_FACTORY = new InjectionToken<any>('LAYERED_LOGGER_FACTORY');

/**
 * Token for application name used in logging
 */
export const APP_NAME: StringToken<string> = 'APP_NAME';

// === Alternative Token Types (Examples) ===
/**
 * Example StringToken - useful for simple string identifiers
 */
export const APP_VERSION: StringToken<string> = 'APP_VERSION' as StringToken<string>;

/**
 * Example SymbolToken - useful for unique identifiers with type safety
 */
export const DEBUG_MODE: SymbolToken<boolean> = Symbol('DEBUG_MODE') as SymbolToken<boolean>;

// === Plugin System Tokens ===

/**
 * Token for Feature Injector service
 */
export const FEATURE_INJECTOR = new InjectionToken<any>('FEATURE_INJECTOR');

/**
 * Token for Plugin Conflict Detector service  
 */
export const PLUGIN_CONFLICT_DETECTOR = new InjectionToken<any>('PLUGIN_CONFLICT_DETECTOR');

/**
 * Token for Plugin Isolation Options
 */
export const PLUGIN_ISOLATION_OPTIONS = new InjectionToken<any>('PLUGIN_ISOLATION_OPTIONS');

/**
 * Token for Plugin System Configuration
 */
export const PLUGIN_SYSTEM_CONFIG = new InjectionToken<any>('PLUGIN_SYSTEM_CONFIG');

// === Configuration System Tokens ===

/**
 * Token for the main configuration manager
 */
export const CONFIG_MANAGER = new InjectionToken<any>('CONFIG_MANAGER');

/**
 * Token for plugin configuration manager
 */
export const PLUGIN_CONFIG_MANAGER = new InjectionToken<any>('PLUGIN_CONFIG_MANAGER');

/**
 * Token for configuration system factory
 */
export const CONFIGURATION_SYSTEM = new InjectionToken<any>('CONFIGURATION_SYSTEM');

/**
 * Token for environment configuration processor
 */
export const ENVIRONMENT_CONFIG_PROCESSOR = new InjectionToken<any>('ENVIRONMENT_CONFIG_PROCESSOR');

/**
 * Token for main application configuration
 */
export const APP_CONFIG = new InjectionToken<any>('APP_CONFIG');

/**
 * Token for server configuration
 */
export const SERVER_CONFIG = new InjectionToken<any>('SERVER_CONFIG');

/**
 * Token for logging configuration
 */
export const LOGGING_CONFIG = new InjectionToken<any>('LOGGING_CONFIG');

/**
 * Token for plugin configuration
 */
export const PLUGIN_CONFIG = new InjectionToken<any>('PLUGIN_CONFIG');