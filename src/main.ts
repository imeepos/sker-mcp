/**
 * Sker Daemon MCP 服务器主入口点
 * 
 * 这是 Sker Daemon MCP 服务器应用程序的主要入口点。
 * 它设置依赖注入容器，配置所有提供程序，并启动 MCP 应用程序。
 * 
 * 特性：
 * - 使用 @sker/di 的依赖注入设置
 * - 反射元数据初始化
 * - 优雅的错误处理和日志记录
 * - 应用程序生命周期管理
 * - 插件系统初始化
 */
import "reflect-metadata"
import { createInjector, INJECTOR_REGISTRY } from '@sker/di';
import { AppBootstrap, AppConfig } from './common/app-bootstrap.js';
/**
 * 主应用程序类
 */
class MainApplication {
  private bootstrap: AppBootstrap;
  private config: AppConfig;

  /**
   * 构造函数从环境变量和命令行参数初始化配置
   */
  constructor() {
    const parsed = AppBootstrap.parseCommandLineArgs(process.argv);
    this.config = parsed.config;
    this.bootstrap = new AppBootstrap();

    if (parsed.showHelp) {
      this.showHelp();
      process.exit(0);
    }
  }

  /**
   * 显示帮助信息
   */
  private showHelp(): void {
    // Help is shown via stdio, so use process.stdout instead of console.error
    process.stdout.write(`
Sker Daemon MCP 服务器

用法: sker-mcp [选项]

选项:
  -d, --debug              启用调试模式
  --log-level <级别>       设置日志级别 (error|warn|info|debug|trace)
  -c, --config <文件>      使用自定义配置文件
  -h, --home <目录>        使用自定义主目录
  --help                   显示此帮助信息

环境变量:
  DEBUG=true               启用调试模式
  LOG_LEVEL=<级别>         设置日志级别
  CONFIG_FILE=<文件>       自定义配置文件路径
  SKER_HOME_DIR=<目录>     自定义主目录

示例:
  sker-mcp --debug
  sker-mcp --log-level debug --home ~/.sker-dev
  SKER_HOME_DIR=/custom/path sker-mcp
    `.trim() + '\n');
  }

  /**
   * 启动应用程序
   */
  private async startApplication(): Promise<void> {
    // Remove console output that interferes with MCP stdio protocol
    
    try {
      await this.bootstrap.startApplication();

      // MCP server is now running silently over stdio
      // Status messages removed to prevent JSON parsing errors
      
      // 保持进程运行
      this.keepAlive();

    } catch (error) {
      // Fatal startup errors - no console output to prevent MCP stdio interference
      throw error;
    }
  }

  /**
   * 保持进程运行并处理清理
   */
  private keepAlive(): void {
    // 由于 MCP 服务器的 stdio 传输，进程将保持运行
    // 此方法存在是为了处理任何额外的保活逻辑（如果需要）

    // 记录周期性状态（仅在调试模式下）
    // Debug status logging removed to prevent MCP stdio interference
    // Status monitoring can be enabled via proper logging system if needed
  }

  /**
   * 主运行方法
   */
  async run(): Promise<void> {
    try {
      // Remove startup message to prevent MCP stdio interference
      
      // 应用配置到环境变量
      AppBootstrap.applyConfigToEnvironment(this.config);

      // 设置优雅关闭
      this.bootstrap.setupGracefulShutdown();

      // 启动应用程序
      await this.startApplication();

    } catch (error) {
      // Fatal errors - no console output to prevent MCP stdio interference

      // 尝试清理（如果可能）
      try {
        await this.bootstrap.stopApplication();
      } catch (cleanupError) {
        // Cleanup errors - no console output to prevent MCP stdio interference
      }

      AppBootstrap.handleFatalError(error as Error, this.config.debug);
    }
  }
}

// 设置全局错误处理器
AppBootstrap.setupGlobalErrorHandlers();

/**
 * 入口点 - 创建并运行应用程序
 */
async function main(): Promise<void> {
  // 🚀 服务化架构：使用新的注入器创建方式
  // 1. 创建根注入器（提供基础DI服务）
  const rootInjector = createInjector([]);
  
  // 2. 获取注入器注册表服务
  const injectorRegistry = rootInjector.get(INJECTOR_REGISTRY);
  
  // 3. 通过服务创建平台注入器
  const platformInjector = injectorRegistry.createPlatformInjector();
  
  const app = new MainApplication();
  await app.run();
}

// 仅在这是主模块时运行
main().catch((error) => {
  // Fatal errors - no console output to prevent MCP stdio interference
  process.exit(1);
});