# 📖 Sker MCP 插件开发手册教程

## 目录

1. [概述](#概述)
2. [环境准备](#环境准备)
3. [创建你的第一个插件](#创建你的第一个插件)
4. [装饰器系统详解](#装饰器系统详解)
5. [高级特性](#高级特性)
6. [实战示例](#实战示例)
7. [调试与测试](#调试与测试)
8. [部署与发布](#部署与发布)
9. [最佳实践](#最佳实践)
10. [故障排除](#故障排除)

---

## 概述

Sker MCP 是一个基于装饰器驱动的 Model Context Protocol (MCP) 服务器框架。它采用现代化的架构设计，支持插件系统、依赖注入、中间件和强大的类型安全系统。

### 核心特性

- 🏗️ **装饰器架构**: 基于装饰器的声明式开发模式
- 💉 **依赖注入**: 基于 @sker/di 的依赖注入系统  
- 🔧 **可扩展性**: 轻松添加新的工具、资源和提示
- 🚀 **元数据驱动**: 启动时自动搜集和注册功能
- 🔌 **插件系统**: Feature Injector 隔离架构的插件系统
- 🛡️ **类型安全**: 完整的 TypeScript 类型支持
- 🌐 **多传输协议**: 支持 stdio 和 HTTP 传输

### 架构概览

```
┌─────────────────────────────────────┐
│             MCP Application         │
│  ┌─────────────────────────────────┐│
│  │        Plugin Manager           ││
│  │  ┌─────────────────────────────┐││
│  │  │     Feature Injector        │││ <- 插件隔离
│  │  │  ┌─────────────────────────┐│││
│  │  │  │    Plugin Container     ││││ <- 每个插件独立容器
│  │  │  │  - Services             ││││
│  │  │  │  - Tools                ││││ 
│  │  │  │  - Resources            ││││
│  │  │  │  - Prompts              ││││
│  │  │  └─────────────────────────┘│││
│  │  └─────────────────────────────┘││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

---

## 环境准备

### 系统要求

- Node.js 18.0.0+
- TypeScript 5.3+
- npm 或 pnpm

### 安装 Sker MCP

```bash
# 使用 npm
npm install -g @sker/mcp

# 或使用 pnpm
pnpm add -g @sker/mcp
```

### 初始化开发环境

```bash
# 创建开发目录
mkdir my-sker-plugins
cd my-sker-plugins

# 设置 Sker 工作目录（可选）
export SKER_HOME_DIR=$(pwd)

# 创建插件目录结构
mkdir -p plugins config logs
```

---

## 创建你的第一个插件

### 步骤 1: 创建插件目录

```bash
mkdir -p plugins/hello-world
cd plugins/hello-world
```

### 步骤 2: 初始化 package.json

```json
{
  "name": "hello-world-plugin",
  "version": "1.0.0",
  "description": "我的第一个 Sker MCP 插件",
  "main": "index.js",
  "type": "module",
  "mcpPlugin": true,
  "author": "Your Name",
  "engines": {
    "node": ">=18.0.0",
    "sker": ">=1.1.0"
  },
  "mcp": {
    "isolationLevel": "service",
    "permissions": {
      "parentServices": true,
      "globalRegistration": false
    }
  },
  "dependencies": {
    "zod": "^4.1.5"
  }
}
```

**重要**: `mcpPlugin: true` 字段是必需的，用于插件发现机制。

### 步骤 3: 实现插件主文件

创建 `index.js`:

```javascript
import { z } from 'zod';

// 服务类 - 包含具体功能实现
class HelloWorldService {
  // 使用装饰器标记为 MCP 工具
  static getTools() {
    return [{
      name: 'hello',
      description: '打招呼工具',
      inputSchema: z.object({
        name: z.string().describe('要打招呼的名字')
      }),
      handler: this.prototype.hello
    }];
  }
  
  async hello(request) {
    const { name } = request.params.arguments;
    return {
      content: [{
        type: 'text',
        text: `你好, ${name}! 欢迎使用 Sker MCP 插件系统！`
      }]
    };
  }

  // 资源示例
  static getResources() {
    return [{
      uri: 'hello://info',
      name: 'plugin-info',
      description: '插件信息',
      handler: this.prototype.getPluginInfo
    }];
  }

  async getPluginInfo() {
    return {
      contents: [{
        uri: 'hello://info',
        mimeType: 'application/json',
        text: JSON.stringify({
          name: 'Hello World Plugin',
          version: '1.0.0',
          features: ['tools', 'resources'],
          status: 'active'
        })
      }]
    };
  }
}

// 插件主对象 - 必须导出的接口
const plugin = {
  name: 'hello-world-plugin',
  version: '1.0.0',
  description: '我的第一个 Sker MCP 插件',
  author: 'Your Name',
  
  // 导出的服务类 - 系统会自动注册这些类中的装饰器
  services: [HelloWorldService],
  
  // 生命周期钩子
  hooks: {
    async onLoad() {
      console.log('🔌 Hello World 插件加载完成');
    },
    
    async onUnload() {
      console.log('🔌 Hello World 插件卸载完成');
    }
  }
};

export default plugin;
```

### 步骤 4: 测试插件

启动 Sker MCP 服务器：

```bash
cd ../../  # 回到项目根目录
sker start
```

或使用开发模式：

```bash
sker dev
```

查看日志确认插件已成功加载。

---

## 装饰器系统详解

Sker MCP 提供了丰富的装饰器系统，支持 TypeScript 的装饰器语法。以下是现有系统支持的装饰器：

### @McpTool - 工具装饰器

用于将方法标记为 MCP 工具，支持自动输入验证和参数映射。

```typescript
import { McpTool, Input } from '@sker/mcp';
import { z } from 'zod';

class CalculatorService {
  @McpTool({
    name: 'calculate',
    description: '执行数学运算',
    // inputSchema 可省略，系统会从 @Input 装饰器自动构建
  })
  async calculate(
    @Input(z.number().describe('第一个数字')) a: number,
    @Input(z.number().describe('第二个数字')) b: number,
    @Input(z.enum(['add', 'subtract', 'multiply', 'divide']).describe('运算类型')) 
    operation: 'add' | 'subtract' | 'multiply' | 'divide'
  ) {
    let result;
    switch (operation) {
      case 'add': result = a + b; break;
      case 'subtract': result = a - b; break;
      case 'multiply': result = a * b; break;
      case 'divide': result = b !== 0 ? a / b : 'Error: Division by zero'; break;
    }
    
    return {
      content: [{ 
        type: 'text', 
        text: `${a} ${operation} ${b} = ${result}` 
      }]
    };
  }
}
```

**McpTool 选项**:
- `name`: 工具名称（必须唯一）
- `description`: 工具描述
- `inputSchema`: 可选，Zod 验证架构（如果未提供，会从 @Input 自动构建）
- `middleware`: 应用的中间件列表
- `errorHandler`: 错误处理器方法名

### @McpResource - 资源装饰器

用于将方法标记为 MCP 资源，支持静态资源和模板资源。

```typescript
import { McpResource } from '@sker/mcp';

class FileService {
  // 静态资源
  @McpResource({
    uri: 'config://settings',
    name: 'app-settings',
    description: '应用配置设置',
    mimeType: 'application/json'
  })
  async getAppSettings() {
    return {
      contents: [{
        uri: 'config://settings',
        mimeType: 'application/json',
        text: JSON.stringify({
          theme: 'dark',
          language: 'zh-CN',
          notifications: true
        })
      }]
    };
  }

  // 模板资源 - 支持参数化 URI
  @McpResource({
    uri: 'file:///{path}',
    name: 'local-file',
    title: '本地文件',
    description: '通过路径访问本地文件',
    mimeType: 'text/plain',
    isTemplate: true,  // 标记为模板资源
    middleware: ['fileAccess', 'security']
  })
  async readLocalFile(request) {
    const uri = new URL(request.params.uri);
    const filePath = uri.pathname;
    
    // 实际文件读取逻辑
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: 'text/plain',
        text: `文件内容: ${filePath}`
      }]
    };
  }
}
```

### @McpPrompt - 提示装饰器

用于将方法标记为 MCP 提示，支持参数化的提示模板。

```typescript
import { McpPrompt, Input } from '@sker/mcp';
import { z } from 'zod';

class PromptService {
  @McpPrompt({
    name: 'code-review',
    description: '生成代码审查提示',
    arguments: z.object({
      language: z.string().describe('编程语言'),
      code: z.string().describe('要审查的代码'),
      focus: z.enum(['security', 'performance', 'style']).optional()
        .describe('审查重点')
    })
  })
  async generateCodeReviewPrompt(request) {
    const { language, code, focus = 'general' } = request.params.arguments;
    
    const focusInstructions = {
      security: '特别关注安全漏洞和潜在的安全问题',
      performance: '重点分析性能优化和效率问题',
      style: '专注于代码风格和最佳实践',
      general: '全面审查代码质量'
    };

    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `请对以下 ${language} 代码进行审查，${focusInstructions[focus]}：

\`\`\`${language}
${code}
\`\`\`

请提供详细的反馈，包括：
1. 发现的问题
2. 改进建议  
3. 最佳实践建议`
        }
      }]
    };
  }
}
```

### @Input - 输入参数装饰器

用于标记和验证方法参数，支持自动 schema 构建。

```typescript
import { McpTool, Input } from '@sker/mcp';
import { z } from 'zod';

class ValidationService {
  @McpTool({
    name: 'validate-user-data',
    description: '验证用户数据'
  })
  async validateUserData(
    @Input(z.string().min(1).describe('用户姓名')) name: string,
    @Input(z.string().email().describe('用户邮箱')) email: string,
    @Input(z.number().min(18).max(120).describe('用户年龄')) age: number,
    @Input(z.array(z.string()).describe('兴趣爱好').optional()) interests?: string[]
  ) {
    // 参数会自动根据 @Input 装饰器进行验证
    return {
      content: [{
        type: 'text',
        text: `用户 ${name} (${email}, ${age}岁) 验证通过！`
      }]
    };
  }
}
```

### @UseMiddleware - 中间件装饰器

用于应用中间件到特定方法。

```typescript
import { McpTool, UseMiddleware } from '@sker/mcp';

class OptimizedService {
  @McpTool({
    name: 'heavy-computation',
    description: '执行重计算任务'
  })
  @UseMiddleware('logging', 'performance', 'cache')
  async heavyComputation(request) {
    // 这个方法会依次应用 logging、performance 和 cache 中间件
    const result = await this.performComplexCalculation(request.params.arguments);
    return {
      content: [{ type: 'text', text: `计算结果: ${result}` }]
    };
  }
  
  private async performComplexCalculation(args) {
    // 模拟复杂计算
    await new Promise(resolve => setTimeout(resolve, 1000));
    return 42;
  }
}
```

### @ErrorHandler - 错误处理装饰器

用于为方法指定自定义错误处理逻辑。

```typescript
import { McpTool, ErrorHandler } from '@sker/mcp';

class RobustService {
  @McpTool({
    name: 'risky-operation',
    description: '可能失败的操作'
  })
  @ErrorHandler('handleRiskyError')  // 指定错误处理方法名
  async riskyOperation(request) {
    // 可能抛出异常的操作
    if (Math.random() < 0.5) {
      throw new Error('随机错误发生了！');
    }
    
    return {
      content: [{ type: 'text', text: '操作成功完成！' }]
    };
  }
  
  // 自定义错误处理方法
  async handleRiskyError(error, request) {
    return {
      content: [{
        type: 'text',
        text: `操作失败，但已优雅处理: ${error.message}`
      }],
      isError: false  // 标记为非错误响应
    };
  }
}
```

---

## 高级特性

### Feature Injector 插件隔离

Sker MCP 使用 Feature Injector 架构为每个插件创建隔离的执行环境：

```javascript
// package.json 中的隔离配置
{
  "mcp": {
    "isolationLevel": "service",  // none | service | full
    "permissions": {
      "parentServices": true,     // 是否可访问父容器服务
      "globalRegistration": false, // 是否可注册全局服务
      "crossPluginAccess": false,  // 是否可访问其他插件
      "coreSystemAccess": false   // 是否可访问核心系统
    },
    "trustLevel": "trusted"       // untrusted | trusted | system
  }
}
```

**隔离级别说明**:
- `none`: 无隔离，直接访问父容器
- `service`: 服务级隔离，独立服务实例但共享父容器服务
- `full`: 完全隔离，完全独立的容器

### 依赖注入

插件可以使用依赖注入获取系统服务：

```typescript
import { Injectable, Inject } from '@sker/di';
import { McpTool } from '@sker/mcp';

@Injectable()
class DatabaseService {
  constructor(
    @Inject('LOGGER') private logger: any,
    @Inject('PROJECT_MANAGER') private projectManager: any
  ) {}

  @McpTool({
    name: 'query-database',
    description: '查询数据库'
  })
  async queryDatabase(request) {
    this.logger.info('执行数据库查询', { query: request.params.arguments.query });
    
    // 使用项目管理器获取数据库路径
    const dbPath = this.projectManager.getDataDirectory();
    
    // 查询逻辑...
    return {
      content: [{ type: 'text', text: '查询完成' }]
    };
  }
}
```

### 中间件系统

系统提供洋葱模型中间件架构：

```typescript
// 自定义中间件
class CustomMiddleware {
  async execute(context, next) {
    console.log('中间件开始');
    
    // 前置处理
    context.startTime = Date.now();
    
    try {
      // 调用下一个中间件或目标方法
      const result = await next();
      
      // 后置处理
      const duration = Date.now() - context.startTime;
      console.log(`操作耗时: ${duration}ms`);
      
      return result;
    } catch (error) {
      // 错误处理
      console.error('中间件捕获错误:', error);
      throw error;
    }
  }
}

// 在服务中使用
class ServiceWithMiddleware {
  @McpTool({ name: 'timed-operation', description: '计时操作' })
  @UseMiddleware(CustomMiddleware)
  async timedOperation(request) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { content: [{ type: 'text', text: '操作完成' }] };
  }
}
```

### 插件配置系统

支持运行时配置和环境变量：

```javascript
const plugin = {
  name: 'configurable-plugin',
  version: '1.0.0',
  description: '可配置插件',
  services: [ConfigurableService],
  
  // 配置 schema
  configSchema: z.object({
    apiKey: z.string(),
    maxRetries: z.number().default(3),
    timeout: z.number().default(5000)
  }),
  
  hooks: {
    async onLoad() {
      // 访问配置
      const config = this.getConfig();
      console.log('插件配置:', config);
    }
  }
};
```

---

## 实战示例

### 示例 1: 文件管理插件

```typescript
import { McpTool, McpResource, Input, UseMiddleware } from '@sker/mcp';
import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';

class FileManagerService {
  // 文件列表工具
  @McpTool({
    name: 'list-files',
    description: '列出目录中的文件'
  })
  @UseMiddleware('security', 'logging')
  async listFiles(
    @Input(z.string().describe('目录路径')) directoryPath: string,
    @Input(z.boolean().describe('是否递归').default(false)) recursive: boolean
  ) {
    try {
      const files = await fs.readdir(directoryPath);
      const fileList = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(directoryPath, file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            path: filePath,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            modified: stats.mtime
          };
        })
      );
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(fileList, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `错误: 无法读取目录 ${directoryPath}`
        }],
        isError: true
      };
    }
  }

  // 文件内容资源
  @McpResource({
    uri: 'file:///{path}',
    name: 'file-content',
    title: '文件内容',
    description: '读取指定路径的文件内容',
    isTemplate: true,
    middleware: ['fileAccess']
  })
  async getFileContent(request) {
    const url = new URL(request.params.uri);
    const filePath = url.pathname;
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);
      
      return {
        contents: [{
          uri: request.params.uri,
          mimeType: this.getMimeType(filePath),
          text: content,
          size: stats.size
        }]
      };
    } catch (error) {
      throw new Error(`无法读取文件: ${filePath}`);
    }
  }
  
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.css': 'text/css'
    };
    return mimeTypes[ext] || 'text/plain';
  }
}

