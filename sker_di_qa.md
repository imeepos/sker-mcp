# SKER-DI 知识库 QA 文档

🚀 **一切皆服务，一切皆可注入！**

## 🎯 基础概念

### 什么是 SKER-DI？

SKER-DI 是一个基于"一切皆服务，一切皆可注入"理念的 TypeScript 依赖注入框架，完全消除静态单例模式，提供了企业级的服务化依赖注入解决方案，支持多层级注入器架构、自动服务解析、调试工具等特性！

```typescript
import { createInjector, Injectable, Inject } from '@sker/di';

@Injectable({ providedIn: 'root' })
class UserService {
  getUser() { return { name: 'John', id: 1 }; }
}

const injector = createInjector([]);
const userService = injector.get(UserService); // 自动解析
console.log(userService.getUser()); // { name: 'John', id: 1 }
```

### 支持哪些注入器作用域？

SKER-DI 支持五种注入器作用域：`root`、`platform`、`application`、`feature`、`auto`，形成完整的层次结构！现在所有管理功能都通过DI服务实现！

```typescript
import { createInjector, Injectable, INJECTOR_REGISTRY } from '@sker/di';

@Injectable({ providedIn: 'root' })
class RootService { getValue() { return 'root-level'; } }

@Injectable({ providedIn: 'platform' })  
class PlatformService { getValue() { return 'platform-level'; } }

@Injectable({ providedIn: 'application' })
class AppService { getValue() { return 'app-level'; } }

// 🚀 服务化架构：通过DI服务管理层次结构
const rootInjector = createInjector([]); // 提供基础DI服务

// 获取注入器注册表服务 - 一切皆服务！
const injectorRegistry = rootInjector.get(INJECTOR_REGISTRY);

// 通过服务管理注入器生命周期 - 消除静态管理！
const platformInjector = injectorRegistry.createPlatformInjector();
const appInjector = injectorRegistry.createApplicationInjector();

// 服务会在对应作用域自动注册
const rootService = appInjector.get(RootService); // 从根注入器获取
const appService = appInjector.get(AppService);   // 从应用注入器获取
```

## 🏗️ 依赖注入核心

### 如何使用 @Injectable 装饰器？

@Injectable 装饰器用于标记类为可注入的服务，支持多种配置选项！

```typescript
import { Injectable, createInjector } from '@sker/di';

// 基础用法 - 自动解析
@Injectable({ providedIn: 'root' })
class BasicService {
  getData() { return 'basic-data'; }
}

// 工厂函数用法
@Injectable({
  providedIn: 'root',
  useFactory: () => new AdvancedService('config'),
  deps: []
})
class AdvancedService {
  constructor(private config: string) {}
  
  getConfig() { return this.config; }
}

// 不自动注册 - 需要手动配置
@Injectable({ providedIn: null })
class ManualService {
  process() { return 'manual'; }
}

const injector = createInjector([
  { provide: ManualService, useClass: ManualService }
]);
```

### 如何使用 @Inject 装饰器？

@Inject 装饰器用于标记构造函数参数的注入令牌，支持各种注入选项！

```typescript
import { Injectable, Inject, Optional, InjectionToken } from '@sker/di';

const API_URL = new InjectionToken<string>('API_URL');
const DEBUG_MODE = new InjectionToken<boolean>('DEBUG_MODE');

@Injectable({ providedIn: 'root' })
class HttpService {
  constructor(
    @Inject(API_URL) private apiUrl: string,
    @Inject(DEBUG_MODE) @Optional() private debug?: boolean
  ) {}
  
  request(path: string) {
    const url = `${this.apiUrl}${path}`;
    if (this.debug) console.log(`Request: ${url}`);
    return `Response from ${url}`;
  }
}

const injector = createInjector([
  { provide: API_URL, useValue: 'https://api.example.com' },
  { provide: DEBUG_MODE, useValue: true }
]);

const httpService = injector.get(HttpService);
console.log(httpService.request('/users')); // Request: https://api.example.com/users
```

### 支持哪些提供者类型？

SKER-DI 支持五种提供者类型：ValueProvider、ClassProvider、FactoryProvider、ExistingProvider、ConstructorProvider！

