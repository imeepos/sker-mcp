# 📦 模块导入规范

## 统一导入路径

为确保项目中所有模块引用的一致性，以下是标准的导入路径规范：

### 核心装饰器

```typescript
// 核心装饰器、中间件和错误处理
import { Tool, Resource, Prompt, Input, UseMiddleware, ErrorHandler } from '@sker/mcp';
```

### 错误处理系统

```typescript
// 错误处理相关
import { 
  IErrorHandler, 
  McpError, 
  ErrorContext,
  DefaultErrorHandler,
  ValidationErrorHandler,
  BusinessErrorHandler 
} from '@sker/mcp';
```

### 中间件系统

```typescript
// 中间件相关
import {
  IMiddleware,
  MiddlewareContext, 
  NextFunction,
  LoggingMiddleware,
  ValidationMiddleware,
  CacheMiddleware,
  AuthMiddleware
} from '@sker/mcp';
```

### 依赖注入

```typescript
// 依赖注入装饰器和工厂
import { Inject, Injectable } from '@sker/di';

// 注入令牌和 Injector 相关
import {
  MCP_SERVER_CONFIG,
  MCP_TOOLS,
  MCP_RESOURCES,
  MCP_PROMPTS,
  SERVICE_MANAGER,
  PROJECT_MANAGER,
  PLUGIN_MANAGER
} from '@sker/mcp';
import { Injector, Provider, createFeatureInjector } from '@sker/di';
```

### 核心类型和接口

```typescript
// 所有类型定义
import { 
  IMcpTool, 
  IMcpResource, 
  IMcpPrompt,
  IPlugin, 
  IPluginManager, 
  PluginStatus,
  IMcpServerConfig,
  ToolMetadata, 
  ResourceMetadata, 
  PromptMetadata 
} from '@sker/mcp';
```

### 核心服务

```typescript
// 核心服务和应用程序
import { 
  ServiceManager, 
  ProjectManager, 
  PluginManager,
  MetadataCollector,
  McpApplication 
} from '@sker/mcp';
```

### 工具库

```typescript
// 验证工具 (第三方)
import { z } from 'zod';

// Node.js 内置模块
import { readFile, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { createHash } from 'crypto';
```

## 模块结构映射

### 实际文件路径到导入路径映射

```
src/core/decorators.ts         → @sker/mcp
src/core/errors/               → @sker/mcp
src/core/middleware/           → @sker/mcp
src/core/types.ts              → @sker/mcp
src/core/tokens.ts             → @sker/mcp
src/core/services/             → @sker/mcp
src/core/metadata-collector.ts → @sker/mcp
src/core/mcp-application.ts    → @sker/mcp
```

### package.json 导出配置

项目的 `package.json` 应配置以下导出路径：

```json
{
  "name": "@sker/mcp",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

## 插件开发标准导入

### 基础插件模板

```typescript
// 插件入口文件标准导入
import { 
  Tool, 
  Resource, 
  Prompt, 
  Input, 
  UseMiddleware, 
  ErrorHandler,
  LoggingMiddleware,
  ValidationMiddleware,
  ValidationErrorHandler,
  IPlugin
} from '@sker/mcp';
import { Inject, Injectable } from '@sker/di';
import { z } from 'zod';

// 插件服务示例
@Injectable()
export class MyPluginService {
  constructor(
    @Inject('PLUGIN_CONFIG') private config: any
  ) {}

  @Tool({
    name: 'my-tool',
    description: '我的工具'
  })
  @UseMiddleware(LoggingMiddleware, ValidationMiddleware)
  @ErrorHandler(ValidationErrorHandler)
  async myTool(
    @Input(z.string().describe('输入参数')) input: string
  ) {
    return {
      content: [{ type: 'text', text: `处理结果: ${input}` }]
    };
  }
}

// 插件定义
const plugin: IPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: '我的插件',
  services: [MyPluginService]
};

export default plugin;
```

## IDE 配置

### VS Code 设置

在 `.vscode/settings.json` 中配置导入建议：

```json
{
  "typescript.suggest.includeCompletionsForModuleExports": true,
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "typescript.suggest.autoImports": true
}
```

## 最佳实践

### 1. 导入排序

按以下顺序组织导入语句：

```typescript
// 1. Node.js 内置模块
import { readFile } from 'fs/promises';
import { join } from 'path';

// 2. 第三方依赖
import { z } from 'zod';

// 3. @sker/di 依赖注入
import { Inject, Injectable } from '@sker/di';

// 4. @sker/mcp 核心模块
import { Tool, Input, UseMiddleware, LoggingMiddleware, IPlugin } from '@sker/mcp';

// 5. 相对路径导入
import { MyHelper } from './helpers';
```

### 2. 类型导入

使用 `import type` 语法导入仅用于类型的模块：

```typescript
import type { IMcpTool, IPlugin } from '@sker/mcp';
import type { Injector } from '@sker/di';

// 运行时需要的导入
import { Tool } from '@sker/mcp';
```

### 3. 按需导入

尽量使用具名导入，避免导入整个模块：

```typescript
// ✅ 推荐：按需导入
import { LoggingMiddleware, ValidationMiddleware } from '@sker/mcp';

// ❌ 不推荐：导入整个模块
import * as Mcp from '@sker/mcp';
```

这个统一的导入规范确保了整个项目的一致性，便于维护和开发。