const fileManagerPlugin = {
  name: 'file-manager-plugin',
  version: '1.0.0',
  description: '文件管理插件，提供文件操作工具和资源',
  services: [FileManagerService],
  
  configSchema: z.object({
    allowedDirectories: z.array(z.string()).default([]),
    maxFileSize: z.number().default(1024 * 1024) // 1MB
  }),
  
  hooks: {
    async onLoad() {
      console.log('📁 文件管理插件已加载');
    }
  }
};

export default fileManagerPlugin;
```

### 示例 2: API 集成插件

```typescript
import { McpTool, McpPrompt, Input, UseMiddleware } from '@sker/mcp';
import { z } from 'zod';

class WeatherService {
  @McpTool({
    name: 'get-weather',
    description: '获取指定城市的天气信息'
  })
  @UseMiddleware('cache', 'rateLimiting')
  async getWeather(
    @Input(z.string().describe('城市名称')) city: string,
    @Input(z.enum(['metric', 'imperial']).describe('温度单位').default('metric')) 
    units: 'metric' | 'imperial'
  ) {
    // 模拟 API 调用
    const weatherData = {
      city,
      temperature: 25,
      condition: 'sunny',
      humidity: 60,
      windSpeed: 10
    };
    
    return {
      content: [{
        type: 'text',
        text: `${city}的天气: ${weatherData.temperature}°C, ${weatherData.condition}`
      }]
    };
  }