```typescript
import { createInjector, InjectionToken } from '@sker/di';

const CONFIG_TOKEN = new InjectionToken<any>('CONFIG');
const LOGGER_TOKEN = new InjectionToken<any>('LOGGER');

class DatabaseService {
  constructor(private config: any) {}
  connect() { return `Connected to ${this.config.host}`; }
}

class FileLogger {
  log(msg: string) { console.log(`[FILE] ${msg}`); }
}

const injector = createInjector([
  // ValueProvider - 直接提供值
  { provide: CONFIG_TOKEN, useValue: { host: 'localhost', port: 5432 } },
  
  // ClassProvider - 使用类构造函数
  { provide: DatabaseService, useClass: DatabaseService },
  
  // FactoryProvider - 使用工厂函数
  { 
    provide: 'DATABASE_CONNECTION', 
    useFactory: (config: any) => new DatabaseService(config),
    deps: [CONFIG_TOKEN]
  },
  
  // ExistingProvider - 别名映射
  { provide: LOGGER_TOKEN, useExisting: FileLogger },
  
  // ConstructorProvider - 类本身作为令牌
  { provide: FileLogger, useClass: FileLogger }
]);
```

## 🔧 高级特性

### 如何处理循环依赖？

SKER-DI 提供 forwardRef 来处理循环依赖问题！

```typescript
import { Injectable, Inject, forwardRef, createInjector } from '@sker/di';

@Injectable({ providedIn: null })
class ServiceA {
  constructor(@Inject(forwardRef(() => ServiceB)) private serviceB: ServiceB) {}
  
  methodA() {
    return `A calls ${this.serviceB.methodB()}`;
  }
}

@Injectable({ providedIn: null })
class ServiceB {
  constructor(@Inject(forwardRef(() => ServiceA)) private serviceA: ServiceA) {}
  
  methodB() {
    return 'B method';
  }
}

const injector = createInjector([
  { provide: ServiceA, useClass: ServiceA },
  { provide: ServiceB, useClass: ServiceB }
]);

const serviceA = injector.get(ServiceA);
console.log(serviceA.methodA()); // A calls B method
```

### 如何使用多值注入？

通过 multi: true 选项可以注册多个同令牌的提供者！

```typescript
import { createInjector, InjectionToken } from '@sker/di';

const PLUGINS = new InjectionToken<any[]>('PLUGINS');

class PluginA {
  name = 'PluginA';
  execute() { return 'A executed'; }
}

class PluginB {  
  name = 'PluginB';
  execute() { return 'B executed'; }
}

const injector = createInjector([
  { provide: PLUGINS, useClass: PluginA, multi: true },
  { provide: PLUGINS, useClass: PluginB, multi: true },
  { provide: PLUGINS, useValue: { name: 'Config', data: {} }, multi: true }
]);

const plugins = injector.get(PLUGINS);
console.log(plugins.length); // 3
plugins.forEach(plugin => {
  console.log(plugin.name); // PluginA, PluginB, Config
});
```

### 如何使用注入上下文？

注入上下文允许在特定注入器环境中执行函数！

```typescript
import { runInInjectionContext, getCurrentInjectionContext, assertInInjectionContext, Injectable, createInjector } from '@sker/di';

@Injectable({ providedIn: 'root' })
class ConfigService {
  getConfig() { return { theme: 'dark', lang: 'zh' }; }
}

function useConfig() {
  // 断言当前在注入上下文中
  const currentInjector = assertInInjectionContext('useConfig 必须在注入上下文中调用');
  const configService = currentInjector.get(ConfigService);
  return configService.getConfig();
}

const injector = createInjector([]);

// 在注入上下文中运行
const config = runInInjectionContext(injector, () => {
  return useConfig();
});

console.log(config); // { theme: 'dark', lang: 'zh' }

// 检查当前是否在注入上下文中
const currentContext = getCurrentInjectionContext(); // 在上下文外返回 null
```

## 🛠️ 平台架构系统

### 如何使用平台工厂？

平台工厂提供了创建全局单例平台的能力，支持扩展机制！

```typescript
import { createPlatformFactory, getPlatform, destroyPlatform, PlatformRef, PlatformModule } from '@sker/di';

// 定义平台模块
const webPlatformModule: PlatformModule = {
  config: { name: 'web-platform', version: '1.0.0' },
  providers: [
    { provide: 'PLATFORM_TYPE', useValue: 'web' },
    { provide: 'PLATFORM_NAME', useValue: 'WebPlatform' }
  ],
  extensions: [] // 可选的平台扩展
};

// 创建平台工厂函数
const createWebPlatform = createPlatformFactory(null, webPlatformModule);

// 创建平台实例（全局单例）
const platform = createWebPlatform();
const platformName = platform.injector.get('PLATFORM_NAME');
console.log(platformName); // WebPlatform

// 获取已存在的平台
const existingPlatform = getPlatform();
console.log(existingPlatform === platform); // true

// 销毁平台
destroyPlatform();
console.log(getPlatform()); // null
```

### 如何使用模块系统？

模块系统提供了组织和复用依赖配置的机制！

