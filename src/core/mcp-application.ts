/**
 * MCP 应用程序主类
 * 
 * 该模块提供 Sker Daemon MCP 系统的主应用程序类。
 * 它协调启动和关闭过程，管理所有核心组件的生命周期，
 * 并为应用程序管理提供统一接口。
 */

import { Injectable, Inject } from '@sker/di';
import {
  type IMcpTool,
  type IMcpResource,
  type IMcpPrompt,
  type IMcpServerConfig,
} from './types';
import { ServiceManager } from './service-manager';
import { ProjectManager } from './project-manager';
import { PluginManager } from './plugin-manager';
import { LOGGER, MCP_SERVER_CONFIG } from './tokens';

/**
 * 应用程序状态枚举
 */
export enum ApplicationStatus {
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

/**
 * 应用程序生命周期事件类型
 */
export type ApplicationEvent =
  | 'starting'
  | 'started'
  | 'stopping'
  | 'stopped'
  | 'error';

/**
 * 应用程序事件监听器函数类型
 */
export type ApplicationEventListener = (event: ApplicationEvent, error?: Error) => void;

/**
 * 服务管理器接口
 */
export interface IServiceManager {
  /**
   * 启动服务管理器
   */
  start(): Promise<void>;

  /**
   * 停止服务管理器
   */
  stop(): Promise<void>;

  /**
   * 动态注册工具
   */
  registerTool(tool: IMcpTool): Promise<void>;

  /**
   * 动态注册资源
   */
  registerResource(resource: IMcpResource): Promise<void>;

  /**
   * 动态注册提示
   */
  registerPrompt(prompt: IMcpPrompt): Promise<void>;

  /**
   * 获取当前状态
   */
  getStatus(): 'starting' | 'running' | 'stopping' | 'stopped';
}

/**
 * 主 MCP 应用程序类
 * 
 * 该类作为整个 MCP 守护程序系统的中央协调器。
 * 它管理所有核心组件的生命周期，处理应用程序事件，
 * 并提供启动、停止和管理应用程序的统一接口。
 */
@Injectable({ providedIn: 'application' })
export class McpApplication {
  private status: ApplicationStatus = ApplicationStatus.STOPPED;
  private eventListeners: ApplicationEventListener[] = [];
  private startupPromise: Promise<void> | null = null;
  private shutdownPromise: Promise<void> | null = null;

  constructor(
    @Inject(ProjectManager) private readonly projectManager: ProjectManager,
    @Inject(ServiceManager) private readonly serviceManager: ServiceManager,
    @Inject(PluginManager) private readonly pluginManager: PluginManager,
    @Inject(MCP_SERVER_CONFIG) private readonly config: IMcpServerConfig,
    @Inject(LOGGER) private readonly logger: any
  ) {
    this.logger?.info('MCP 应用程序已初始化', {
      name: this.config.name,
      version: this.config.version
    });
  }

  /**
   * 启动 MCP 应用程序
   * 
   * 此方法协调完整的启动序列：
   * 1. 创建项目目录结构
   * 2. 初始化插件
   * 3. 启动服务管理器
   * 4. 设置 MCP 服务器和传输
   */
  async start(): Promise<void> {
    // 防止并发启动尝试
    if (this.startupPromise) {
      this.logger.error(`防止并发启动尝试`)
      return this.startupPromise;
    }

    // 如果已在运行，立即返回
    if (this.status === ApplicationStatus.RUNNING) {
      this.logger.error(`application is running`)
      return;
    }

    this.startupPromise = this.performStartup();

    try {
      await this.startupPromise;
    } finally {
      this.startupPromise = null;
    }
  }

