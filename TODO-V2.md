# TODO-V2.md - Sker Daemon MCP 服务器开发路线图

## 📋 项目分析总结

基于对设计文档和现有实现的深入分析，本文档详细列出了**已实现功能**、**未实现功能**和**需要改进的功能**，并制定了完整的开发路线图。

## 🎯 架构设计 vs 实际实现对比

### ✅ 已实现的核心功能

#### 1. 基础架构框架
- [x] **依赖注入系统**: 基于 @sker/di 的类型安全依赖注入
- [x] **装饰器系统**: @Tool、@Resource、@Prompt、@Input 装饰器实现
- [x] **项目管理**: ProjectManager 支持项目目录管理
- [x] **服务管理**: ServiceManager 支持 MCP 服务器基本功能
- [x] **应用生命周期**: McpApplication 支持启动/停止/重启
- [x] **基础类型定义**: 完整的 TypeScript 类型系统

#### 2. 装饰器系统实现
- [x] **@Tool 装饰器**: 工具定义和元数据收集
- [x] **@Resource 装饰器**: 资源定义和元数据收集  
- [x] **@Prompt 装饰器**: 提示定义和元数据收集
- [x] **@Input 装饰器**: 参数验证装饰器
- [x] **@UseMiddleware 装饰器**: 中间件支持
- [x] **@ErrorHandler 装饰器**: 错误处理装饰器

#### 3. 中间件和错误处理
- [x] **中间件系统**: 洋葱模型中间件执行器
- [x] **错误管理**: 基础错误管理器实现
- [x] **中间件类型**: 完整的中间件接口定义

#### 4. MCP 协议支持
- [x] **MCP Server**: 基于 @modelcontextprotocol/sdk 的服务器实现
- [x] **Transport 层**: Stdio 传输支持
- [x] **协议处理**: 工具、资源、提示的基础处理

### ❌ 未实现的关键功能

#### 1. Feature Injector 插件隔离架构 (Priority: CRITICAL)
- [ ] **插件隔离系统**: 每个插件独立的 Feature Injector
- [ ] **动态加载/卸载**: 插件运行时动态管理
- [ ] **服务实例预绑定**: 工具与服务实例的预绑定机制
- [ ] **冲突检测**: 插件名称和功能冲突处理
- [ ] **插件生命周期**: 完整的插件生命周期管理

#### 2. Winston 分层日志系统 (Priority: HIGH)
- [ ] **Winston Logger**: 企业级日志记录实现
- [ ] **分层日志架构**: Platform/Application/Plugin 分层日志
- [ ] **日志分离**: 不同层级的独立日志文件
- [ ] **Logger Factory**: 日志实例工厂和管理
- [ ] **日志轮转**: 自动日志轮转和归档

#### 3. 完整插件系统 (Priority: CRITICAL)
- [ ] **Plugin Discovery**: 自动插件发现和扫描
- [ ] **Plugin Loader**: 动态模块导入和加载
- [ ] **Plugin Manager**: 完整插件管理器实现
- [ ] **Plugin Validation**: 插件元数据验证
- [ ] **Plugin Hot Reload**: 开发时热重载支持

#### 4. 高级中间件系统 (Priority: MEDIUM)
- [ ] **内置中间件**: LoggingMiddleware、ValidationMiddleware、CacheMiddleware
- [ ] **中间件工厂**: 中间件实例创建和管理
- [ ] **性能监控中间件**: 执行时间和资源使用监控
- [ ] **认证中间件**: 用户身份验证和权限控制

#### 5. 企业级错误处理 (Priority: MEDIUM)
- [ ] **DefaultErrorHandler**: 通用错误处理器
- [ ] **ValidationErrorHandler**: 参数验证错误处理
- [ ] **BusinessErrorHandler**: 业务逻辑错误处理
- [ ] **错误恢复策略**: 重试机制、熔断器、降级策略
- [ ] **MCP 错误响应**: 符合 MCP 协议的错误格式

#### 6. 配置管理系统 (Priority: HIGH)
- [ ] **多层配置**: 环境变量 > 命令行 > 用户配置 > 默认配置
- [ ] **配置验证**: Zod Schema 配置验证
- [ ] **动态配置**: 运行时配置更新
- [ ] **插件配置**: 插件特定配置管理