```typescript
import { Module, Injectable, createInjector, moduleResolver, INJECTOR_REGISTRY } from '@sker/di';

@Injectable({ providedIn: 'application' })
class UserService {
  getUsers() { return ['Alice', 'Bob']; }
}

@Injectable({ providedIn: 'application' })
class AuthService {
  isAuthenticated() { return true; }
}

@Module({
  providers: [
    { provide: 'API_BASE_URL', useValue: 'https://api.example.com' }
  ],
  exports: ['API_BASE_URL']
})
class CoreModule {}

@Module({
  imports: [CoreModule],
  providers: [
    UserService,
    AuthService,
    { provide: 'USER_CONFIG', useValue: { pageSize: 20 } }
  ],
  exports: [UserService, AuthService]
})
class UserModule {}

// 解析模块并创建注入器
const resolvedModule = moduleResolver.resolve(UserModule);

// 从解析的模块中获取提供者
const allProviders = resolvedModule.providers;

// 🚀 使用服务化方式创建应用注入器
const rootInjector = createInjector([]);
const injectorRegistry = rootInjector.get(INJECTOR_REGISTRY);
const appInjector = injectorRegistry.createApplicationInjector(allProviders);
const userService = appInjector.get(UserService);
const apiUrl = appInjector.get('API_BASE_URL'); // 从 CoreModule 导出
```

## 🐛 调试和开发工具

### 如何启用调试模式？

SKER-DI 提供了完整的调试工具，支持事件追踪、性能监控等！

```typescript
import { enableDevMode, createInjector, Injectable, getDebugger } from '@sker/di';

// 启用调试模式
enableDevMode({
  logToConsole: true,
  collectMetrics: true,
  maxEventHistory: 1000,
  includeStackTrace: true
});

@Injectable({ providedIn: 'root' })
class DebugService {
  process() { return 'debugging'; }
}

const injector = createInjector([
  { provide: 'CONFIG', useValue: { debug: true } }
]);

// 使用服务（会记录调试信息）
const service = injector.get(DebugService);
const config = injector.get('CONFIG');

// 获取调试信息
const debugger = getDebugger();
const debugInfo = debugger.getDebugInfo();

console.log('注入器数量:', debugInfo.totalInjectors);
console.log('事件数量:', debugInfo.recentEvents.length);
console.log('性能指标:', debugInfo.performanceMetrics);
```

### 如何使用调试检查器？

调试检查器提供了丰富的运行时分析功能！

```typescript
import { createInjector, Injectable, getInspector } from '@sker/di';

@Injectable({ providedIn: 'root' })
class UserService {
  getUsers() { return ['user1', 'user2']; }
}

@Injectable({ providedIn: 'root' })  
class AuthService {
  constructor(private userService: UserService) {}
  
  authenticate() { return true; }
}

const injector = createInjector([
  { provide: 'API_KEY', useValue: 'secret123' }
]);

// 使用服务
const authService = injector.get(AuthService);

// 获取检查器
const inspector = getInspector();

// 打印注入器层次结构
inspector.printHierarchy();

// 打印统计信息
inspector.printStats();

// 搜索令牌
const tokens = inspector.searchTokens('User');
console.log('找到的令牌:', tokens);

// 健康检查
const health = inspector.validateHealth();
console.log('健康状态检查结果:', health);

// 生成完整报告
const report = inspector.generateReport();
console.log('调试报告长度:', report.length);
```

## 🔍 参数装饰器

### 如何使用注入修饰符？

SKER-DI 提供了 Optional、Self、SkipSelf、Host 等修饰符来控制注入行为！

```typescript
import { Injectable, Inject, Optional, Self, SkipSelf, Host, createInjector, InjectionToken } from '@sker/di';

const CONFIG_TOKEN = new InjectionToken<any>('CONFIG');
const THEME_TOKEN = new InjectionToken<string>('THEME');

@Injectable({ providedIn: 'root' })
class ParentService {
  name = 'parent';
}

@Injectable({ providedIn: null })
class ChildService {
  constructor(
    // Optional - 如果没有找到，注入 undefined 而不是抛出错误
    @Inject(THEME_TOKEN) @Optional() private theme?: string,
    
    // Self - 只在当前注入器中查找，不向上查找
    @Inject(CONFIG_TOKEN) @Self() private config: any,
    
    // SkipSelf - 跳过当前注入器，从父注入器开始查找
    @Inject(ParentService) @SkipSelf() private parentService: ParentService,
    
    // Host - 在宿主注入器中查找
    @Inject('HOST_DATA') @Host() private hostData: any
  ) {}
  
  getInfo() {
    return {
      theme: this.theme || 'default',
      config: this.config,
      parent: this.parentService.name,
      hostData: this.hostData
    };
  }
}

const parentInjector = createInjector([
  { provide: ParentService, useClass: ParentService },
  { provide: 'HOST_DATA', useValue: { host: true } }
]);

const childInjector = createInjector([
  { provide: CONFIG_TOKEN, useValue: { child: true } },
  { provide: ChildService, useClass: ChildService }
], parentInjector);

const childService = childInjector.get(ChildService);
console.log(childService.getInfo());
```

