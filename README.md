# Sker Daemon MCP 服务器架构文档

## 📚 文档索引

### 核心架构
- [🏗️ **核心架构**](./docs/core-architecture.md) - 系统核心架构设计和分层结构

### 插件系统
- [🔌 **插件系统**](./docs/plugin-system.md) - 基于 Feature Injector 的动态插件架构
- [🏗️ **Feature Injector 设计**](./docs/plugin-feature-injector-design.md) - 插件隔离架构详细设计
- [📦 **插件开发指南**](./docs/plugin-development.md) - 插件开发和最佳实践
### 增强特性
- [🛡️ **错误处理**](./docs/error-handling.md) - 统一错误处理机制
- [🚀 **中间件系统**](./docs/middleware-system.md) - 洋葱模型中间件架构
- [📝 **日志系统**](./docs/logging-system.md) - Winston 分层日志架构

### 开发规范
- [📦 **模块导入规范**](./docs/module-imports.md) - 统一的模块导入路径规范

## 🎯 项目概述

Sker Mcp 是一个基于 Model Context Protocol (MCP) 的智能服务器，采用现代化的装饰器驱动架构设计，支持动态模块加载、依赖注入和可扩展的插件系统。

### 项目目录配置

项目默认运行在用户主目录的 `.sker` 文件夹下：
- **默认位置**: `~/.sker` (Linux/macOS) 或 `%USERPROFILE%\.sker` (Windows)
- **自定义目录**: 通过环境变量 `SKER_HOME_DIR` 可以覆盖默认路径
- **插件目录**: `{SKER_HOME_DIR}/plugins`
- **配置文件**: `{SKER_HOME_DIR}/config`

```bash
# 设置自定义项目目录
export SKER_HOME_DIR="/custom/path/to/sker"

# Windows 下设置
set SKER_HOME_DIR=C:\custom\path\to\sker
```

### 核心特性
- 🏗️ **装饰器架构**: 基于装饰器的声明式开发模式
- 💉 **依赖注入**: 基于 @sker/di 的依赖注入系统
- 🔧 **可扩展性**: 轻松添加新的工具、资源和提示
- 🚀 **元数据驱动**: 启动时自动搜集和注册功能
- 🔌 **插件系统**: 完整的插件发现、加载和冲突处理
- 📊 **状态管理**: 完整的生命周期管理
- 🛡️ **类型安全**: 完整的 TypeScript 类型支持
- 🎯 **智能参数映射**: @Input 装饰器支持自动参数映射和类型验证
- 🔄 **向后兼容**: 支持新版 @Input 装饰器和传统参数模式
- 🌐 **多传输协议**: 支持 stdio 和 HTTP 传输

### 技术栈
- **核心语言**: TypeScript 5.3+
- **运行时**: Node.js (ES2022)
- **MCP SDK**: @modelcontextprotocol/sdk ^1.17.5
- **依赖注入**: @sker/di ^1.0.4
- **类型验证**: Zod ^3.25.76
- **反射元数据**: reflect-metadata ^0.1.13

## 🏁 快速导航
**架构了解？** 参考 [🏗️ 核心架构](./docs/core-architecture.md)
**插件开发？** 阅读 [📦 插件开发指南](./docs/plugin-development.md)