  @McpPrompt({
    name: 'weather-advice',
    description: '基于天气信息生成建议提示'
  })
  async generateWeatherAdvice(
    @Input(z.string().describe('城市名称')) city: string
  ) {
    return {
      messages: [{
        role: 'system',
        content: {
          type: 'text',
          text: `你是一个天气助手，为用户提供基于 ${city} 当前天气的实用建议。`
        }
      }, {
        role: 'user',
        content: {
          type: 'text',
          text: `请告诉我今天在 ${city} 应该如何穿衣和安排活动。`
        }
      }]
    };
  }
}

const weatherPlugin = {
  name: 'weather-plugin',
  version: '1.0.0',
  description: '天气信息插件',
  services: [WeatherService],
  
  configSchema: z.object({
    apiKey: z.string(),
    defaultCity: z.string().default('Beijing'),
    cacheTimeout: z.number().default(300) // 5分钟
  }),
  
  hooks: {
    async onLoad() {
      const config = this.getConfig();
      if (!config.apiKey) {
        console.warn('⚠️  天气插件: 未配置 API Key');
      }
      console.log('🌤️  天气插件已加载');
    }
  }
};

export default weatherPlugin;
```

---

## 调试与测试

### 本地开发环境

创建测试脚本 `test-plugin.js`:

```javascript
import plugin from './index.js';