## 🔄 生命周期管理

### 如何实现资源清理？

通过实现 OnDestroy 接口可以在注入器销毁时清理资源！

```typescript
import { Injectable, OnDestroy, createInjector } from '@sker/di';

@Injectable({ providedIn: null })
class ResourceService implements OnDestroy {
  private timer: NodeJS.Timeout | null = null;
  private connections: Set<any> = new Set();
  
  constructor() {
    this.timer = setInterval(() => {
      console.log('Resource service heartbeat');
    }, 1000);
  }
  
  addConnection(conn: any) {
    this.connections.add(conn);
  }
  
  onDestroy() {
    console.log('清理 ResourceService 资源');
    
    // 清理定时器
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    // 清理连接
    this.connections.forEach(conn => {
      if (conn.close) conn.close();
    });
    this.connections.clear();
  }
}

const injector = createInjector([
  { provide: ResourceService, useClass: ResourceService }
]);

const service = injector.get(ResourceService);
service.addConnection({ close: () => console.log('连接已关闭') });

// 销毁注入器时会自动调用所有服务的 onDestroy
injector.destroy();
```

## 🚀 性能优化

### 如何监控性能？

启用性能跟踪来监控注入器的性能表现！

```typescript
import { enableDevMode, createInjector, Injectable, getDebugger } from '@sker/di';

// 启用性能跟踪
enableDevMode({
  collectMetrics: true,
  logToConsole: false
});

@Injectable({ providedIn: 'root' })
class ServiceA {
  process() { return 'A'; }
}

@Injectable({ providedIn: 'root' })
class ServiceB {
  constructor(private serviceA: ServiceA) {}
  process() { return `B-${this.serviceA.process()}`; }
}

const injector = createInjector([]);

// 进行一些操作
for (let i = 0; i < 1000; i++) {
  injector.get(ServiceA);
  injector.get(ServiceB);
}

// 检查性能指标
const debugger = getDebugger();
const debugInfo = debugger.getDebugInfo();

console.log('性能指标:');
console.log('- 总注入次数:', debugInfo.metrics.totalInjections);
console.log('- 平均解析时间:', debugInfo.metrics.averageResolutionTime.toFixed(2), 'ms');
console.log('- 缓存命中率:', (debugInfo.metrics.cacheHitRate * 100).toFixed(1), '%');
console.log('- 实例总数:', debugInfo.metrics.totalInstancesCreated);
```

## 💡 最佳实践

### 如何组织大型应用的依赖注入？

推荐使用服务化的分层注入器架构来组织复杂应用！

```typescript
import { 
  createInjector,
  Injectable,
  INJECTOR_REGISTRY,
  APPLICATION_MANAGER
} from '@sker/di';

// 1. 基础层服务 (Root)
@Injectable({ providedIn: 'root' })
class LoggerService {
  log(message: string) { console.log(`[LOG] ${message}`); }
}

// 2. 平台层服务 (Platform)  
@Injectable({ providedIn: 'platform' })
class PlatformConfigService {
  getVersion() { return '1.0.0'; }
}

// 3. 应用层服务 (Application)
@Injectable({ providedIn: 'application' })
class AppConfigService {
  getAppName() { return 'MyApp'; }
}

// 4. 功能模块服务 (Feature)
@Injectable({ providedIn: 'feature' })
class UserFeatureService {
  constructor(private logger: LoggerService) {}
  
  getUserData() {
    this.logger.log('获取用户数据');
    return { id: 1, name: 'User' };
  }
}

// 🚀 服务化架构创建分层结构
async function setupApplication() {
  // 创建根注入器（提供基础DI服务）
  const rootInjector = createInjector([
    { provide: 'ROOT_CONFIG', useValue: { debug: true } }
  ]);
  
  // 获取服务管理器
  const injectorRegistry = rootInjector.get(INJECTOR_REGISTRY);
  const appManager = rootInjector.get(APPLICATION_MANAGER);
  
  // 通过服务创建平台层
  const platformInjector = injectorRegistry.createPlatformInjector([
    { provide: 'PLATFORM_CONFIG', useValue: { env: 'production' } }
  ]);
  
  // 通过服务创建应用
  const myApp = await appManager.createApplication('my-app', [
    { provide: 'APP_CONFIG', useValue: { theme: 'dark' } }
  ]);
  
  // 通过应用加载功能模块
  await myApp.loadFeature({
    name: 'user-feature',
    providers: [
      { provide: 'USER_CONFIG', useValue: { pageSize: 10 } }
    ]
  });
  
  // 获取功能服务
  const userFeatureRef = myApp.getFeatureRef('user-feature');
  const userService = userFeatureRef!.injector.get(UserFeatureService);
  const userData = userService.getUserData();
  
  console.log('用户数据:', userData);
}

setupApplication();
```

