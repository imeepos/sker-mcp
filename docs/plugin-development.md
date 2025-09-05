# 📦 插件开发指南

## 快速开始

### 创建插件目录

默认在 `~/.sker/plugins` 目录下创建插件（可通过 `SKER_HOME_DIR` 环境变量修改）：

```bash
mkdir -p ~/.sker/plugins/my-plugin
cd ~/.sker/plugins/my-plugin
```

### 初始化 package.json

```json
{
  "name": "my-mcp-plugin",
  "version": "1.0.0",
  "description": "我的 MCP 插件",
  "main": "index.js",
  "mcpPlugin": true,
  "author": "开发者",
  "engines": {
    "node": ">=18.0.0",
    "sker": ">=1.0.0"
  },
  "dependencies": {
    "zod": "^3.25.76"
  }
}
```

**重要**: `mcpPlugin: true` 字段是必需的，用于标识这是一个 MCP 插件。

## 插件结构

### 基础插件模板

```typescript
// index.js
import { Tool, Resource, Prompt, Input } from '@sker/mcp';
import { z } from 'zod';

// 服务类 - 包含具体功能实现
class MyService {
  @Tool({
    name: 'my-tool',
    title: '我的工具',
    description: '执行自定义操作'
  })
  async myTool(
    @Input(z.string().describe('输入参数')) input: string
  ) {
    return {
      content: [{ type: 'text', text: `处理结果: ${input}` }]
    };
  }
}

// 插件主对象
const plugin = {
  name: 'my-mcp-plugin',
  version: '1.0.0',
  description: '我的 MCP 插件',
  services: [MyService],  // 导出的服务类

  // 生命周期钩子
  async onLoad() {
    console.log('插件加载完成');
  },

  async onUnload() {
    console.log('插件卸载完成');
  }
};

export default plugin;
```

## 开发工具 (Tools)

### 工具示例

```typescript
class CalculatorService {
  @Tool({
    name: 'calculate',
    description: '执行数学运算'
  })
  async calculate(
    @Input(z.number()) a: number,
    @Input(z.number()) b: number,
    @Input(z.enum(['add', 'subtract'])) operation: string
  ) {
    const result = operation === 'add' ? a + b : a - b;
    return { content: [{ type: 'text', text: `结果: ${result}` }] };
  }
}
```


## 开发资源 (Resources)

```typescript
class FileService {
  @Resource({
    name: 'plugin-config',
    uri: 'plugin://config'
  })
  async getConfig() {
    return {
      contents: [{
        uri: 'plugin://config',
        mimeType: 'application/json',
        text: JSON.stringify({
          name: 'My Plugin',
          version: '1.0.0',
          features: ['tools', 'resources']
        })
      }]
    };
  }
}
```

## 开发提示 (Prompts)

```typescript
class PromptService {
  @Prompt({
    name: 'code-review',
    metadata: {
      title: '代码审查提示',
      description: '生成代码审查的提示'
    }
  })
  async generateCodeReviewPrompt(
    @Input(z.string().describe('编程语言')) language: string,
    @Input(z.string().describe('代码内容')) code: string
  ) {
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `请审查以下 ${language} 代码：\n\n\`\`\`${language}\n${code}\n\`\`\``
        }
      }]
    };
  }
}
```

## 高级特性

### 依赖注入

插件可以使用依赖注入来获取系统服务：

```typescript
import { Inject } from '@sker/di';
import { Tool, Input } from '@sker/mcp';
import { z } from 'zod';

class DatabaseService {
  constructor(
    @Inject('LOGGER') private logger: any
  ) {}

  @Tool({ name: 'query-data', description: '从数据库查询数据' })
  async queryData(@Input(z.string()) query: string) {
    this.logger.info(`执行查询: ${query}`);
    // 查询逻辑...
  }
}
```

### 错误处理

```typescript
import { Tool, Input, ErrorHandler, ValidationErrorHandler } from '@sker/mcp';
import { z } from 'zod';