async function testPlugin() {
  console.log('🧪 开始测试插件...');
  
  try {
    // 模拟插件加载
    if (plugin.hooks?.onLoad) {
      await plugin.hooks.onLoad.call(plugin);
    }
    
    // 测试服务实例化
    const ServiceClass = plugin.services[0];
    const service = new ServiceClass();
    
    // 模拟工具调用（需要根据实际装饰器实现调整）
    console.log('✅ 插件测试通过');
    
  } catch (error) {
    console.error('❌ 插件测试失败:', error);
  } finally {
    // 模拟插件卸载
    if (plugin.hooks?.onUnload) {
      await plugin.hooks.onUnload.call(plugin);
    }
  }
}

testPlugin();
```

### 集成测试

使用 Sker MCP 的开发模式：

```bash
# 启动开发服务器（带热重载）
sker dev --watch

# 查看插件状态
sker plugin list

# 重载特定插件
sker plugin reload hello-world-plugin

# 查看插件详细信息
sker plugin info hello-world-plugin
```

### 日志调试

配置日志级别进行调试：

```bash
# 设置详细日志
export DEBUG=sker:*

# 或在 config/config.json 中配置
{
  "logging": {
    "level": "debug",
    "plugins": true
  }
}
```

---

## 部署与发布

### 打包插件

```bash
# 如果使用 TypeScript，先编译
npm run build