### 如何进行依赖注入的单元测试？

SKER-DI 提供了完善的测试支持，包括模拟注入器和服务替换！

```typescript
import { createInjector, Injectable, INJECTOR_REGISTRY } from '@sker/di';

@Injectable({ providedIn: 'root' })
class DatabaseService {
  async getData() {
    // 模拟数据库查询
    return ['data1', 'data2'];
  }
}

@Injectable({ providedIn: 'root' })
class UserService {
  constructor(private db: DatabaseService) {}
  
  async getUsers() {
    const data = await this.db.getData();
    return data.map(item => ({ name: item }));
  }
}

// 测试用例
describe('UserService', () => {
  let userService: UserService;
  let mockDbService: jasmine.SpyObj<DatabaseService>;
  
  beforeEach(() => {
    // 创建模拟服务
    mockDbService = jasmine.createSpyObj('DatabaseService', ['getData']);
    mockDbService.getData.and.returnValue(Promise.resolve(['mockData']));
    
    // 🚀 创建独立的测试注入器（自动隔离）
    const testInjector = createInjector([
      { provide: DatabaseService, useValue: mockDbService },
      { provide: UserService, useClass: UserService }
    ]);
    
    userService = testInjector.get(UserService);
  });
  
  it('应该返回用户数据', async () => {
    const users = await userService.getUsers();
    
    expect(mockDbService.getData).toHaveBeenCalled();
    expect(users).toEqual([{ name: 'mockData' }]);
  });
});
```

## ⚡ 错误处理和调试

### 如何处理常见的注入错误？

SKER-DI 提供了详细的错误信息来帮助调试依赖注入问题！

```typescript
import { createInjector, Injectable, Inject, Optional } from '@sker/di';

@Injectable({ providedIn: null })
class MissingService {
  getData() { return 'data'; }
}

@Injectable({ providedIn: null })
class TestService {
  constructor(
    // 错误：没有注册 MissingService
    // private missingService: MissingService, // 会抛出 No provider for MissingService
    
    // 正确：使用 Optional 装饰器
    @Optional() private optionalService?: MissingService
  ) {}
  
  process() {
    if (this.optionalService) {
      return this.optionalService.getData();
    }
    return 'fallback data';
  }
}

const injector = createInjector([
  { provide: TestService, useClass: TestService }
  // 注意：没有提供 MissingService
]);

try {
  const testService = injector.get(TestService);
  console.log(testService.process()); // fallback data
} catch (error: any) {
  console.error('注入错误:', error.message);
}
```

### 如何调试循环依赖问题？

启用循环依赖检测来自动发现和报告循环依赖！

```typescript
import { enableDevMode, createInjector, Injectable, Inject, forwardRef } from '@sker/di';

// 启用调试和跟踪
enableDevMode({
  collectMetrics: true,
  logToConsole: true,
  includeStackTrace: true
});

// 错误的循环依赖
@Injectable({ providedIn: null })
class CircularA {
  constructor(private serviceB: CircularB) {} // 会检测到循环依赖
}

@Injectable({ providedIn: null })
class CircularB {
  constructor(private serviceA: CircularA) {} // 会检测到循环依赖
}

// 正确的解决方案
@Injectable({ providedIn: null })
class FixedA {
  constructor(@Inject(forwardRef(() => FixedB)) private serviceB: FixedB) {}
}

@Injectable({ providedIn: null })
class FixedB {
  constructor(@Inject(forwardRef(() => FixedA)) private serviceA: FixedA) {}
}

try {
  const badInjector = createInjector([
    { provide: CircularA, useClass: CircularA },
    { provide: CircularB, useClass: CircularB }
  ]);
  
  badInjector.get(CircularA); // 会检测到循环依赖并报告
} catch (error: any) {
  console.error('循环依赖错误:', error.message);
}

// 使用修复版本
const goodInjector = createInjector([
  { provide: FixedA, useClass: FixedA },
  { provide: FixedB, useClass: FixedB }
]);

const fixedA = goodInjector.get(FixedA); // 正常工作
console.log('循环依赖已解决');
```

## 🚨 常见错误和解决方案

### TypeScript 依赖注入中的 `undefined` 错误

**错误现象：**
```
TypeError: Cannot read properties of undefined (reading 'method')
```

**常见原因和解决方案：**

