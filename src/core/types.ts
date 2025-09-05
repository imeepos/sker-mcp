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

// Re-export MCP SDK types for use in other modules
export type {
  CallToolRequest,
  ReadResourceRequest,
  GetPromptRequest
} from '@modelcontextprotocol/sdk/types.js';

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

// ==================== Feature Injector Types ====================

/**
 * Plugin isolation levels
 */
export enum IsolationLevel {
  /** No isolation - direct access to parent container */
  NONE = 'none',
  /** Service isolation - separate service instances */
  SERVICE = 'service', 
  /** Full isolation - completely separate container */
  FULL = 'full'
}

/**
 * Plugin resource access permissions
 */
export interface PluginPermissions {
  /** Can access parent container services */
  parentServices: boolean;
  /** Can register global services */
  globalRegistration: boolean;
  /** Can access other plugins */
  crossPluginAccess: boolean;
  /** Can modify core system services */
  coreSystemAccess: boolean;
  /** Custom permission flags */
  custom?: Record<string, boolean>;
}

/**
 * Plugin isolation configuration options
 */
export interface PluginIsolationOptions {
  /** Level of isolation to apply */
  isolationLevel?: IsolationLevel;
  /** Plugin permissions */
  permissions?: Partial<PluginPermissions>;
  /** Custom configuration */
  custom?: Record<string, any>;
}

/**
 * Plugin execution context
 */
export interface PluginContext {
  /** Plugin information */
  plugin: IPlugin;
  /** Plugin working directory */
  workingDirectory: string;
  /** Plugin configuration */
  config: PluginConfig;
  /** Environment variables */
  environment: Record<string, string>;
}

/**
 * Communication bridge between parent and child containers
 */
export interface PluginCommunicationBridge {
  /** Request service from parent container */
  requestFromParent<T>(token: any): Promise<T | null>;
  /** Provide service to parent container */
  provideToParent<T>(token: any, provider: any): Promise<void>;
  /** Get service from child container */
  getFromChild<T>(token: any): Promise<T | null>;
  /** Send message between containers */
  sendMessage(target: 'parent' | 'child', message: any): Promise<any>;
}

/**
 * Container interface for dependency injection
 */
export interface Container {
  /** DI injector instance */
  injector?: any;
  /** Container providers */
  providers: any[];
  /** Optional dispose method */
  dispose?(): Promise<void>;
}

/**
 * Isolated plugin instance
 */
export interface IsolatedPluginInstance {
  /** Original plugin */
  readonly plugin: IPlugin;
  /** Isolated container */
  readonly container: Container;
  /** Isolated injector */
  readonly injector: any;
  /** Communication bridge */
  readonly bridge: PluginCommunicationBridge;
  /** Plugin permissions */
  readonly permissions: PluginPermissions;
  /** Isolation level */
  readonly isolationLevel: IsolationLevel;
  
  /** Get service from plugin's isolated container */
  getService<T>(token: any): Promise<T>;
  /** Check if plugin has specific permission */
  hasPermission(permission: keyof PluginPermissions): boolean;
  /** Destroy the isolated plugin instance */
  destroy(): Promise<void>;
}

/**
 * Feature Injector interface for plugin isolation
 */
export interface IFeatureInjector {
  /** Create isolated plugin instance */
  createIsolatedPlugin(plugin: IPlugin, options?: PluginIsolationOptions): Promise<IsolatedPluginInstance>;
  /** Get isolated plugin instance */
  getIsolatedPlugin(pluginName: string, version?: string): IsolatedPluginInstance | null;
  /** List all isolated plugins */
  listIsolatedPlugins(): IsolatedPluginInstance[];
  /** Remove isolated plugin */
  removeIsolatedPlugin(pluginName: string, version?: string): Promise<boolean>;
  /** Get isolation statistics */
  getIsolationStats(): {
    totalIsolatedPlugins: number;
    isolationLevels: Record<IsolationLevel, number>;
    memoryUsage?: number;
  };
  /** Cleanup all isolated plugins */
  cleanup(): Promise<void>;
}

/**
 * Enhanced plugin interface with providers support
 */
export interface IEnhancedPlugin extends IPlugin {
  /** Dependency injection providers for the plugin */
  providers?: any[];
  /** Plugin trust level */
  trustLevel?: 'untrusted' | 'trusted' | 'system';
  /** Plugin isolation configuration */
  isolationConfig?: PluginIsolationOptions;
}