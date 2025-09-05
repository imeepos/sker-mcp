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
/**
 * Token for the main service manager
 */
export const SERVICE_MANAGER = new InjectionToken<any>('SERVICE_MANAGER');

/**
 * Token for the project directory manager
 */
export const PROJECT_MANAGER = new InjectionToken<any>('PROJECT_MANAGER');

/**
 * Token for the plugin management system
 */
export const PLUGIN_MANAGER = new InjectionToken<any>('PLUGIN_MANAGER');

/**
 * Token for the middleware executor
 */
export const MIDDLEWARE_EXECUTOR = new InjectionToken<any>('MIDDLEWARE_EXECUTOR');

/**
 * Token for the error manager
 */
export const ERROR_MANAGER = new InjectionToken<any>('ERROR_MANAGER');

// === Logger Tokens ===
/**
 * Token for the main logger instance
 */
export const LOGGER = new InjectionToken<any>('LOGGER');

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
 * Token for logger factory
 */
export const LOGGER_FACTORY = new InjectionToken<any>('LOGGER_FACTORY');

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