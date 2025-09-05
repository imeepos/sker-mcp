# 🚀 中间件系统

## 概述

Sker Daemon 采用洋葱模型中间件架构，提供灵活的横切关注点处理能力，包括认证、日志、缓存、限流等企业级功能。

## 核心概念

### 洋葱模型

```
Request → MW1 → MW2 → MW3 → Handler → MW3 → MW2 → MW1 → Response
```

中间件按顺序执行，每个中间件可以：
- 在请求到达处理器前进行预处理
- 在响应返回前进行后处理
- 决定是否继续执行下一个中间件
- 修改请求或响应数据

## 中间件接口

### IMiddleware 接口

```typescript
export interface IMiddleware {
  execute(context: MiddlewareContext, next: NextFunction): Promise<any>;
}

export interface MiddlewareContext {
  toolName: string;
  args: any[];
  metadata: any;
  userId?: string;
  requestId: string;
  startTime: Date;
}

export type NextFunction = () => Promise<any>;
```

### @UseMiddleware 装饰器

```typescript
export function UseMiddleware(...middlewares: (new () => IMiddleware)[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const context: MiddlewareContext = {
        toolName: propertyKey,
        args,
        metadata: target.constructor._mcpMetadata?.find((m: any) => m.name === propertyKey),
        requestId: crypto.randomUUID(),
        startTime: new Date()
      };
      
      let index = 0;
      
      const next: NextFunction = async () => {
        if (index < middlewares.length) {
          const middleware = new middlewares[index++]();
          return await middleware.execute(context, next);
        } else {
          return await originalMethod.apply(this, args);
        }
      };
      
      return await next();
    };
  };
}
```

## 中间件示例

系统提供了基础的中间件接口，开发者可以根据需要实现各种中间件，如：

### 日志中间件示例

```typescript
export class LoggingMiddleware implements IMiddleware {
  async execute(context: MiddlewareContext, next: NextFunction): Promise<any> {
    const { requestId, toolName, startTime } = context;
    console.log(`[${requestId}] ${toolName} started at ${startTime.toISOString()}`);
    
    try {
      const result = await next();
      const duration = Date.now() - startTime.getTime();
      console.log(`[${requestId}] ${toolName} completed in ${duration}ms`);
      return result;
    } catch (error) {
      console.error(`[${requestId}] ${toolName} failed:`, error);
      throw error;
    }
  }
}
```

### 参数验证中间件示例

```typescript
export class ValidationMiddleware implements IMiddleware {
  async execute(context: MiddlewareContext, next: NextFunction): Promise<any> {
    const { metadata, args } = context;
    const inputSchema = metadata?.inputSchema;
    
    if (inputSchema) {
      try {
        // 验证参数逻辑
        this.validateArgs(args, inputSchema);
      } catch (error) {
        throw new McpError('VALIDATION_ERROR', '参数验证失败', { error }, 400);
      }
    }
    
    return await next();
  }
  
  private validateArgs(args: any[], schema: any): void {
    // 具体验证实现
  }
}
```

## 常见中间件类型

基于中间件接口，可以实现各种功能的中间件，如：

- **认证中间件** - 验证用户身份和权限
- **缓存中间件** - 提供结果缓存功能
- **限流中间件** - 控制请求频率
- **性能监控中间件** - 记录执行时间和资源使用
- **事务中间件** - 提供数据库事务支持
- **重试中间件** - 实现失败重试机制
- **审计中间件** - 记录操作审计日志

## 使用示例

### 基础使用

```typescript
export class ApiService {
  @Tool({ name: 'process-data', description: '处理数据' })
  @UseMiddleware(AuthMiddleware, LoggingMiddleware)
  async processData(@Input(z.string()) dataId: string) {
    return { content: [{ type: 'text', text: `已处理: ${dataId}` }] };
  }
}
```



## 自定义中间件

实现自定义中间件只需要遵循 `IMiddleware` 接口：

```typescript
export class CustomMiddleware implements IMiddleware {
  async execute(context: MiddlewareContext, next: NextFunction): Promise<any> {
    // 前置处理
    console.log(`Before: ${context.toolName}`);
    
    try {
      // 执行下一个中间件或工具
      const result = await next();
      
      // 后置处理
      console.log(`After: ${context.toolName}`);
      return result;
    } catch (error) {
      // 错误处理
      console.error(`Error in: ${context.toolName}`, error);
      throw error;
    }
  }
}
```

## 最佳实践

### 1. 中间件顺序
建议按功能重要性排序：认证 → 验证 → 限流 → 缓存 → 日志 → 监控 → 业务逻辑

### 2. 错误处理
- 中间件应该正确传播错误
- 提供有意义的错误信息

### 3. 性能考虑
- 避免在中间件中执行重操作
- 使用异步操作避免阻塞

## 相关文档

- [🛡️ 错误处理](./error-handling.md) - 错误处理机制
- [📦 插件开发指南](./plugin-development.md) - 在插件中使用中间件