# 创建插件包
npm pack
```

### 安装插件

```bash
# 从本地路径安装
sker plugin install ./my-plugin

# 从 npm 安装
sker plugin install my-published-plugin

# 从 Git 仓库安装
sker plugin install git+https://github.com/user/plugin.git
```

### 发布到 npm

```bash
# 登录 npm
npm login

# 发布插件
npm publish

# 添加插件标签
npm dist-tag add my-plugin@1.0.0 latest
```

---

## 最佳实践

### 1. 插件设计原则

- **单一职责**: 每个插件专注一个功能域
- **最小权限**: 只申请必要的系统权限
- **向后兼容**: 保持 API 稳定性
- **错误处理**: 优雅处理所有异常情况

### 2. 性能优化

```typescript
// 使用缓存中间件
@McpTool({ name: 'cached-operation', description: '缓存操作' })
@UseMiddleware('cache')
async cachedOperation(request) {
  // 耗时操作
}

// 异步初始化
class OptimizedService {
  private initialized = false;
  private initPromise: Promise<void>;
  
  constructor() {
    this.initPromise = this.initialize();
  }
  
  private async initialize() {
    // 异步初始化逻辑
    this.initialized = true;
  }
  
  @McpTool({ name: 'optimized-tool', description: '优化工具' })
  async optimizedTool(request) {
    await this.initPromise; // 确保初始化完成
    // 工具逻辑
  }
}
```

### 3. 安全考虑

```typescript
// 输入验证
@McpTool({ name: 'secure-operation', description: '安全操作' })
async secureOperation(
  @Input(z.string().regex(/^[a-zA-Z0-9_-]+$/).describe('安全标识符')) 
  identifier: string
) {
  // 验证后的操作
}

