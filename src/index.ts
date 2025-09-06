/**
 * Sker MCP 服务器主入口文件
 * 
 * 此模块为插件开发者提供完整的 API 导出，包括装饰器、类型定义、
 * 依赖注入、配置管理等所有构建 MCP 插件所需的核心功能。
 */

// ==================== 核心系统导出 ====================

// 导出所有核心类型和接口
export * from './core/types';

// 导出依赖注入相关
export * from './core/tokens';
export * from './core/providers';

// ==================== 装饰器导出 ====================

// 核心 MCP 装饰器（使用别名以匹配设计文档）
export { McpTool as Tool } from './core/decorators/mcp-tool';
export { McpResource as Resource } from './core/decorators/mcp-resource';
export { McpPrompt as Prompt } from './core/decorators/mcp-prompt';

// 输入验证装饰器
export * from './core/decorators/input';

// 中间件装饰器
export * from './core/decorators/use-middleware';

// 错误处理装饰器
export * from './core/decorators/error-handler';

// ==================== 应用程序和管理器 ====================

// 核心应用程序
export { McpApplication, ApplicationStatus } from './core/mcp-application';
export type { IServiceManager } from './core/mcp-application';

// 核心管理器
export { ProjectManager } from './core/project-manager';
export { ServiceManager } from './core/service-manager';
export { PluginManager } from './core/plugin-manager';

// 元数据收集器
export { MetadataCollector } from './core/metadata-collector';
export type { AllMetadata } from './core/metadata-collector';

// ==================== 错误处理系统 ====================

export { ErrorManager, ErrorRecoveryManager, RetryStrategy } from './core/errors';
export { ErrorCategory, RecoveryStrategy } from './core/errors';
export type { 
  ErrorContext, 
  IErrorHandler,
  RecoveryResult,
  RetryConfig,
  CircuitBreakerConfig
} from './core/errors';

// ==================== 中间件系统 ====================

export { MiddlewareExecutor } from './core/middleware';
export type { 
  MiddlewareContext,
  NextFunction,
  MiddlewareFunction
} from './core/middleware';

// 内置中间件导出
export * from './core/middleware/builtin';
export { BuiltinMiddlewareFactory, MiddlewarePresets } from './core/middleware/builtin';

// ==================== 日志系统 ====================

export { WinstonLogger, LayeredWinstonLogger, LoggingConfigManager } from './core/logging';
export type { IWinstonLogger, WinstonLoggerConfig, LayeredLoggerConfig } from './core/logging';

// ==================== 配置系统 ====================

export { ConfigManager, ConfigManagerFactory } from './core/config';
export type { ConfigSource, ConfigLoadOptions } from './core/config';

// ==================== 插件系统 ====================

export { FeatureInjector, PluginDiscovery, PluginLoader } from './core/plugins';
export { IsolationLevel as PluginIsolationLevel } from './core/plugins';
export type { IsolatedPluginInstance, DiscoveredPlugin, PluginLoadResult } from './core/plugins';

// ==================== 应用程序引导 ====================

// 应用程序引导工具
export { AppBootstrap } from './common/app-bootstrap';
export type { AppConfig } from './common/app-bootstrap';

// ==================== 常用工具类型 ====================

// 重新导出常用的 MCP SDK 类型
export type {
  Tool as McpToolInterface,
  Resource as McpResourceInterface, 
  Prompt as McpPromptInterface,
  CallToolRequest,
  ReadResourceRequest,
  GetPromptRequest
} from '@modelcontextprotocol/sdk/types.js';

// Zod 类型验证
export { z } from 'zod';

// ==================== 快捷导出别名 ====================

// 为插件开发者提供快捷访问的常用类型别名
export type { 
  IMcpTool, 
  IMcpResource, 
  IMcpPrompt,
  IPlugin,
  PluginStatus,
  ToolMetadata,
  ResourceMetadata,
  PromptMetadata,
  ServiceConstructor,
  MiddlewareFunction as Middleware
} from './core/types';