### ⚠️ 需要改进的现有功能

#### 1. 服务管理器改进 (Priority: HIGH)
**当前问题**: 缺少插件服务的动态注册/注销机制
- [ ] 实现插件服务的预绑定注册
- [ ] 添加服务实例缓存和管理
- [ ] 支持工具/资源/提示的动态注销
- [ ] 集成 Feature Injector 架构

#### 2. 元数据收集器增强 (Priority: HIGH)  
**当前问题**: 缺少服务实例预绑定功能
- [ ] 实现 `createBoundTool` 方法
- [ ] 实现 `createBoundResource` 方法  
- [ ] 实现 `createBoundPrompt` 方法
- [ ] 支持插件 Feature Injector 集成

#### 3. 基础插件管理器升级 (Priority: CRITICAL)
**当前问题**: 仅为占位实现，缺少核心功能
- [ ] 替换为完整的插件系统实现
- [ ] 集成 Feature Injector 隔离架构
- [ ] 支持真实的插件加载和执行
- [ ] 添加插件元数据验证和冲突检测

#### 4. 日志系统升级 (Priority: HIGH)
**当前问题**: 仅有基础 ConsoleLogger，缺少企业级功能
- [ ] 替换为 Winston 日志系统
- [ ] 实现分层日志架构
- [ ] 支持文件日志和轮转
- [ ] 集成结构化日志记录

## 🗺️ 开发路线图

### Phase 1: 核心插件系统 (Week 1-2) - CRITICAL
**目标**: 实现 Feature Injector 插件隔离架构的核心功能

#### 1.1 Feature Injector 实现
- [ ] 实现 `FeatureInjector` 核心类
- [ ] 支持插件独立容器创建
- [ ] 实现父容器依赖继承机制
- [ ] 添加容器销毁和清理功能

#### 1.2 插件发现和加载
- [ ] 实现 `PluginDiscovery` 类
- [ ] 支持递归目录扫描
- [ ] 验证插件 package.json 元数据
- [ ] 实现 `PluginLoader` 动态导入

#### 1.3 插件管理器重构
- [ ] 替换现有基础实现
- [ ] 集成 Feature Injector 架构
- [ ] 实现插件生命周期管理
- [ ] 支持插件动态加载/卸载

#### 1.4 服务实例预绑定
- [ ] 实现工具预绑定机制
- [ ] 实现资源预绑定机制
- [ ] 实现提示预绑定机制
- [ ] 集成到 ServiceManager

### Phase 2: Winston 日志系统 (Week 2-3) - HIGH
**目标**: 实现企业级分层日志架构

#### 2.1 Winston Logger 实现
- [ ] 替换 MockWinstonLogger 为真实 Winston
- [ ] 实现多传输支持（Console、File、HTTP）
- [ ] 支持日志格式化和结构化
- [ ] 实现日志级别控制

#### 2.2 分层日志架构
- [ ] 实现 Platform Logger
- [ ] 实现 Application Logger  
- [ ] 实现 Plugin Logger (每个插件独立)
- [ ] 配置独立的日志文件路径

#### 2.3 Logger Factory 和管理
- [ ] 实现 `WinstonLoggerFactory`
- [ ] 支持组件特定 Logger 创建
- [ ] 集成依赖注入系统
- [ ] 实现 Logger 配置管理

#### 2.4 日志轮转和归档
- [ ] 配置自动日志轮转
- [ ] 实现日志文件压缩归档
- [ ] 支持日志保留策略
- [ ] 监控日志文件大小和数量

### Phase 3: 高级功能完善 (Week 3-4) - MEDIUM-HIGH

#### 3.1 配置管理系统
- [ ] 实现多层配置加载
- [ ] 支持环境变量覆盖
- [ ] 实现配置验证
- [ ] 支持插件特定配置

#### 3.2 企业级中间件
- [ ] 实现 `LoggingMiddleware`
- [ ] 实现 `ValidationMiddleware`
- [ ] 实现 `CacheMiddleware`
- [ ] 实现 `AuthenticationMiddleware`

