/**
 * Core Module Index
 * 
 * This module re-exports all core components of the Sker Daemon MCP system
 * for convenient importing by other modules and plugins according to
 * the unified import path standards.
 */

// Type definitions
export * from './types';

// Dependency injection tokens
export * from './tokens';

// Provider configuration
export * from './providers';

// Core managers
export { ProjectManager } from './project-manager';
export { ServiceManager } from './service-manager';
export { PluginManager } from './plugin-manager';
export { McpApplication, ApplicationStatus } from './mcp-application';
export type { IServiceManager } from './mcp-application';

// Metadata collection
export { MetadataCollector } from './metadata-collector';
export type { AllMetadata } from './metadata-collector';

// Decorators (aliased to match design docs)
export * from './decorators';
export { McpTool as Tool } from './decorators/mcp-tool';
export { McpResource as Resource } from './decorators/mcp-resource';  
export { McpPrompt as Prompt } from './decorators/mcp-prompt';

// Error handling system (selective exports to avoid conflicts)
export { ErrorManager, ErrorRecoveryManager, RetryStrategy } from './errors';
export { ErrorCategory, RecoveryStrategy } from './errors';
export type { 
  ErrorContext, 
  IErrorHandler as IErrorHandlerCore,
  RecoveryResult,
  RetryConfig as RetryConfigCore,
  CircuitBreakerConfig as CircuitBreakerConfigCore
} from './errors';

// Middleware system (selective exports)
export { MiddlewareExecutor } from './middleware';
export type { 
  MiddlewareContext,
  NextFunction,
  MiddlewareFunction as MiddlewareFunctionCore
} from './middleware';

// Logging system (selective exports) 
export { WinstonLogger, LayeredWinstonLogger, LoggingConfigManager } from './logging';
export type { IWinstonLogger, WinstonLoggerConfig, LayeredLoggerConfig } from './logging';

// Configuration system (selective exports)
export { ConfigManager, ConfigManagerFactory } from './config';
export type { ConfigSource, ConfigLoadOptions } from './config';

// Plugin system (selective exports)
export { FeatureInjector, PluginDiscovery, PluginLoader } from './plugins';
export { IsolationLevel as PluginIsolationLevel } from './plugins';
export type { IsolatedPluginInstance, DiscoveredPlugin, PluginLoadResult } from './plugins';