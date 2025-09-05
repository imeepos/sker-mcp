# 🛡️ 错误处理系统

## 概述

Sker Daemon 提供统一的错误处理机制，通过装饰器模式实现可组合的错误处理策略，确保系统的稳定性和可维护性。

## 核心组件

### 错误处理器接口

```typescript
export interface IErrorHandler {
  handleError(error: Error, context: ErrorContext): Promise<McpError>;
}

export interface ErrorContext {
  method: string;
  requestId?: string;
  toolName?: string;
  args: any;
  timestamp: Date;
  pluginName?: string;
  sessionId?: string;
}
```

### 自定义错误类型

```typescript
export class McpError extends Error {
  constructor(
    public code: McpErrorCode,
    public message: string,
    public data?: any
  ) {
    super(message);
  }
}

export enum McpErrorCode {
  // MCP 标准错误代码
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  
  // 应用特定错误代码  
  PluginError = -32000,
  ValidationError = -32001,
  ResourceNotFound = -32002,
  PermissionDenied = -32003,
  ToolExecutionError = -32004
}
```

## 错误处理装饰器

### @ErrorHandler 装饰器

```typescript
export function ErrorHandler(handler: new () => IErrorHandler) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const errorHandler = new handler();
        const context: ErrorContext = {
          method: 'tools/call',
          toolName: propertyKey,
          args,
          timestamp: new Date()
        };
        throw await errorHandler.handleError(error as Error, context);
      }
    };
  };
}
```

## 内置错误处理器

### DefaultErrorHandler

处理通用错误：

```typescript
import { Injectable, Inject } from '@sker/di';
import { Logger } from 'winston';
import { LOGGER_TOKENS } from '@sker/mcp';

@Injectable()
export class DefaultErrorHandler implements IErrorHandler {
  constructor(
    @Inject(LOGGER_TOKENS.APPLICATION_LOGGER) private logger: Logger
  ) {}

  async handleError(error: Error, context: ErrorContext): Promise<McpError> {
    this.logger.error('错误处理', {
      method: context.method,
      toolName: context.toolName,
      pluginName: context.pluginName,
      requestId: context.requestId,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
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

### ValidationErrorHandler

处理参数验证错误：

```typescript
@Injectable()
export class ValidationErrorHandler implements IErrorHandler {
  constructor(
    @Inject(LOGGER_TOKENS.APPLICATION_LOGGER) private logger: Logger
  ) {}

  async handleError(error: Error, context: ErrorContext): Promise<McpError> {
    this.logger.warn('参数验证错误', {
      method: context.method,
      toolName: context.toolName,
      error: error.message,
      args: context.args
    });

    if (error.name === 'ZodError') {
      return new McpError(
        McpErrorCode.ValidationError,
        '参数验证失败',
        { validationErrors: error.message }
      );
    }
    
    return new McpError(McpErrorCode.InternalError, error.message);
  }
}
```

### BusinessErrorHandler

处理业务逻辑错误：

```typescript
@Injectable()
export class BusinessErrorHandler implements IErrorHandler {
  constructor(
    @Inject(LOGGER_TOKENS.APPLICATION_LOGGER) private logger: Logger
  ) {}

  async handleError(error: Error, context: ErrorContext): Promise<McpError> {
    // MCP 业务错误映射
    const businessErrors = {
      'RESOURCE_NOT_FOUND': McpErrorCode.ResourceNotFound,
      'PERMISSION_DENIED': McpErrorCode.PermissionDenied,
      'PLUGIN_ERROR': McpErrorCode.PluginError
    };

    const errorCode = businessErrors[error.message];
    if (errorCode) {
      this.logger.warn('业务错误', {
        method: context.method,
        toolName: context.toolName,
        pluginName: context.pluginName,
        errorCode: errorCode,
        message: error.message
      });

      return new McpError(
        errorCode,
        error.message,
        { context }
      );
    }

    return new DefaultErrorHandler().handleError(error, context);
  }
}
```

## 使用示例

### 基础使用

```typescript
export class CalculatorService {
  @Tool({ name: 'divide', description: '除法运算' })
  @ErrorHandler(ValidationErrorHandler)
  async divide(
    @Input(z.number()) a: number,
    @Input(z.number().refine(val => val !== 0, '不能为零')) b: number
  ) {
    if (b === 0) {
      throw new McpError(McpErrorCode.InvalidParams, '除数不能为零', { a, b });
    }
    return { content: [{ type: 'text', text: `${a / b}` }] };
  }
}
```


### 自定义错误处理器

```typescript
@Injectable()
export class CustomErrorHandler implements IErrorHandler {
  constructor(
    @Inject(LOGGER_TOKENS.PLUGIN_LOGGER) private logger: Logger
  ) {}

  async handleError(error: Error, context: ErrorContext): Promise<McpError> {
    // 记录详细错误日志
    this.logger.error('自定义错误处理', {
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
    
    // 发送错误通知
    await this.sendErrorNotification(error, context);
    
    // 错误分类处理
    if (error.message.includes('timeout')) {
      this.logger.warn('操作超时', {
        method: context.method,
        toolName: context.toolName,
        pluginName: context.pluginName
      });
      
      return new McpError(
        McpErrorCode.InternalError,
        '操作超时，请重试',
        { context, errorType: 'timeout' }
      );
    }
    
    if (error.message.includes('rate limit')) {
      this.logger.warn('请求限流', {
        method: context.method,
        toolName: context.toolName,
        pluginName: context.pluginName
      });
      
      return new McpError(
        McpErrorCode.InternalError,
        '请求过于频繁，请稍后重试',
        { context, errorType: 'rate_limit' }
      );
    }
    
    // 默认错误处理
    return new DefaultErrorHandler().handleError(error, context);
  }
  
  
  private async sendErrorNotification(error: Error, context: ErrorContext): Promise<void> {
    // 发送错误通知到监控系统
    if (process.env.NODE_ENV === 'production') {
      this.logger.error('发送错误通知', {
        error: error.message,
        context: context.method
      });
      // 实际的通知逻辑
    }
  }
}
```

## 错误恢复策略

系统支持各种错误恢复机制，开发者可以根据需要实现：

- **重试机制** - 对临时性错误实现自动重试
- **熔断器** - 防止级联失败的保护机制
- **降级策略** - 在服务不可用时提供替代方案

## MCP 错误响应格式

MCP 协议要求错误响应遵循 JSON-RPC 2.0 格式：

```typescript
export interface McpErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: any;
  };
}
```

## 错误监控

系统支持 MCP Server 特定的错误监控：
- Tool 执行失败率统计
- 插件错误分类统计  
- 关键错误告警（插件崩溃、连接断开等）
- MCP 协议错误报告

## 最佳实践

### 1. 错误分层
- **系统错误**: 使用 DefaultErrorHandler
- **验证错误**: 使用 ValidationErrorHandler
- **业务错误**: 使用 BusinessErrorHandler
- **特定错误**: 实现自定义 ErrorHandler

### 2. 错误信息
- 提供有意义的错误代码
- 包含足够的上下文信息
- 区分用户友好的错误信息和技术错误信息

### 3. 错误恢复
- 对临时性错误实现重试机制
- 使用熔断器防止级联失败
- 提供优雅降级策略

## 相关文档

- [🚀 中间件系统](./middleware-system.md) - 中间件和错误处理的结合
- [🏗️ 核心架构](./core-architecture.md) - 系统整体架构