// 权限检查
@McpTool({ name: 'admin-only', description: '管理员操作' })
@UseMiddleware('authentication', 'authorization')
async adminOnlyOperation(request) {
  // 需要管理员权限的操作
}
```

### 4. 文档和元数据

```typescript
// 详细描述
@McpTool({
  name: 'complex-calculation',
  description: '执行复杂数学计算，支持多种运算类型和精度设置'
})
async complexCalculation(
  @Input(z.number().describe('被操作数，支持浮点数')) operand1: number,
  @Input(z.number().describe('操作数，不能为零（除法时）')) operand2: number,
  @Input(z.enum(['add', 'subtract', 'multiply', 'divide', 'power'])
    .describe('运算类型：add(加法), subtract(减法), multiply(乘法), divide(除法), power(幂运算)'))
  operation: string,
  @Input(z.number().int().min(0).max(20).describe('结果精度（小数位数）').default(2))
  precision: number
) {
  // 实现逻辑
}
```

---

## 故障排除

### 常见问题

#### 1. 插件无法加载

**问题**: 插件目录存在但不被识别

**解决方案**:
- 检查 `package.json` 中是否有 `mcpPlugin: true`
- 确认插件目录在正确的 `plugins` 路径下
- 查看启动日志中的错误信息

```bash
# 检查插件发现日志
sker start --verbose