#### 1. 缺少 `@Inject()` 装饰器

**❌ 错误写法：**
```typescript
@Injectable({ providedIn: 'auto' })
export class UserService {
  constructor(
    private logger: PlatformLoggerService,  // 缺少 @Inject 装饰器
    private config: PlatformConfigService   // TypeScript 元数据可能不完整
  ) {}
  
  getUser(id: string) {
    this.logger.log('info', `获取用户: ${id}`); // ❌ this.logger 是 undefined
  }
}
```

**✅ 正确写法：**
```typescript
@Injectable({ providedIn: 'auto' })
export class UserService {
  constructor(
    @Inject(PlatformLoggerService) private logger: PlatformLoggerService,
    @Inject(PlatformConfigService) private config: PlatformConfigService
  ) {}
  
  getUser(id: string) {
    this.logger.log('info', `获取用户: ${id}`); // ✅ 正常工作
  }
}
```

**经验教训：**
- **始终使用 `@Inject()` 装饰器** - 即使 TypeScript 能推断类型，也要显式指定注入令牌
- **不要依赖 TypeScript 自动元数据** - 在复杂的依赖注入场景中，自动元数据可能不完整

#### 2. 注入器作用域不匹配

**❌ 错误写法：**
```typescript
// DataService 在根注入器中，但依赖平台级服务
@Injectable({ providedIn: 'root' })
export class DataService {
  constructor(
    @Inject(PlatformCacheService) private cache: PlatformCacheService  // 无法找到平台服务
  ) {}
}
```

**✅ 正确写法：**
```typescript
// DataService 应该在应用注入器中，这样能访问平台服务
@Injectable({ providedIn: 'application' })
export class DataService {
  constructor(
    @Inject(PlatformCacheService) private cache: PlatformCacheService  // ✅ 可以访问
  ) {}
}
```

**作用域访问规则：**
- `root` 注入器：只能访问 `root` 级服务
- `platform` 注入器：可以访问 `platform` 和 `root` 级服务  
- `application` 注入器：可以访问 `application`、`platform` 和 `root` 级服务
- `feature` 注入器：可以访问所有上级服务

#### 3. 注入器层次结构错误

**❌ 错误写法（旧API，已移除）：**
```typescript
// ❌ 这些函数已经被移除！
// const rootInjector = createRootInjector();
// const platformInjector = createPlatformInjector();
// const appInjector = createApplicationInjector();
```

**✅ 正确写法（服务化架构）：**
```typescript
// 🚀 使用服务化方式建立层次结构
const rootInjector = createInjector([]);           // 1. 创建根注入器（提供DI服务）
const injectorRegistry = rootInjector.get(INJECTOR_REGISTRY); // 2. 获取注入器注册表服务
const platformInjector = injectorRegistry.createPlatformInjector(); // 3. 通过服务创建平台注入器
const appInjector = injectorRegistry.createApplicationInjector();    // 4. 通过服务创建应用注入器
```

### No provider for Service 错误

**错误现象：**
```
NullInjector: No provider for PlatformCacheService
```

**常见原因和解决方案：**

#### 1. 服务未正确注册
```typescript
// ❌ 服务声明了作用域但注入器中找不到
@Injectable({ providedIn: 'platform' })
class PlatformService {}

// 在错误的注入器中查找
const rootInjector = createInjector([]); // 只提供根级服务
const service = rootInjector.get(PlatformService); // ❌ 根注入器找不到平台服务

// ✅ 正确的查找方式
const rootInjector = createInjector([]);
const injectorRegistry = rootInjector.get(INJECTOR_REGISTRY);
const platformInjector = injectorRegistry.createPlatformInjector();
const service = platformInjector.get(PlatformService); // ✅ 在正确的注入器中查找
```

#### 2. 服务化架构的正确使用顺序
```typescript
// ❌ 错误：试图使用已移除的API
// const appInjector = createApplicationInjector();  // ❌ 函数已移除
// const platformInjector = createPlatformInjector(); // ❌ 函数已移除

// ✅ 正确：使用服务化方式  
const rootInjector = createInjector([]);                    // 1. 根注入器（提供DI服务）
const injectorRegistry = rootInjector.get(INJECTOR_REGISTRY); // 2. 获取服务
const platformInjector = injectorRegistry.createPlatformInjector(); // 3. 通过服务创建
const appInjector = injectorRegistry.createApplicationInjector();    // 4. 通过服务创建
```

### 循环依赖检测错误

**错误现象：**
```
Error: Circular dependency detected
```

**解决方案：**
```typescript
// ✅ 使用 forwardRef 解决循环依赖
@Injectable({ providedIn: null })
class ServiceA {
  constructor(@Inject(forwardRef(() => ServiceB)) private serviceB: ServiceB) {}
}

@Injectable({ providedIn: null })  
class ServiceB {
  constructor(@Inject(forwardRef(() => ServiceA)) private serviceA: ServiceA) {}
}
```