#### 3.3 错误处理增强
- [ ] 实现各类错误处理器
- [ ] 支持错误恢复策略
- [ ] 集成日志记录
- [ ] 实现 MCP 错误格式

### Phase 4: 系统集成和优化 (Week 4-5) - MEDIUM

#### 4.1 系统集成测试
- [ ] 编写插件系统集成测试
- [ ] 测试 Feature Injector 隔离
- [ ] 验证日志分层功能
- [ ] 测试错误处理流程

#### 4.2 性能优化
- [ ] 实现插件预加载优化
- [ ] 添加性能监控中间件
- [ ] 优化内存使用
- [ ] 实现缓存机制

#### 4.3 开发体验优化
- [ ] 实现插件热重载
- [ ] 添加开发模式支持
- [ ] 完善错误消息和调试信息
- [ ] 实现插件开发工具

### Phase 5: 文档和示例 (Week 5-6) - LOW-MEDIUM

#### 5.1 更新架构文档
- [ ] 更新核心架构文档
- [ ] 完善插件开发指南
- [ ] 更新 API 参考文档
- [ ] 添加最佳实践指南

#### 5.2 示例和模板
- [ ] 创建插件模板
- [ ] 实现示例插件
- [ ] 添加使用场景演示
- [ ] 创建快速开始指南

## 📊 优先级分析

### 🔴 CRITICAL (必须优先完成)
1. **Feature Injector 插件隔离架构** - 系统核心架构
2. **插件系统完整实现** - 影响整体功能
3. **基础插件管理器升级** - 当前为占位实现

### 🟠 HIGH (重要且紧急)
1. **Winston 分层日志系统** - 企业级需求
2. **配置管理系统** - 系统配置基础
3. **服务管理器改进** - 核心服务管理
4. **元数据收集器增强** - 支持预绑定

### 🟡 MEDIUM (重要但不紧急)  
1. **高级中间件系统** - 功能增强
2. **企业级错误处理** - 稳定性保障
3. **系统集成和优化** - 性能和质量

### 🟢 LOW-MEDIUM (可以延后)
1. **开发体验优化** - 开发效率
2. **文档和示例** - 用户体验
3. **性能监控工具** - 运维支持

## 🎯 里程碑目标

### Milestone 1: 基础插件系统 (Week 2)
- ✅ Feature Injector 隔离架构运行
- ✅ 插件动态加载/卸载功能
- ✅ 服务实例预绑定机制

### Milestone 2: 企业级日志 (Week 3)  
- ✅ Winston 分层日志系统
- ✅ 日志文件分离和轮转
- ✅ Logger Factory 依赖注入

### Milestone 3: 功能完善 (Week 4)
- ✅ 配置管理系统
- ✅ 高级中间件集合
- ✅ 企业级错误处理

### Milestone 4: 系统优化 (Week 5)
- ✅ 性能优化和监控
- ✅ 开发体验改善
- ✅ 集成测试覆盖

### Milestone 5: 发布准备 (Week 6)
- ✅ 文档完善更新
- ✅ 示例和模板
- ✅ 发布准备就绪

## 📝 实现注意事项

### 架构一致性
- 严格遵循设计文档中的 Feature Injector 隔离原则
- 确保插件间完全隔离，避免相互影响
- 保持与现有装饰器系统的兼容性

### 向后兼容性
- 保持现有 API 接口不变
- 渐进式升级，避免破坏性更改
- 为现有功能提供升级路径

### 代码质量
- 保持完整的 TypeScript 类型安全
- 编写全面的单元测试和集成测试
- 遵循统一的代码规范和最佳实践

### 性能考虑
- 实现服务实例预绑定以优化执行性能
- 合理使用缓存减少重复计算
- 监控内存使用，防止内存泄漏

## 🔗 相关文档

- [核心架构设计](./docs/core-architecture.md)
- [插件系统架构](./docs/plugin-system.md) 
- [Feature Injector 设计](./docs/plugin-feature-injector-design.md)
- [错误处理系统](./docs/error-handling.md)
- [日志系统架构](./docs/logging-system.md)
- [中间件系统](./docs/middleware-system.md)
- [模块导入规范](./docs/module-imports.md)

---
*本文档将根据开发进展持续更新，确保开发路线图与实际实现保持同步。*