  /**
   * 执行实际的启动序列
   */
  private async performStartup(): Promise<void> {
    try {
      this.setStatus(ApplicationStatus.STARTING);
      this.emitEvent('starting');

      this.logger.info('正在启动 MCP 应用程序...', {
        config: this.config
      });

      // 步骤 1: 创建项目目录结构
      this.logger?.debug('正在创建项目目录结构...');
      await this.projectManager.createProjectStructure();

      // 步骤 2: 初始化插件系统
      this.logger?.debug('正在初始化插件系统...');
      await this.initializePlugins();

      // 步骤 3: 启动服务管理器
      this.logger?.debug('正在启动服务管理器...');
      await this.serviceManager.start();

      this.setStatus(ApplicationStatus.RUNNING);
      this.emitEvent('started');

      this.logger.info('MCP 应用程序启动成功', {
        status: this.status,
        transport: this.config.transport
      });

    } catch (error) {
      this.setStatus(ApplicationStatus.ERROR);
      this.emitEvent('error', error as Error);

      this.logger.error('启动 MCP 应用程序失败', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });

      throw error;
    }
  }

  /**
   * 停止 MCP 应用程序
   * 
   * 此方法协调优雅的关闭序列：
   * 1. 停止服务管理器
   * 2. 卸载所有插件
   * 3. 清理资源
   */
  async stop(): Promise<void> {
    // 防止并发关闭尝试
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    // 如果已停止，立即返回
    if (this.status === ApplicationStatus.STOPPED) {
      return;
    }

    this.shutdownPromise = this.performShutdown();

    try {
      await this.shutdownPromise;
    } finally {
      this.shutdownPromise = null;
    }
  }