class ValidatedService {
  @Tool({ name: 'validate-email', description: '验证邮箱地址格式' })
  @ErrorHandler(ValidationErrorHandler)
  async validateEmail(@Input(z.string().email()) email: string) {
    return { content: [{ type: 'text', text: `邮箱 ${email} 有效` }] };
  }
}
```

### 中间件使用

```typescript
import { Tool, Input, UseMiddleware, LoggingMiddleware, CacheMiddleware } from '@sker/mcp';
import { z } from 'zod';

class OptimizedService {
  @Tool({ name: 'expensive-operation', description: '执行耗时的计算操作' })
  @UseMiddleware(LoggingMiddleware, CacheMiddleware)
  async expensiveOperation(@Input(z.number()) input: number) {
    const result = input ** 3;
    return { content: [{ type: 'text', text: `结果: ${result}` }] };
  }
}
```

## 生命周期钩子

```typescript
const plugin = {
  name: 'lifecycle-plugin',
  version: '1.0.0',
  description: '生命周期演示插件',
  services: [MyService],

  async onLoad() {
    console.log('🔌 插件加载中...');
    // 初始化资源、建立连接等
    await this.initializeResources();
  },

  async onUnload() {
    console.log('🔌 插件卸载中...');
    // 清理资源、关闭连接等
    await this.cleanup();
  },

  async onActivate() {
    console.log('✅ 插件激活');
    // 激活相关服务
  },

  async onDeactivate() {
    console.log('⏸️ 插件停用');
    // 停用相关服务
  },

  async initializeResources() {
    // 初始化逻辑
  },

  async cleanup() {
    // 清理逻辑
  }
};
```

## 测试插件

### 本地测试

```typescript
// test.js
import plugin from './index.js';

async function testPlugin() {
  // 加载插件
  await plugin.onLoad?.();
  
  // 测试服务
  const service = new plugin.services[0]();
  const result = await service.myTool('test input');
  
  console.log('测试结果:', result);
  
  // 卸载插件
  await plugin.onUnload?.();
}

testPlugin().catch(console.error);
```

### 启动时测试

将插件放入 `~/.sker/plugins` 目录后启动服务器：

```bash
npm run dev
```

查看启动日志确认插件正确加载。

## 最佳实践

### 1. 命名规范
- 插件名使用 kebab-case: `my-awesome-plugin`
- 工具名使用 kebab-case: `calculate-advanced`
- 类名使用 PascalCase: `CalculatorService`

### 2. 版本管理
- 遵循语义化版本规范
- 及时更新 package.json 中的版本号
- 考虑向后兼容性

### 3. 错误处理
- 总是处理可能的异常情况
- 提供有意义的错误信息
- 使用适当的错误处理装饰器

### 4. 性能优化
- 对耗时操作使用缓存中间件
- 避免在构造函数中执行重操作
- 合理使用异步操作

### 5. 文档编写
- 为每个工具提供清晰的描述
- 为参数提供详细的说明
- 包含使用示例

## 常见问题

### Q: 插件不能正常加载？
A: 检查 package.json 中是否包含 `mcpPlugin: true` 字段，确保入口文件路径正确。

### Q: 命名冲突如何处理？
A: 系统会自动处理冲突，默认使用最新版本。可以通过配置调整冲突策略。

### Q: 如何调试插件？
A: 使用 console.log 输出调试信息，启动服务器时会显示在控制台中。

### Q: 插件可以访问文件系统吗？
A: 可以，但建议通过项目管理器获取正确的路径，避免硬编码路径。

## 相关文档

- [🔌 插件系统](./plugin-system.md) - 插件系统架构详解
- [🛡️ 错误处理](./error-handling.md) - 错误处理机制
- [🚀 中间件系统](./middleware-system.md) - 中间件使用指南
- [📦 模块导入规范](./module-imports.md) - 统一的模块导入路径规范