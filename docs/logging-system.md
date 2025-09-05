# 📝 日志系统

## 概述

Sker Daemon 使用 Winston 作为日志记录框架，采用分层日志架构，为不同层级提供独立的 Logger 实例，确保日志的隔离性和可追溯性。

## 日志架构

### 层级结构

```
Root Injector
├── Platform Logger (平台级日志)
├── Application Logger (应用级日志)
└── Plugin Feature Injectors
    ├── Plugin A Logger (插件A独立日志)
    ├── Plugin B Logger (插件B独立日志)
    └── Plugin N Logger (插件N独立日志)
```

### 日志分离策略和存储路径

- **Platform Logger**: 记录平台级事件（服务启动、配置加载、系统错误）
  - 存储路径: `.sker/logs/`
  - 文件格式: `PLATFORM-combined.log`, `PLATFORM-error.log`

- **Application Logger**: 记录应用逻辑事件（MCP 协议处理、Tool 调用）
  - 存储路径: `.sker/logs/{应用名}/`
  - 文件格式: `APPLICATION-combined.log`, `APPLICATION-error.log`

- **Plugin Logger**: 每个插件拥有独立的 Logger 实例，隔离日志输出
  - 存储路径: `.sker/logs/{应用名}/{插件名}/`
  - 文件格式: `PLUGIN-{插件名}-combined.log`, `PLUGIN-{插件名}-error.log`

### 目录结构示例

```
.sker/
└── logs/
    ├── PLATFORM-combined.log          # 平台日志
    ├── PLATFORM-error.log
    ├── my-mcp-app/                     # 应用日志目录
    │   ├── APPLICATION-combined.log
    │   ├── APPLICATION-error.log
    │   ├── database-plugin/            # 插件日志目录
    │   │   ├── PLUGIN-DATABASE-PLUGIN-combined.log
    │   │   └── PLUGIN-DATABASE-PLUGIN-error.log
    │   └── file-manager/               # 另一个插件日志目录
    │       ├── PLUGIN-FILE-MANAGER-combined.log
    │       └── PLUGIN-FILE-MANAGER-error.log
    └── another-app/                    # 另一个应用的日志目录
        ├── APPLICATION-combined.log
        └── weather-plugin/
            ├── PLUGIN-WEATHER-PLUGIN-combined.log
            └── PLUGIN-WEATHER-PLUGIN-error.log
```

## 核心组件

### Winston 配置

```typescript
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { Injectable } from '@sker/di';

@Injectable()
export class LoggerConfig {
  private skerHomeDir: string;

  constructor() {
    this.skerHomeDir = process.env.SKER_HOME_DIR || path.join(process.cwd(), '.sker');
  }

  createLogger(
    name: string, 
    type: 'platform' | 'application' | 'plugin',
    level: string = 'info',
    appName?: string,
    pluginName?: string
  ): winston.Logger {
    const logDir = this.getLogDirectory(type, appName, pluginName);
    this.ensureDirectoryExists(logDir);

    return winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
          let log = `[${timestamp}] ${level.toUpperCase()}: [${name}] ${message}`;
          if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
          }
          if (stack) {
            log += `\n${stack}`;
          }
          return log;
        })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: path.join(logDir, `${name}-error.log`),
          level: 'error'
        }),
        new winston.transports.File({
          filename: path.join(logDir, `${name}-combined.log`)
        })
      ]
    });
  }

  private getLogDirectory(
    type: 'platform' | 'application' | 'plugin',
    appName?: string,
    pluginName?: string
  ): string {
    const logsBaseDir = path.join(this.skerHomeDir, 'logs');

    switch (type) {
      case 'platform':
        return logsBaseDir;
      case 'application':
        return path.join(logsBaseDir, appName || 'default-app');
      case 'plugin':
        return path.join(logsBaseDir, appName || 'default-app', pluginName || 'unknown-plugin');
      default:
        return logsBaseDir;
    }
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
```

### 日志令牌定义

```typescript
import { Logger } from 'winston';
import { InjectionToken } from '@sker/di';

// 类型安全的注入令牌
export const LOGGER = new InjectionToken<Logger>('LOGGER');
export const LOGGER_CONFIG = new InjectionToken<LoggerConfig>('LOGGER_CONFIG');
export const LOGGER_FACTORY = new InjectionToken<LoggerFactory>('LOGGER_FACTORY');
export const APP_NAME = new InjectionToken<string>('APP_NAME');

// 导出类型
export { Logger };
```

### Logger 工厂

