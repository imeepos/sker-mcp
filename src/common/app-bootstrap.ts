/**
 * 应用启动器 - 共享应用程序启动和配置逻辑
 * 
 * 此模块提供统一的应用程序启动、配置解析和依赖注入设置功能，
 * 被 CLI 和主程序入口共享使用，避免代码重复。
 */

import 'reflect-metadata';
import { Injector, createInjector, INJECTOR_REGISTRY } from '@sker/di';
import { McpApplication } from '../core/mcp-application.js';
import { createMcpProviders, createPlatformProviders } from '../core/providers.js';

/**
 * 应用配置接口
 */
export interface AppConfig {
  /** 调试模式标志 */
  debug: boolean;
  /** 日志级别 */
  logLevel: string;
  /** 自定义配置文件路径 */
  configFile?: string;
  /** 自定义主目录 */
  homeDir?: string;
}

/**
 * 命令行参数解析结果
 */
export interface ParsedCliArgs {
  /** 解析的配置 */
  config: AppConfig;
  /** 是否显示帮助 */
  showHelp: boolean;
  /** 剩余的未处理参数 */
  remaining: string[];
}

/**
 * 应用启动器类
 */
export class AppBootstrap {
  private injector: Injector | null = null;
  private application: McpApplication | null = null;

  /**
   * 从环境变量解析基础配置
   */
  static parseEnvironmentConfig(): AppConfig {
    return {
      debug: process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development',
      logLevel: process.env.LOG_LEVEL || 'info',
      configFile: process.env.CONFIG_FILE,
      homeDir: process.env.SKER_HOME_DIR
    };
  }

  /**
   * 解析命令行参数（简单实现，适用于基本选项）
   */
  static parseCommandLineArgs(argv: string[], startIndex: number = 2): ParsedCliArgs {
    const config = AppBootstrap.parseEnvironmentConfig();
    let showHelp = false;
    const remaining: string[] = [];

    const args = argv.slice(startIndex);
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '--debug':
        case '-d':
          config.debug = true;
          break;

        case '--log-level':
          if (i + 1 < args.length) {
            const nextLevel = args[++i];
            if (nextLevel) {
              config.logLevel = nextLevel;
            }
          }
          break;

        case '--config':
        case '-c':
          if (i + 1 < args.length) {
            const nextConfig = args[++i];
            if (nextConfig) {
              config.configFile = nextConfig;
            }
          }
          break;

        case '--home':
          if (i + 1 < args.length) {
            const nextHome = args[++i];
            if (nextHome) {
              config.homeDir = nextHome;
            }
          }
          break;

        case '--help':
        case '-h':
          showHelp = true;
          break;

        default:
          // 将未识别的参数添加到剩余参数中
          remaining.push(arg);
          break;
      }
    }

    return { config, showHelp, remaining };
  }

  /**
   * 应用配置到环境变量
   */
  static applyConfigToEnvironment(config: AppConfig): void {
    if (config.homeDir) {
      process.env.SKER_HOME_DIR = config.homeDir;
    }

    if (config.configFile) {
      process.env.CONFIG_FILE = config.configFile;
    }

    if (config.debug) {
      process.env.DEBUG = 'true';
      process.env.NODE_ENV = 'development';
    }

    process.env.LOG_LEVEL = config.logLevel;
  }

  /**
   * 创建配置好的依赖注入容器
   */
  createInjector(): Injector {
    if (this.injector) {
      return this.injector;
    }

    // 🚀 服务化架构：使用新的注入器创建方式
    const rootInjector = createInjector([]);
    const injectorRegistry = rootInjector.get(INJECTOR_REGISTRY);
    
    // 通过服务创建应用注入器
    const providers = [
      ...createMcpProviders(),
      ...createPlatformProviders()
    ];
    
    this.injector = injectorRegistry.createApplicationInjector(providers);
    return this.injector;
  }

  /**
   * 创建 MCP 应用实例
   */
  createApplication(): McpApplication {
    if (this.application) {
      return this.application;
    }

    const injector = this.createInjector();
    this.application = injector.get(McpApplication);

    if (!this.application) {
      throw new Error('创建 McpApplication 实例失败');
    }

    return this.application;
  }

  /**
   * 设置优雅关闭处理
   */
  setupGracefulShutdown(): void {
    const application = this.createApplication();
    application.setupGracefulShutdown();
  }

  /**
   * 启动应用程序
   */
  async startApplication(): Promise<void> {
    const application = this.createApplication();
    await application.start();
  }

  /**
   * 停止应用程序
   */
  async stopApplication(): Promise<void> {
    if (this.application) {
      await this.application.stop();
    }
  }

  /**
   * 获取应用程序实例（如果存在）
   */
  getApplication(): McpApplication | null {
    return this.application;
  }

  /**
   * 统一的错误处理和退出逻辑
   */
  static handleFatalError(error: Error, debug: boolean = false): never {
    console.error('💥 致命错误:', error.message);
    if (debug) {
      console.error('堆栈信息:', error.stack);
    }
    process.exit(1);
  }

  /**
   * 设置全局异常处理器
   */
  static setupGlobalErrorHandlers(): void {
    process.on('uncaughtException', (error) => {
      console.error('💥 未捕获异常:', error);
      console.error('堆栈信息:', error.stack);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 未处理的 Promise 拒绝:', promise);
      console.error('原因:', reason);
      process.exit(1);
    });
  }
}