# 手动验证插件
sker plugin validate ./plugins/my-plugin
```

#### 2. 装饰器不工作

**问题**: 装饰器标记的方法未被注册

**解决方案**:
- 确保安装了 `reflect-metadata`
- 检查是否在入口文件中导入了 `reflect-metadata`
- 验证装饰器语法是否正确

```typescript
// 在插件入口添加
import 'reflect-metadata';

// 检查装饰器语法
@McpTool({  // 确保参数格式正确
  name: 'valid-name',
  description: 'Valid description'
})
async validMethod(request) { }
```

#### 3. 依赖注入失败

**问题**: 无法注入所需的服务

**解决方案**:
- 检查服务是否在容器中注册
- 确认 token 名称正确
- 验证插件权限配置

```typescript
// 检查注入的 token
@Inject('LOGGER')  // 确保 token 名称正确

// 在 package.json 中确认权限
{
  "mcp": {
    "permissions": {
      "parentServices": true  // 允许访问父容器服务
    }
  }
}
```

#### 4. 中间件不执行

**问题**: 应用的中间件不生效

**解决方案**:
- 检查中间件名称是否正确注册
- 确认中间件顺序
- 验证中间件实现是否正确

```typescript
// 确保中间件被正确注册
@UseMiddleware('logging', 'validation')  // 按顺序执行
```

### 调试技巧

#### 启用详细日志

```bash
# 环境变量方式
DEBUG=sker:plugin:* sker start

# 配置文件方式
{
  "logging": {
    "level": "debug",
    "categories": {
      "plugin": "debug",
      "injection": "debug"
    }
  }
}
```

#### 插件健康检查

```javascript
// 添加到插件中
const plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  
  hooks: {
    async onLoad() {
      console.log('✅ 插件加载检查点 1: 基础加载');
      
      // 检查依赖
      if (this.checkDependencies()) {
        console.log('✅ 插件加载检查点 2: 依赖检查通过');
      }
      
      // 检查配置
      if (this.validateConfig()) {
        console.log('✅ 插件加载检查点 3: 配置验证通过');
      }
      
      console.log('🎉 插件完全加载完成');
    }
  },
  
  checkDependencies() {
    // 依赖检查逻辑
    return true;
  },
  
  validateConfig() {
    // 配置验证逻辑  
    return true;
  }
};
```

### 性能监控

```typescript
class MonitoredService {
  @McpTool({ name: 'monitored-tool', description: '监控工具' })
  @UseMiddleware('performance')
  async monitoredTool(request) {
    const startTime = Date.now();
    
    try {
      // 工具逻辑
      const result = await this.doWork(request);
      
      // 记录成功指标
      this.recordMetrics('success', Date.now() - startTime);
      
      return result;
    } catch (error) {
      // 记录错误指标
      this.recordMetrics('error', Date.now() - startTime);
      throw error;
    }
  }
  
  private recordMetrics(status: string, duration: number) {
    console.log(`工具执行 ${status}: ${duration}ms`);
  }
}
```

---

## 总结

Sker MCP 插件系统提供了强大而灵活的扩展能力。通过本手册，你应该能够：

1. ✅ 理解 Sker MCP 的核心架构和设计理念
2. ✅ 创建功能完整的插件
3. ✅ 使用装饰器系统开发工具、资源和提示
4. ✅ 利用依赖注入和中间件系统
5. ✅ 应用最佳实践和安全考虑
6. ✅ 调试和优化插件性能
7. ✅ 解决常见问题

### 下一步

- 查看 [🏗️ 核心架构](./core-architecture.md) 了解系统架构
- 阅读 [🔌 插件系统](./plugin-system.md) 深入理解插件机制  
- 参考 [🛡️ 错误处理](./error-handling.md) 学习错误处理最佳实践
- 探索 [🚀 中间件系统](./middleware-system.md) 了解中间件开发

### 社区和支持

- GitHub Issues: 报告 Bug 和功能请求
- 文档贡献: 帮助改善文档
- 插件分享: 在社区分享你的插件

---

**Happy Coding!** 🚀