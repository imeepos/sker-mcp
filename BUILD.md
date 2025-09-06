# 构建系统文档

## 概述

本项目使用 [tsup](https://tsup.egoist.dev/) 作为主要构建工具，提供快速、现代化的 TypeScript 构建体验。

## 构建配置

### 主要特性

- ✅ **多格式输出**: 支持 CJS 和 ESM 格式
- ✅ **类型声明**: 自动生成 `.d.ts` 文件
- ✅ **多入口点**: 支持库和可执行文件的独立构建
- ✅ **Tree Shaking**: 生产环境下自动启用
- ✅ **源码映射**: 支持调试和错误追踪
- ✅ **代码分割**: 优化包大小和加载性能
- ✅ **外部依赖**: 正确处理 Node.js 和第三方依赖

### 构建目标

#### 1. 库构建
- **入口点**: `src/core/index.ts` 和其他核心模块
- **输出格式**: CJS (`*.cjs`) 和 ESM (`*.mjs`)
- **类型声明**: `*.d.ts` 文件
- **目标**: 作为库被其他项目引用

#### 2. 可执行文件构建
- **入口点**: `src/cli.ts` 和 `src/main.ts`
- **输出格式**: CJS (`*.js`)
- **特性**: 包含 shebang 头，支持直接执行

## 构建脚本

### 基本命令

```bash
# 构建项目
npm run build

# 监听模式构建
npm run build:watch

# 清理构建输出
npm run clean

# 类型检查（不生成文件）
npm run typecheck

# 构建并验证
npm run build:verify
```

### 开发命令

```bash
# 开发模式运行（使用 tsx）
npm run dev

# 构建监听 + 自动重启
npm run dev:build

# 测试
npm test
npm run test:watch
npm run test:coverage
```

## 输出结构

构建完成后，`dist/` 目录结构如下：

```
dist/
├── index.cjs                 # 主入口 (CJS)
├── index.mjs                 # 主入口 (ESM)
├── index.d.ts                # 主入口类型声明
├── cli.js                    # CLI 可执行文件
├── main.js                   # 主程序可执行文件
├── mcp-application.cjs       # 核心应用模块 (CJS)
├── mcp-application.mjs       # 核心应用模块 (ESM)
├── mcp-application.d.ts      # 核心应用类型声明
├── config/
│   ├── index.cjs
│   ├── index.mjs
│   └── index.d.ts
├── logging/
│   ├── index.cjs
│   ├── index.mjs
│   └── index.d.ts
└── ...                       # 其他模块
```

## 环境配置

### 环境变量

项目支持以下构建相关的环境变量：

- `NODE_ENV`: 环境模式 (`development` | `production`)
- `DEBUG`: 调试模式开关
- 其他配置见 `.env.example`

### 构建时变量

构建过程中会注入以下变量：

- `__VERSION__`: 来自 `package.json` 的版本号
- `__DEV__`: 开发模式标志

## 依赖处理

### 外部依赖

以下依赖被标记为外部依赖，不会被打包：

- `@modelcontextprotocol/sdk`
- `@sker/di`
- `winston`
- `winston-daily-rotate-file`
- `express`
- `reflect-metadata`
- `zod`

### 内部模块

所有 `src/` 下的模块都会被打包处理，支持：

- 路径别名解析
- TypeScript 装饰器
- ES6+ 语法转换

## 性能优化

### 生产构建

- **代码压缩**: 使用 esbuild 进行快速压缩
- **Tree Shaking**: 移除未使用的代码
- **代码分割**: 按需加载模块
- **名称保持**: 保持函数和类名，便于调试

### 开发构建

- **快速编译**: 跳过压缩和优化
- **源码映射**: 完整的调试信息
- **监听模式**: 文件变更时自动重新构建

## 故障排除

### 常见问题

1. **构建失败**
   ```bash
   # 清理并重新构建
   npm run clean && npm run build
   ```

2. **类型错误**
   ```bash
   # 单独运行类型检查
   npm run typecheck
   ```

3. **依赖问题**
   ```bash
   # 重新安装依赖
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

### 验证构建

运行构建验证脚本：

```bash
npm run verify-build
```

此脚本会检查：
- 所有预期文件是否存在
- 可执行文件权限
- package.json 导出配置

## 自定义配置

如需修改构建配置，编辑 `tsup.config.ts` 文件。主要配置选项：

- `entry`: 入口点配置
- `format`: 输出格式
- `external`: 外部依赖
- `esbuildOptions`: esbuild 选项

## 集成 CI/CD

在 CI/CD 流水线中使用：

```bash
# 安装依赖
pnpm install --frozen-lockfile

# 运行测试
npm test

# 类型检查
npm run typecheck

# 构建并验证
npm run build:verify
```