## 📋 开发最佳实践清单

### ✅ 依赖注入检查清单

**服务定义：**
- [ ] 所有服务类都使用 `@Injectable()` 装饰器
- [ ] 明确指定 `providedIn` 作用域（`root`, `platform`, `application`, `feature`）
- [ ] 构造函数参数都使用 `@Inject()` 装饰器（不要依赖自动推断）
- [ ] 复杂依赖使用 `forwardRef()` 避免循环依赖

**注入器创建：**
- [ ] 按正确顺序创建注入器：Root → Platform → Application → Feature
- [ ] 验证注入器父子关系是否正确
- [ ] 在测试中创建独立注入器确保隔离

**错误处理：**
- [ ] 可选依赖使用 `@Optional()` 装饰器
- [ ] 启用调试模式进行问题诊断：`enableDevMode()`
- [ ] 使用 `try-catch` 处理注入失败的情况

**性能优化：**
- [ ] 合理使用服务作用域，避免不必要的实例创建
- [ ] 实现 `OnDestroy` 接口清理资源
- [ ] 启用性能跟踪监控注入器表现

### 🔧 调试技巧

**快速诊断依赖注入问题：**

```typescript
import { enableDevMode, getDebugger, getInspector } from '@sker/di';

// 1. 启用详细调试
enableDevMode({
  logToConsole: true,
  collectMetrics: true,
  includeStackTrace: true
});

// 2. 检查注入器层次结构
const inspector = getInspector();
inspector.printHierarchy();

// 3. 验证服务注册
const tokens = inspector.searchTokens('ServiceName');
console.log('找到的服务:', tokens);

// 4. 健康检查
const health = inspector.validateHealth();
console.log('健康检查结果:', health);
```

**常用调试命令：**
```bash
# 运行时调试
injector.getDebugSnapshot()          # 获取注入器快照
injector.getInjectorId()             # 获取注入器 ID
injector.parent                      # 检查父注入器

# 性能监控
getDebugger().getDebugInfo()          # 获取调试信息和性能指标
getDebugger().getDebugInfo().metrics  # 获取性能指标
```

## 🚀 服务化架构专题 FAQ

### 什么是"一切皆服务，一切皆可注入"？

SKER-DI 的核心理念是将所有系统组件都实现为可注入服务，完全消除静态单例模式：

```typescript
import { createInjector, INJECTOR_REGISTRY, PLATFORM_MANAGER, APPLICATION_MANAGER } from '@sker/di';

// 🚀 一切皆服务：所有管理组件都是服务
const rootInjector = createInjector([]);

// 注入器注册表服务 - 管理注入器生命周期
const injectorRegistry = rootInjector.get(INJECTOR_REGISTRY);

// 平台管理器服务 - 管理平台实例  
const platformManager = rootInjector.get(PLATFORM_MANAGER);

// 应用管理器服务 - 管理应用实例
const appManager = rootInjector.get(APPLICATION_MANAGER);

// 🔗 一切皆可注入：任何服务都可以注入任何依赖
```

### 为什么要消除静态单例模式？

静态单例模式有诸多问题，服务化架构提供了更好的解决方案：

**❌ 静态单例的问题：**
- 难以测试（无法Mock）
- 隐式依赖（难以追踪）
- 生命周期管理困难
- 无法进行依赖注入
- 违反单一职责原则

**✅ 服务化架构的优势：**
```typescript
// 传统静态单例（已移除）
// class GlobalPlatform {
//   private static instance: GlobalPlatform;
//   static getInstance() { return this.instance; }
// }

// 🚀 服务化架构
@Injectable({ providedIn: 'root' })
class PlatformManager implements IPlatformManager {
  getCurrentPlatform(): PlatformRef | null { /* 实现 */ }
  setPlatform(platform: PlatformRef): void { /* 实现 */ }
  // 可测试、可注入、生命周期可控
}
```

### 如何使用服务化的管理器？

所有管理功能都通过DI服务提供，支持完整的依赖注入：

```typescript
import { createInjector, INJECTOR_REGISTRY, APPLICATION_MANAGER } from '@sker/di';

// 创建根注入器（提供基础DI服务）
const rootInjector = createInjector([
  { provide: 'GLOBAL_CONFIG', useValue: { debug: true } }
]);

// 🚀 通过DI获取服务 - 一切皆可注入
const injectorRegistry = rootInjector.get(INJECTOR_REGISTRY);
const appManager = rootInjector.get(APPLICATION_MANAGER);

// 🚀 通过服务管理应用生命周期 - 一切皆服务
const myApp = await appManager.createApplication('my-app', [
  { provide: 'APP_NAME', useValue: 'MyApplication' }
]);

// 🚀 功能也是服务
await myApp.loadFeature({
  name: 'user-module',
  providers: [
    { provide: 'USER_CONFIG', useValue: { pageSize: 10 } }
  ]
});
```