```typescript
import { Logger } from 'winston';
import { Injectable, Inject, Optional } from '@sker/di';

@Injectable()
export class LoggerFactory {
  constructor(
    @Inject(LOGGER_CONFIG) private config: LoggerConfig,
    @Inject(APP_NAME) @Optional() private appName: string = 'default-app'
  ) {}

  createPlatformLogger(): Logger {
    return this.config.createLogger('PLATFORM', 'platform', 'debug');
  }

  createApplicationLogger(): Logger {
    return this.config.createLogger('APPLICATION', 'application', 'info', this.appName);
  }

  createPluginLogger(pluginName: string): Logger {
    return this.config.createLogger(
      `PLUGIN-${pluginName.toUpperCase()}`, 
      'plugin', 
      'info',
      this.appName,
      pluginName
    );
  }
}
```

## 依赖注入配置

### Platform Injector 配置

```typescript
import { createFeatureInjector } from '@sker/di';
import { LoggerFactory, LoggerConfig, LOGGER, LOGGER_CONFIG, LOGGER_FACTORY } from '@sker/mcp';

// 创建 Platform Injector
const platformInjector = createFeatureInjector([
  // Logger 配置和工厂 - 使用类型安全的令牌
  { provide: LOGGER_CONFIG, useClass: LoggerConfig },
  { provide: LOGGER_FACTORY, useClass: LoggerFactory },
  
  // Platform Logger - 平台级别的 Logger
  {
    provide: LOGGER,
    useFactory: (factory: LoggerFactory) => factory.createPlatformLogger(),
    deps: [LOGGER_FACTORY]
  }
]);
```

### Application Injector 配置

```typescript
import { APP_NAME } from '@sker/mcp';

// 创建 Application Injector (继承自 Platform)
const applicationInjector = createFeatureInjector([
  // 应用名称配置 - 使用类型安全的令牌
  { provide: APP_NAME, useValue: 'my-mcp-app' },
  
  // Application Logger - 覆盖父级的 LOGGER，提供应用级别的 Logger
  {
    provide: LOGGER,
    useFactory: (factory: LoggerFactory) => factory.createApplicationLogger(),
    deps: [LOGGER_FACTORY]
  }
], platformInjector);
```

### Plugin Feature Injector 配置

```typescript
import { Injector } from '@sker/di';

// 为每个插件创建独立的 Feature Injector
export function createPluginInjector(pluginName: string, parentInjector: Injector) {
  return createFeatureInjector([
    // Plugin Logger - 覆盖父级的 LOGGER，提供插件级别的 Logger
    {
      provide: LOGGER,
      useFactory: (factory: LoggerFactory) => factory.createPluginLogger(pluginName),
      deps: [LOGGER_FACTORY]
    }
  ], parentInjector);
}
```

### 使用逻辑

```typescript
// Platform 层级使用
const platformLogger = platformInjector.get(LOGGER); // 获得 Platform Logger

// Application 层级使用  
const appLogger = applicationInjector.get(LOGGER); // 获得 Application Logger

// Plugin 层级使用
const pluginInjector = createPluginInjector('database-plugin', applicationInjector);
const pluginLogger = pluginInjector.get(LOGGER); // 获得插件专属 Logger
```

## 使用示例

### Platform 服务中使用

```typescript
import { Injectable, Inject } from '@sker/di';
import { Logger } from 'winston';
import { LOGGER } from '@sker/mcp';

@Injectable()
export class ServiceManager {
  constructor(
    @Inject(LOGGER) private logger: Logger  // 在 Platform Injector 中注入的是 Platform Logger
  ) {}

  async startServices(): Promise<void> {
    this.logger.info('正在启动平台服务...');
    
    try {
      // 启动服务逻辑
      this.logger.info('平台服务启动成功', {
        timestamp: new Date().toISOString(),
        services: ['database', 'cache', 'queue']
      });
    } catch (error) {
      this.logger.error('平台服务启动失败', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}
```

### Application 中使用

```typescript
import { Injectable, Inject } from '@sker/di';
import { Logger } from 'winston';
import { LOGGER } from '@sker/mcp';

@Injectable()
export class McpApplication {
  constructor(
    @Inject(LOGGER) private logger: Logger  // 在 Application Injector 中注入的是 Application Logger
  ) {}

  async handleToolCall(toolName: string, args: any): Promise<any> {
    this.logger.info('处理 Tool 调用', {
      toolName,
      argsCount: Object.keys(args).length
    });

    const startTime = Date.now();
    
    try {
      const result = await this.executeTool(toolName, args);
      
      this.logger.info('Tool 调用成功', {
        toolName,
        duration: Date.now() - startTime
      });
      
      return result;
    } catch (error) {
      this.logger.error('Tool 调用失败', {
        toolName,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
}
```

### Plugin 中使用

