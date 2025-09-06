#!/usr/bin/env node

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

import { createPlatformInjector, createRootInjector } from '@sker/di';
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
    console.error(`
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
    `.trim());
  }

  /**
   * 启动应用程序
   */
  private async startApplication(): Promise<void> {
    console.error('正在启动 MCP 应用程序...');

    try {
      await this.bootstrap.startApplication();

      console.error('✅ Sker Daemon MCP 服务器正在运行');
      console.error('📡 传输协议: stdio');
      console.error('📁 主目录:', process.env.SKER_HOME_DIR || '~/.sker');

      if (this.config.debug) {
        console.error('🐛 调试模式已启用');
      }

      // 保持进程运行
      this.keepAlive();

    } catch (error) {
      console.error('❌ 启动 MCP 应用程序失败:', error);
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
    if (this.config.debug) {
      const statusInterval = setInterval(() => {
        const application = this.bootstrap.getApplication();
        if (application?.isRunning()) {
          console.error(`🟢 状态: ${application.getStatus()}`);
        } else {
          clearInterval(statusInterval);
        }
      }, 30000); // 每30秒
    }
  }

  /**
   * 主运行方法
   */
  async run(): Promise<void> {
    try {
      console.error('🚀 正在启动 Sker Daemon MCP 服务器...');
      createPlatformInjector()
      // 应用配置到环境变量
      AppBootstrap.applyConfigToEnvironment(this.config);

      // 设置优雅关闭
      this.bootstrap.setupGracefulShutdown();

      // 启动应用程序
      await this.startApplication();

    } catch (error) {
      console.error('💥 启动期间发生致命错误:', error);

      // 尝试清理（如果可能）
      try {
        await this.bootstrap.stopApplication();
      } catch (cleanupError) {
        console.error('清理过程中出错:', cleanupError);
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
  createRootInjector([]);
  const app = new MainApplication();
  await app.run();
}

// 仅在这是主模块时运行
main().catch((error) => {
  console.error('💥 主程序执行失败:', error);
  process.exit(1);
});