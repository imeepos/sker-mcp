/**
 * Sker Daemon MCP 服务器主入口点
 * 
 * 这是 Sker Daemon MCP 服务器应用程序的主要入口点。
 * 它使用核心平台工厂启动 MCP 应用程序。
 * 
 * 特性：
 * - 基于平台工厂的依赖注入设置
 * - 反射元数据初始化
 * - 优雅的错误处理和日志记录
 * - 应用程序生命周期管理
 * - 插件系统初始化
 */
import "reflect-metadata"
import { createMcpApplication, runApplication } from './corePlatofrm.js';
import { AppBootstrap, AppConfig } from './common/app-bootstrap.js';
/**
 * 主应用程序类 - 简化版本，使用平台工厂
 */
class MainApplication {
  private config: AppConfig;

  /**
   * 构造函数从环境变量和命令行参数初始化配置
   */
  constructor() {
    const parsed = AppBootstrap.parseCommandLineArgs(process.argv);
    this.config = parsed.config;

    if (parsed.showHelp) {
      this.showHelp();
      process.exit(0);
    }
  }

  /**
   * 显示帮助信息
   */
  private showHelp(): void {
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
   * 主运行方法 - 使用平台工厂
   */
  async run(): Promise<void> {
    try {
      // 应用配置到环境变量
      AppBootstrap.applyConfigToEnvironment(this.config);

      // 使用平台工厂创建 MCP 应用
      const application = await createMcpApplication();
      
      // 设置优雅关闭
      application.setupGracefulShutdown();

      // 启动应用程序
      await application.start();

    } catch (error) {
      AppBootstrap.handleFatalError(error as Error, this.config.debug);
    }
  }
}

/**
 * 入口点 - 使用统一的应用程序启动
 */
async function main(): Promise<void> {
  const app = new MainApplication();
  await app.run();
}

// 仅在这是主模块时运行 - 使用统一的错误处理
runApplication(main);