```typescript
import { Injectable, Inject } from '@sker/di';
import { Tool, Input } from '@sker/mcp';
import { Logger } from 'winston';
import { LOGGER } from '@sker/mcp';
import { z } from 'zod';

@Injectable()
export class DatabasePlugin {
  constructor(
    @Inject(LOGGER) private logger: Logger  // 在 Plugin Feature Injector 中注入的是该插件专属 Logger
  ) {}

  @Tool({ name: 'query-data', description: '查询数据库数据' })
  async queryData(@Input(z.string()) query: string) {
    this.logger.info('执行数据库查询', { query });

    try {
      // 查询逻辑
      const result = await this.executeQuery(query);
      
      this.logger.info('查询执行成功', {
        query,
        resultCount: result.length
      });

      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) {
      this.logger.error('查询执行失败', {
        query,
        error: error.message
      });
      throw error;
    }
  }

  private async executeQuery(query: string): Promise<any[]> {
    this.logger.debug('连接数据库', { query });
    // 实际查询逻辑
    return [];
  }
}
```

## 错误处理集成

### 错误处理器中的日志记录

```typescript
import { Injectable, Inject } from '@sker/di';
import { Logger } from 'winston';
import { IErrorHandler, ErrorContext, McpError, McpErrorCode, LOGGER } from '@sker/mcp';

@Injectable()
export class LoggingErrorHandler implements IErrorHandler {
  constructor(
    @Inject(LOGGER) private logger: Logger  // 根据注入的上下文，自动获得对应层级的 Logger
  ) {}

  async handleError(error: Error, context: ErrorContext): Promise<McpError> {
    // 记录详细错误信息
    this.logger.error('错误处理', {
      method: context.method,
      toolName: context.toolName,
      pluginName: context.pluginName,
      requestId: context.requestId,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      args: context.args
    });

    if (error instanceof McpError) {
      return error;
    }

    return new McpError(
      McpErrorCode.InternalError,
      '内部服务器错误',
      { originalError: error.message, context }
    );
  }
}
```

## 日志轮转和管理

### 日志轮转配置

```typescript
import winston from 'winston';
import path from 'path';
import 'winston-daily-rotate-file';

export class LoggerConfig {
  createLoggerWithRotation(
    name: string, 
    type: 'platform' | 'application' | 'plugin',
    level: string = 'info',
    appName?: string,
    pluginName?: string
  ): winston.Logger {
    const logDir = this.getLogDirectory(type, appName, pluginName);
    this.ensureDirectoryExists(logDir);

    return winston.createLogger({
      level,
      format: this.getLogFormat(name),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.DailyRotateFile({
          filename: path.join(logDir, `${name}-%DATE%.log`),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          level: 'info'
        }),
        new winston.transports.DailyRotateFile({
          filename: path.join(logDir, `${name}-error-%DATE%.log`),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          level: 'error'
        })
      ]
    });
  }

  private getLogFormat(name: string): winston.Logform.Format {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `[${timestamp}] ${level.toUpperCase()}: [${name}] ${message}`;
        if (Object.keys(meta).length > 0) {
          log += ` ${JSON.stringify(meta)}`;
        }
        if (stack) {
          log += `\n${stack}`;
        }
        return log;
      })
    );
  }
}
```

## 日志查询和监控

### 日志查询接口

```typescript
@Injectable()
export class LogQueryService {
  constructor(
    @Inject(LOGGER) private logger: Logger
  ) {}

  async queryLogs(filters: LogQueryFilters): Promise<LogEntry[]> {
    this.logger.info('查询日志', { filters });
    
    // 日志查询逻辑
    // 可以集成 ELK Stack 或其他日志系统
    
    return [];
  }
}

export interface LogQueryFilters {
  level?: string;
  plugin?: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  keyword?: string;
}

export interface LogEntry {
  timestamp: Date;
  level: string;
  message: string;
  meta?: Record<string, any>;
  source: 'platform' | 'application' | 'plugin';
  pluginName?: string;
}
```

## 最佳实践

### 1. 结构化日志
- 使用对象记录上下文信息
- 包含关键业务标识符（pluginName、requestId、toolName）
- 避免敏感信息泄露

### 2. 日志级别使用
- **ERROR**: 系统错误、插件崩溃
- **WARN**: 性能警告、配置问题
- **INFO**: 业务流程、Tool 执行
- **DEBUG**: 详细调试信息

### 3. 性能考虑
- 避免在热路径中记录大量日志
- 使用异步日志传输
- 合理设置日志级别和轮转策略

## 相关文档

- [🛡️ 错误处理系统](./error-handling.md) - 错误处理与日志集成
- [🏗️ 核心架构](./core-architecture.md) - 依赖注入架构
- [🔌 插件开发指南](./plugin-development.md) - 插件中的日志使用