### 如何在服务中注入其他管理服务？

所有管理服务都可以相互注入，形成完整的服务网络：

```typescript
@Injectable({ providedIn: 'root' })
class CustomService {
  constructor(
    @Inject(INJECTOR_REGISTRY) private injectorRegistry: IInjectorRegistry,
    @Inject(PLATFORM_MANAGER) private platformManager: IPlatformManager,
    @Inject(DI_DEBUGGER) private debugger: IDIDebugger
  ) {}

  async setupApplication() {
    // 🚀 通过注入的服务管理整个系统
    const platformInjector = this.injectorRegistry.createPlatformInjector();
    const platform = this.platformManager.getCurrentPlatform();
    
    this.debugger.logEvent({
      type: DebugEventType.PlatformEvent,
      metadata: { action: 'setupApplication' }
    });
  }
}

// 使用自定义服务
const rootInjector = createInjector([]);
const customService = rootInjector.get(CustomService);
await customService.setupApplication();
```

### 传统的全局函数还能使用吗？

**不能！** 传统的全局函数已经被完全移除，必须使用服务化方式：

```typescript
// ❌ 传统方式（这些API已被移除！）
// import { createRootInjector, createPlatformInjector } from '@sker/di';
// const rootInjector = createRootInjector();  // ❌ 函数不存在
// const platformInjector = createPlatformInjector(); // ❌ 函数不存在

// 🚀 推荐方式（服务化架构）
import { createInjector, INJECTOR_REGISTRY } from '@sker/di';
const rootInjector = createInjector([]);
const injectorRegistry = rootInjector.get(INJECTOR_REGISTRY);
const platformInjector = injectorRegistry.createPlatformInjector();
```

### 服务化架构对测试有什么好处？

服务化架构让测试变得更加简单和灵活：

```typescript
describe('CustomService', () => {
  let customService: CustomService;
  let mockInjectorRegistry: jasmine.SpyObj<IInjectorRegistry>;
  let mockPlatformManager: jasmine.SpyObj<IPlatformManager>;

  beforeEach(() => {
    // 🚀 所有服务都可以轻松Mock
    mockInjectorRegistry = jasmine.createSpyObj('InjectorRegistry', ['createPlatformInjector']);
    mockPlatformManager = jasmine.createSpyObj('PlatformManager', ['getCurrentPlatform']);

    const testInjector = createInjector([
      { provide: INJECTOR_REGISTRY, useValue: mockInjectorRegistry },
      { provide: PLATFORM_MANAGER, useValue: mockPlatformManager },
      { provide: CustomService, useClass: CustomService }
    ]);

    customService = testInjector.get(CustomService);
  });

  it('应该正确设置应用', async () => {
    await customService.setupApplication();
    
    expect(mockInjectorRegistry.createPlatformInjector).toHaveBeenCalled();
    expect(mockPlatformManager.getCurrentPlatform).toHaveBeenCalled();
  });
});
```

### 如何迁移现有代码到服务化架构？

迁移策略建议采用渐进式方式：

**第1步：引入服务化管理器**
```typescript
// ❌ 替换已移除的静态调用
// const rootInjector = getRootInjector(); // ❌ 函数已移除
// const platformInjector = createPlatformInjector(); // ❌ 函数已移除

// ✅ 使用服务化方式
const rootInjector = createInjector([]);
const injectorRegistry = rootInjector.get(INJECTOR_REGISTRY);
const platformInjector = injectorRegistry.createPlatformInjector();
```

**第2步：重构业务服务**
```typescript
// 将静态管理逻辑移入服务
@Injectable({ providedIn: 'root' })
class LegacyMigrationService {
  constructor(
    @Inject(INJECTOR_REGISTRY) private injectorRegistry: IInjectorRegistry
  ) {}

  // 逐步迁移原有功能
  migrateToServiceArchitecture() {
    // 原有逻辑服务化
  }
}
```

**第3步：更新测试**
```typescript
// 使用新的服务化测试模式
const testInjector = createInjector([
  { provide: INJECTOR_REGISTRY, useValue: mockRegistry }
]);
```

---

🎉 **恭喜！** 您已经掌握了 SKER-DI 的服务化架构理念和最佳实践。通过"一切皆服务，一切皆可注入"的设计原则，您能够构建更加灵活、可测试、可维护的 TypeScript 应用程序！