  /**
   * 执行实际的关闭序列
   */
  private async performShutdown(): Promise<void> {
    try {
      this.setStatus(ApplicationStatus.STOPPING);
      this.emitEvent('stopping');

      this.logger?.info('正在停止 MCP 应用程序...');

      // 步骤 1: 停止服务管理器
      this.logger?.debug('正在停止服务管理器...');
      await this.serviceManager.stop();

      // 步骤 2: 卸载所有插件
      this.logger?.debug('正在卸载插件...');
      await this.shutdownPlugins();

      this.setStatus(ApplicationStatus.STOPPED);
      this.emitEvent('stopped');

      this.logger?.info('MCP 应用程序停止成功');

    } catch (error) {
      this.setStatus(ApplicationStatus.ERROR);
      this.emitEvent('error', error as Error);

      this.logger?.error('关闭期间出错', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });

      throw error;
    }
  }

  /**
   * 初始化插件系统
   */
  private async initializePlugins(): Promise<void> {
    try {
      // 发现可用插件
      const pluginDirs = await this.projectManager.scanPluginsDirectory();

      this.logger?.debug('发现插件', {
        plugins: pluginDirs,
        count: pluginDirs.length
      });

      // 加载启用的插件
      for (const pluginName of pluginDirs) {
        try {
          await this.pluginManager.loadPlugin(pluginName);
          this.logger?.debug('已加载插件', { plugin: pluginName });

          // 获取插件的隔离实例并注册服务到 MCP Server
          const isolatedInstance = this.pluginManager.getIsolatedPlugin(pluginName);
          if (isolatedInstance) {
            try {
              await this.serviceManager.registerPluginPreBoundServices(isolatedInstance);
              this.logger?.debug('已注册插件服务到 MCP Server', { plugin: pluginName });
            } catch (registrationError) {
              this.logger?.error('注册插件服务失败', {
                plugin: pluginName,
                error: (registrationError as Error).message
              });
              // 服务注册失败，但插件已加载，继续处理其他插件
            }
          } else {
            this.logger?.warn('无法获取插件隔离实例', { plugin: pluginName });
          }
        } catch (error) {
          this.logger?.error('加载插件失败', {
            plugin: pluginName,
            error: (error as Error).message
          });
          // 即使一个插件失败也继续加载其他插件
        }
      }
    } catch (error) {
      this.logger?.error('插件初始化失败', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * 关闭插件系统
   */
  private async shutdownPlugins(): Promise<void> {
    try {
      const activePlugins = this.pluginManager.getActivePlugins();

      for (const plugin of activePlugins) {
        try {
          // 先取消注册插件服务
          try {
            await this.serviceManager.unregisterPluginPreBoundServices(plugin.name);
            this.logger?.debug('已取消注册插件服务', { plugin: plugin.name });
          } catch (unregisterError) {
            this.logger?.error('取消注册插件服务失败', {
              plugin: plugin.name,
              error: (unregisterError as Error).message
            });
            // 取消注册失败也继续卸载插件
          }

          await this.pluginManager.unloadPlugin(plugin.name);
          this.logger?.debug('已卸载插件', { plugin: plugin.name });
        } catch (error) {
          this.logger?.error('卸载插件失败', {
            plugin: plugin.name,
            error: (error as Error).message
          });
          // 即使一个插件失败也继续处理其他插件
        }
      }
    } catch (error) {
      this.logger?.error('插件关闭失败', {
        error: (error as Error).message
      });
      // 关闭期间不抛出异常 - 记录日志并继续
    }
  }

  /**
   * 重启应用程序
   */
  async restart(): Promise<void> {
    this.logger?.info('正在重启 MCP 应用程序...');
    await this.stop();
    await this.start();
  }

  /**
   * 获取当前应用程序状态
   */
  getStatus(): ApplicationStatus {
    return this.status;
  }

  /**
   * 检查应用程序是否正在运行
   */
  isRunning(): boolean {
    return this.status === ApplicationStatus.RUNNING;
  }

  /**
   * 获取应用程序信息
   */
  getInfo(): {
    name: string;
    version: string;
    status: ApplicationStatus;
    config: IMcpServerConfig;
  } {
    return {
      name: this.config.name,
      version: this.config.version,
      status: this.status,
      config: this.config
    };
  }

  /**
   * 为应用程序事件添加事件监听器
   */
  addEventListener(listener: ApplicationEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: ApplicationEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index >= 0) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * 设置应用程序状态并记录变更
   */
  private setStatus(status: ApplicationStatus): void {
    const previousStatus = this.status;
    this.status = status;

    this.logger?.debug('应用程序状态已变更', {
      from: previousStatus,
      to: status
    });
  }

  /**
   * 向所有监听器发出应用程序事件
   */
  private emitEvent(event: ApplicationEvent, error?: Error): void {
    this.logger?.debug('正在发出应用程序事件', { event, error: error?.message });

    for (const listener of this.eventListeners) {
      try {
        listener(event, error);
      } catch (listenerError) {
        this.logger?.error('事件监听器错误', {
          event,
          error: (listenerError as Error).message
        });
        // 即使一个监听器失败也继续处理其他监听器
      }
    }
  }

  /**
   * 设置优雅关闭处理器
   */
  setupGracefulShutdown(): void {
    const shutdownHandler = (signal: string) => {
      this.logger?.info(`接收到 ${signal} 信号，正在优雅关闭...`);

      this.stop()
        .then(() => {
          this.logger?.info('关闭完成');
          process.exit(0);
        })
        .catch((error) => {
          this.logger?.error('关闭期间出错', { error: error.message });
          process.exit(1);
        });
    };

    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));

    // 处理未捕获异常
    process.on('uncaughtException', (error) => {
      this.logger?.error('未捕获异常', {
        error: error.message,
        stack: error.stack
      });

      this.setStatus(ApplicationStatus.ERROR);
      this.emitEvent('error', error);

      // 尝试优雅关闭
      this.stop()
        .finally(() => process.exit(1));
    });

    // 处理未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));

      this.logger?.error('未处理的 Promise 拒绝', {
        error: error.message,
        stack: error.stack
      });

      this.setStatus(ApplicationStatus.ERROR);
      this.emitEvent('error', error);

      // 尝试优雅关闭
      this.stop()
        .finally(() => process.exit(1));
    });
  }
}