/**
 * Core Type Definitions
 * 
 * This module defines all the core interfaces, types, and enums used throughout
 * the Sker Daemon MCP system. These types provide type safety and ensure
 * consistency across the entire architecture.
 */

import type { 
  Tool, 
  Resource, 
  Prompt,
  CallToolRequest,
  ReadResourceRequest,
  GetPromptRequest
} from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';

// ==================== MCP Interface Types ====================

/**
 * Core MCP Tool interface extending the base MCP Tool type
 */
export interface IMcpTool extends Tool {
  /**
   * Tool handler function
   */
  handler: (request: CallToolRequest) => Promise<any>;
  
  /**
   * Optional middleware for the tool
   */
  middleware?: string[];
  
  /**
   * Optional error handler for the tool
   */
  errorHandler?: (error: Error, request: CallToolRequest) => Promise<any>;
}

/**
 * Core MCP Resource interface extending the base MCP Resource type
 */
export interface IMcpResource extends Resource {
  /**
   * Resource handler function
   */
  handler: (request: ReadResourceRequest) => Promise<any>;
  
  /**
   * Optional middleware for the resource
   */
  middleware?: string[];
  
  /**
   * Optional error handler for the resource
   */
  errorHandler?: (error: Error, request: ReadResourceRequest) => Promise<any>;
}

/**
 * Core MCP Prompt interface extending the base MCP Prompt type
 */
export interface IMcpPrompt extends Prompt {
  /**
   * Prompt handler function
   */
  handler: (request: GetPromptRequest) => Promise<any>;
  
  /**
   * Optional middleware for the prompt
   */
  middleware?: string[];
  
  /**
   * Optional error handler for the prompt
   */
  errorHandler?: (error: Error, request: GetPromptRequest) => Promise<any>;
}

// ==================== Plugin Interface Types ====================

/**
 * Plugin status enumeration
 */
export enum PluginStatus {
  LOADING = 'loading',
  LOADED = 'loaded',
  FAILED = 'failed',
  UNLOADED = 'unloaded'
}

/**
 * Core Plugin interface
 */
export interface IPlugin {
  /**
   * Plugin name (must be unique)
   */
  name: string;
  
  /**
   * Plugin version
   */
  version: string;
  
  /**
   * Plugin description
   */
  description: string;
  
  /**
   * Plugin author
   */
  author?: string;
  
  /**
   * Plugin dependencies
   */
  dependencies?: string[];
  
  /**
   * Plugin service classes to be registered
   */
  services: Array<new (...args: any[]) => any>;
  
  /**
   * Plugin configuration schema (Zod schema)
   */
  configSchema?: z.ZodSchema<any>;
  
  /**
   * Plugin lifecycle hooks
   */
  hooks?: {
    onLoad?: () => Promise<void> | void;
    onUnload?: () => Promise<void> | void;
    onEnable?: () => Promise<void> | void;
    onDisable?: () => Promise<void> | void;
  };
}

/**
 * Plugin Manager interface
 */
export interface IPluginManager {
  /**
   * Load a plugin by name
   */
  loadPlugin(pluginName: string): Promise<IPlugin>;
  
  /**
   * Unload a plugin by name
   */
  unloadPlugin(pluginName: string): Promise<void>;
  
  /**
   * Reload a plugin by name
   */
  reloadPlugin(pluginName: string): Promise<IPlugin>;
  
  /**
   * Get all active plugins
   */
  getActivePlugins(): IPlugin[];
  
  /**
   * Get plugin status
   */
  getPluginStatus(pluginName: string): PluginStatus;
  
  /**
   * Check if a plugin is loaded
   */
  isPluginLoaded(pluginName: string): boolean;
}

// ==================== Configuration Interface Types ====================

/**
 * MCP Server configuration interface
 */
export interface IMcpServerConfig {
  /**
   * Server name
   */
  name: string;
  
  /**
   * Server version
   */
  version: string;
  
  /**
   * Transport configuration
   */
  transport: {
    type: 'stdio' | 'http';
    host?: string;
    port?: number;
  };
  
  /**
   * Server capabilities
   */
  capabilities: {
    tools?: Record<string, any>;
    resources?: Record<string, any>;
    prompts?: Record<string, any>;
  };
  
  /**
   * Optional server configuration
   */
  logging?: {
    level: string;
    format?: string;
  };
  
  /**
   * Plugin configuration
   */
  plugins?: {
    enabled: string[];
    disabled?: string[];
    config?: Record<string, any>;
  };
}

// ==================== Metadata Interface Types ====================

/**
 * Tool metadata for registration and management
 */
export interface ToolMetadata {
  /**
   * Tool name
   */
  name: string;
  
  /**
   * Tool description
   */
  description: string;
  
  /**
   * Input schema for validation
   */
  inputSchema: z.ZodSchema<any>;
  
  /**
   * Service class that provides this tool
   */
  serviceClass: new (...args: any[]) => any;
  
  /**
   * Method name in the service class
   */
  methodName: string;
  
  /**
   * Middleware to apply
   */
  middleware: string[];
  
  /**
   * Error handler if specified
   */
  errorHandler?: string;
}

/**
 * Resource metadata for registration and management
 */
export interface ResourceMetadata {
  /**
   * Resource URI template
   */
  uri: string;
  
  /**
   * Resource name
   */
  name: string;
  
  /**
   * Resource description
   */
  description: string;
  
  /**
   * Resource MIME type
   */
  mimeType?: string;
  
  /**
   * Service class that provides this resource
   */
  serviceClass: new (...args: any[]) => any;
  
  /**
   * Method name in the service class
   */
  methodName: string;
  
  /**
   * Middleware to apply
   */
  middleware: string[];
  
  /**
   * Error handler if specified
   */
  errorHandler?: string;
}

/**
 * Prompt metadata for registration and management
 */
export interface PromptMetadata {
  /**
   * Prompt name
   */
  name: string;
  
  /**
   * Prompt description
   */
  description: string;
  
  /**
   * Prompt arguments schema
   */
  arguments?: z.ZodSchema<any>;
  
  /**
   * Service class that provides this prompt
   */
  serviceClass: new (...args: any[]) => any;
  
  /**
   * Method name in the service class
   */
  methodName: string;
  
  /**
   * Middleware to apply
   */
  middleware: string[];
  
  /**
   * Error handler if specified
   */
  errorHandler?: string;
}

// ==================== Utility Types ====================

/**
 * Service constructor type
 */
export type ServiceConstructor<T = any> = new (...args: any[]) => T;

/**
 * Middleware function type
 */
export type MiddlewareFunction = (context: any, next: () => Promise<any>) => Promise<any>;

/**
 * Error handler function type
 */
export type ErrorHandlerFunction = (error: Error, context: any) => Promise<any>;

/**
 * Plugin configuration type
 */
export type PluginConfig = Record<string, any>;

/**
 * Service instance registry type
 */
export type ServiceInstanceRegistry = Map<ServiceConstructor, any>;