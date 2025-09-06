#!/usr/bin/env node

/**
 * Sker Daemon MCP 服务器命令行界面
 * 
 * 该模块为管理 Sker Daemon MCP 服务器提供命令行界面。
 * 包含启动、停止、状态检查、插件管理和配置管理等命令。
 */

import { createPlatformInjector, createRootInjector } from '@sker/di';
import { AppBootstrap } from './common/app-bootstrap.js';
import { ProjectManager } from './core/project-manager.js';
import { HotReloadManager } from './dev/hot-reload-manager.js';
import { promises as fs } from 'fs';
import path from 'path';
import { Logger } from 'winston';
import { LayeredLoggerFactory } from './core/logging/layered-logger.js';

/**
 * CLI 命令接口
 */
interface CliCommand {
  name: string;
  description: string;
  aliases?: string[];
  args?: string[];
  options?: string[];
  handler: (args: string[], options: Record<string, any>) => Promise<void>;
}


/**
 * 解析的 CLI 参数接口
 */
interface ParsedArgs {
  command: string;
  args: string[];
  options: Record<string, any>;
}

/**
 * 主 CLI 类
 */
class SkerCli {
  private commands: Map<string, CliCommand> = new Map();
  private bootstrap: AppBootstrap;

  constructor() {
    this.bootstrap = new AppBootstrap();
    this.setupCommands();
  }

  /**
   * 设置所有可用的 CLI 命令
   */
  private setupCommands(): void {
    // 启动命令
    this.addCommand({
      name: 'start',
      description: '启动 MCP 服务器',
      aliases: ['run'],
      handler: this.handleStart.bind(this)
    });

    // 状态命令
    this.addCommand({
      name: 'status',
      description: '显示服务器状态信息',
      aliases: ['info'],
      handler: this.handleStatus.bind(this)
    });

    // 初始化命令
    this.addCommand({
      name: 'init',
      description: '初始化项目目录结构',
      handler: this.handleInit.bind(this)
    });

    // 插件命令
    this.addCommand({
      name: 'plugin',
      description: '插件管理命令',
      args: ['action', 'plugin-name?'],
      handler: this.handlePlugin.bind(this)
    });

    // 配置命令
    this.addCommand({
      name: 'config',
      description: '配置管理命令',
      args: ['action', 'key?', 'value?'],
      handler: this.handleConfig.bind(this)
    });

    // 开发命令
    this.addCommand({
      name: 'dev',
      description: '开发模式命令',
      args: ['action?'],
      handler: this.handleDev.bind(this)
    });

    // 版本命令
    this.addCommand({
      name: 'version',
      description: '显示版本信息',
      aliases: ['v'],
      handler: this.handleVersion.bind(this)
    });
  }

  /**
   * 向 CLI 添加命令
   */
  private addCommand(command: CliCommand): void {
    this.commands.set(command.name, command);

    // 注册别名
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commands.set(alias, command);
      }
    }
  }

  /**
   * 解析命令行参数
   */
  private parseArguments(argv: string[]): ParsedArgs {
    const args = argv.slice(2);
    const result: ParsedArgs = {
      command: args[0] || 'help',
      args: [],
      options: {}
    };

    let i = 1; // 跳过命令
    while (i < args.length) {
      const arg = args[i];
      if (!arg) break;

      if (arg.startsWith('--')) {
        // 长选项
        const optionName = arg.slice(2);
        const nextArg = args[i + 1];

        if (nextArg && !nextArg.startsWith('-')) {
          result.options[optionName] = nextArg;
          i += 2;
        } else {
          result.options[optionName] = true;
          i++;
        }
      } else if (arg.startsWith('-')) {
        // 短选项
        const optionName = arg.slice(1);
        const nextArg = args[i + 1];

        if (nextArg && !nextArg.startsWith('-')) {
          result.options[optionName] = nextArg;
          i += 2;
        } else {
          result.options[optionName] = true;
          i++;
        }
      } else {
        // 常规参数
        result.args.push(arg);
        i++;
      }
    }

    return result;
  }

  /**
   * 获取配置好的项目管理器
   */
  private getProjectManager(): ProjectManager {
    const injector = this.bootstrap.createInjector();
    return injector.get(ProjectManager);
  }

  /**
   * 处理启动命令
   */
  private async handleStart(_args: string[], options: Record<string, any>): Promise<void> {
    console.log('🚀 正在启动 Sker Daemon MCP 服务器...');

    try {
      // 应用选项到环境变量
      const config = AppBootstrap.parseEnvironmentConfig();
      if (options.home) {
        config.homeDir = options.home;
      }
      if (options.debug) {
        config.debug = true;
      }
      if (options.config) {
        config.configFile = options.config;
      }

      AppBootstrap.applyConfigToEnvironment(config);

      // 设置优雅关闭
      this.bootstrap.setupGracefulShutdown();

      // 启动应用程序
      await this.bootstrap.startApplication();

      console.log('✅ 服务器启动成功');
      console.log('📡 正在监听 stdio 传输');

      // 保持运行
      process.stdin.resume();

    } catch (error) {
      console.error('❌ 启动服务器失败:', (error as Error).message);
      if (options.debug) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  }

  /**
   * 处理状态命令
   */
  private async handleStatus(_args: string[], options: Record<string, any>): Promise<void> {
    console.log('📊 Sker Daemon MCP 服务器状态\n');

    try {
      const projectManager = this.getProjectManager();

      // 显示目录信息
      console.log('📁 目录信息:');
      console.log(`   主目录: ${projectManager.getHomeDirectory()}`);
      console.log(`   插件: ${projectManager.getPluginsDirectory()}`);
      console.log(`   配置: ${projectManager.getConfigDirectory()}`);
      console.log(`   日志: ${projectManager.getLogsDirectory()}`);
      console.log();

      // 检查目录存在性
      const homeExists = await this.directoryExists(projectManager.getHomeDirectory());
      const pluginsExists = await this.directoryExists(projectManager.getPluginsDirectory());
      const configExists = await this.directoryExists(projectManager.getConfigDirectory());
      const logsExists = await this.directoryExists(projectManager.getLogsDirectory());

      console.log('🗂️  目录状态:');
      console.log(`   主目录: ${homeExists ? '✅ 存在' : '❌ 缺失'}`);
      console.log(`   插件: ${pluginsExists ? '✅ 存在' : '❌ 缺失'}`);
      console.log(`   配置: ${configExists ? '✅ 存在' : '❌ 缺失'}`);
      console.log(`   日志: ${logsExists ? '✅ 存在' : '❌ 缺失'}`);
      console.log();

      // 扫描插件
      if (pluginsExists) {
        const plugins = await projectManager.scanPluginsDirectory();
        console.log(`🔌 插件 (${plugins.length}):`);
        if (plugins.length > 0) {
          for (const plugin of plugins) {
            const hasPackageJson = await projectManager.hasValidPluginPackageJson(plugin);
            console.log(`   ${plugin}: ${hasPackageJson ? '✅ 有效' : '❌ 无效'}`);
          }
        } else {
          console.log('   未找到插件');
        }
        console.log();
      }

      // 环境信息
      console.log('🌍 环境信息:');
      console.log(`   Node.js: ${process.version}`);
      console.log(`   平台: ${process.platform}`);
      console.log(`   架构: ${process.arch}`);
      console.log(`   工作目录: ${process.cwd()}`);
      console.log();

      // 配置信息
      console.log('⚙️  配置:');
      console.log(`   SKER_HOME_DIR: ${process.env.SKER_HOME_DIR || '未设置'}`);
      console.log(`   DEBUG: ${process.env.DEBUG || 'false'}`);
      console.log(`   LOG_LEVEL: ${process.env.LOG_LEVEL || 'info'}`);
      console.log(`   CONFIG_FILE: ${process.env.CONFIG_FILE || '未设置'}`);

    } catch (error) {
      console.error('❌ 获取状态失败:', (error as Error).message);
      if (options.debug) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  }

  /**
   * 处理初始化命令
   */
  private async handleInit(_args: string[], options: Record<string, any>): Promise<void> {
    console.log('🏗️  正在初始化 Sker Daemon MCP 项目...');

    try {
      const projectManager = this.getProjectManager();

      // 创建目录结构
      await projectManager.createProjectStructure();

      console.log('✅ 项目结构已创建:');
      console.log(`   📁 ${projectManager.getHomeDirectory()}`);
      console.log(`   📁 ${projectManager.getPluginsDirectory()}`);
      console.log(`   📁 ${projectManager.getConfigDirectory()}`);
      console.log(`   📁 ${projectManager.getLogsDirectory()}`);

    } catch (error) {
      console.error('❌ 初始化项目失败:', (error as Error).message);
      if (options.debug) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  }

  /**
   * 处理插件命令
   */
  private async handlePlugin(args: string[], options: Record<string, any>): Promise<void> {
    const action = args[0];
    const pluginName = args[1];

    switch (action) {
      case 'list':
        await this.listPlugins(options);
        break;
      case 'info':
        if (!pluginName) {
          console.error('❌ info 命令需要插件名称');
          process.exit(1);
        }
        await this.showPluginInfo(pluginName, options);
        break;
      default:
        console.log('🔌 插件命令:');
        console.log('   list              列出所有可用插件');
        console.log('   info <名称>        显示插件信息');
        break;
    }
  }

  /**
   * 列出所有插件
   */
  private async listPlugins(options: Record<string, any>): Promise<void> {
    try {
      const projectManager = this.getProjectManager();

      const plugins = await projectManager.scanPluginsDirectory();

      console.log(`🔌 可用插件 (${plugins.length}):\n`);

      if (plugins.length === 0) {
        console.log('   未找到插件');
        console.log(`   插件目录: ${projectManager.getPluginsDirectory()}`);
        return;
      }

      for (const plugin of plugins) {
        const hasValidPackageJson = await projectManager.hasValidPluginPackageJson(plugin);
        const status = hasValidPackageJson ? '✅ 有效' : '❌ 无效';
        console.log(`   ${plugin}: ${status}`);
      }

    } catch (error) {
      console.error('❌ 列出插件失败:', (error as Error).message);
      if (options.debug) {
        console.error((error as Error).stack);
      }
    }
  }

  /**
   * 显示插件信息
   */
  private async showPluginInfo(pluginName: string, options: Record<string, any>): Promise<void> {
    try {
      const projectManager = this.getProjectManager();

      const pluginExists = await projectManager.pluginDirectoryExists(pluginName);
      if (!pluginExists) {
        console.error(`❌ 插件 '${pluginName}' 未找到`);
        process.exit(1);
      }

      const hasValidPackageJson = await projectManager.hasValidPluginPackageJson(pluginName);
      console.log(`🔌 插件信息: ${pluginName}\n`);

      console.log(`📁 目录: ${projectManager.getPluginDirectory(pluginName)}`);
      console.log(`📄 Package.json: ${hasValidPackageJson ? '✅ 有效' : '❌ 无效/缺失'}`);

      if (hasValidPackageJson) {
        const packageJsonPath = projectManager.getPluginPackageJsonPath(pluginName);
        const packageData = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageData);

        console.log('\n📋 包信息:');
        console.log(`   名称: ${packageJson.name || '未指定'}`);
        console.log(`   版本: ${packageJson.version || '未指定'}`);
        console.log(`   描述: ${packageJson.description || '未提供'}`);
        console.log(`   主入口: ${packageJson.main || packageJson.index || '未指定'}`);

        if (packageJson.mcpPlugin) {
          console.log('\n🔧 MCP 插件配置:');
          console.log(`   ${JSON.stringify(packageJson.mcpPlugin, null, 2)}`);
        }
      }

    } catch (error) {
      console.error('❌ 显示插件信息失败:', (error as Error).message);
      if (options.debug) {
        console.error((error as Error).stack);
      }
    }
  }

  /**
   * 处理配置命令
   */
  private async handleConfig(args: string[], options: Record<string, any>): Promise<void> {
    const action = args[0];

    switch (action) {
      case 'show':
        this.showConfig(options);
        break;
      default:
        console.log('⚙️  配置命令:');
        console.log('   show              显示当前配置');
        break;
    }
  }

  /**
   * 显示当前配置
   */
  private showConfig(_options: Record<string, any>): void {
    console.log('⚙️  当前配置:\n');

    console.log('环境变量:');
    console.log(`   SKER_HOME_DIR: ${process.env.SKER_HOME_DIR || '未设置 (默认: ~/.sker)'}`);
    console.log(`   DEBUG: ${process.env.DEBUG || 'false'}`);
    console.log(`   LOG_LEVEL: ${process.env.LOG_LEVEL || 'info'}`);
    console.log(`   CONFIG_FILE: ${process.env.CONFIG_FILE || '未设置'}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || '未设置'}`);

    console.log('\n系统信息:');
    console.log(`   Node.js 版本: ${process.version}`);
    console.log(`   平台: ${process.platform}`);
    console.log(`   架构: ${process.arch}`);
    console.log(`   工作目录: ${process.cwd()}`);
  }

  /**
   * 处理开发命令
   */
  private async handleDev(args: string[], options: Record<string, any>): Promise<void> {
    const action = args[0];

    switch (action) {
      case undefined:
      case 'start':
        await this.startDevMode(options);
        break;
      case 'status':
        await this.showDevStatus(options);
        break;
      case 'reload':
        const pluginName = args[1];
        if (!pluginName) {
          console.error('❌ reload 命令需要插件名称');
          console.log('用法: sker dev reload <插件名称>');
          process.exit(1);
        }
        await this.reloadPlugin(pluginName, options);
        break;
      default:
        console.log('🔥 开发模式命令:');
        console.log('   start             启动开发模式 (默认)');
        console.log('   status            显示开发模式状态');
        console.log('   reload <插件>      手动重载指定插件');
        break;
    }
  }

  /**
   * 启动开发模式
   */
  private async startDevMode(options: Record<string, any>): Promise<void> {
    console.log('🔥 启动插件开发模式...\n');

    try {
      // 创建应用程序注入器和热重载管理器
      const injector = this.bootstrap.createInjector();
      const hotReloadManager = injector.get(HotReloadManager);

      // 设置事件监听器
      hotReloadManager.onEvent((data) => {
        switch (data.event) {
          case 'watch_started':
            console.log('✅ 开发模式已启动');
            break;
          case 'reload_started':
            console.log(`🔄 正在重载插件: ${data.pluginName}`);
            break;
          case 'reload_success':
            console.log(`✅ 插件重载成功: ${data.pluginName} (${data.duration}ms)`);
            break;
          case 'reload_failed':
            console.log(`❌ 插件重载失败: ${data.pluginName} - ${data.error}`);
            break;
        }
      });

      // 启动热重载
      await hotReloadManager.startDevMode();

      const status = hotReloadManager.getDevModeStatus();
      console.log(`📁 监控 ${status.watchingPlugins} 个开发插件`);
      
      if (status.watchingPlugins > 0) {
        console.log('\n📋 监控的插件:');
        const watchingPlugins = hotReloadManager.getWatchingPlugins();
        for (const plugin of watchingPlugins) {
          console.log(`   • ${plugin.pluginName} - ${plugin.mainFile}`);
        }
      }

      console.log('\n🚀 开发模式运行中... 修改插件文件将自动重载');
      console.log('按 Ctrl+C 退出开发模式');

      // 设置优雅关闭
      process.on('SIGINT', async () => {
        console.log('\n🔄 正在停止开发模式...');
        await hotReloadManager.stopDevMode();
        console.log('👋 开发模式已停止');
        process.exit(0);
      });

      // 保持运行
      process.stdin.resume();

    } catch (error) {
      console.error('❌ 启动开发模式失败:', (error as Error).message);
      if (options.debug) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  }

  /**
   * 显示开发模式状态
   */
  private async showDevStatus(options: Record<string, any>): Promise<void> {
    try {
      const injector = this.bootstrap.createInjector();
      const hotReloadManager = injector.get(HotReloadManager);
      
      const status = hotReloadManager.getDevModeStatus();
      
      console.log('🔥 开发模式状态\n');
      
      console.log(`状态: ${status.isActive ? '✅ 运行中' : '❌ 未运行'}`);
      console.log(`监控插件: ${status.watchingPlugins}`);
      console.log(`总重载次数: ${status.totalReloads}`);
      console.log(`成功重载: ${status.successfulReloads}`);
      console.log(`失败重载: ${status.failedReloads}`);
      console.log(`平均重载时间: ${status.averageReloadTime.toFixed(1)}ms`);
      console.log(`运行时间: ${Math.floor(status.uptime / 1000)}秒`);

      if (status.watchingPlugins > 0) {
        console.log('\n📋 监控的插件:');
        const watchingPlugins = hotReloadManager.getWatchingPlugins();
        for (const plugin of watchingPlugins) {
          console.log(`   • ${plugin.pluginName}`);
          console.log(`     路径: ${plugin.pluginPath}`);
          console.log(`     主文件: ${plugin.mainFile}`);
        }
      }

    } catch (error) {
      console.error('❌ 获取开发模式状态失败:', (error as Error).message);
      if (options.debug) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  }

  /**
   * 手动重载插件
   */
  private async reloadPlugin(pluginName: string, options: Record<string, any>): Promise<void> {
    try {
      console.log(`🔄 手动重载插件: ${pluginName}`);

      const injector = this.bootstrap.createInjector();
      const hotReloadManager = injector.get(HotReloadManager);

      const success = await hotReloadManager.reloadPlugin(pluginName);

      if (success) {
        console.log(`✅ 插件 ${pluginName} 重载成功`);
      } else {
        console.log(`❌ 插件 ${pluginName} 重载失败`);
        process.exit(1);
      }

    } catch (error) {
      console.error(`❌ 重载插件失败: ${(error as Error).message}`);
      if (options.debug) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  }

  /**
   * 处理版本命令
   */
  private async handleVersion(_args: string[], options: Record<string, any>): Promise<void> {
    try {
      // 读取 package.json 获取版本
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageData = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageData);

      console.log(`Sker Daemon MCP 服务器 v${packageJson.version}`);
      console.log(`Node.js ${process.version}`);

    } catch (error) {
      console.log('Sker Daemon MCP 服务器 (版本未知)');
      if (options.debug) {
        console.error('读取版本失败:', (error as Error).message);
      }
    }
  }

  /**
   * 显示帮助信息
   */
  private showHelp(command?: string): void {
    if (command && this.commands.has(command)) {
      const cmd = this.commands.get(command)!;
      console.log(`用法: sker ${cmd.name} ${cmd.args?.join(' ') || ''}`);
      console.log(`\n${cmd.description}`);

      if (cmd.aliases && cmd.aliases.length > 0) {
        console.log(`\n别名: ${cmd.aliases.join(', ')}`);
      }

      return;
    }

    console.log(`
Sker Daemon MCP 服务器 CLI

用法: sker <命令> [选项]

命令:
  start, run            启动 MCP 服务器
  status, info          显示服务器状态信息
  init                  初始化项目目录结构
  plugin <动作>         插件管理 (list, info <名称>)
  config <动作>         配置管理 (show)
  dev [动作]            开发模式 (start, status, reload <插件>)
  version, v            显示版本信息
  help                  显示此帮助信息

全局选项:
  -h, --help           显示帮助信息
  -d, --debug          启用调试输出
  --home <目录>         自定义主目录
  -c, --config <文件>   自定义配置文件

示例:
  sker start --debug
  sker status
  sker init
  sker plugin list
  sker plugin info my-plugin
  sker config show
  sker dev                      # 启动开发模式
  sker dev status               # 查看开发模式状态
  sker dev reload my-plugin     # 手动重载插件
  sker version

环境变量:
  SKER_HOME_DIR        自定义主目录 (默认: ~/.sker)
  DEBUG                启用调试模式
  LOG_LEVEL            设置日志级别
  CONFIG_FILE          自定义配置文件路径
    `.trim());
  }

  /**
   * 检查目录是否存在的工具方法
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * 主 CLI 运行方法
   */
  async run(argv: string[]): Promise<void> {
    createPlatformInjector([
      {
        provide: Logger, useFactory: (layer: LayeredLoggerFactory) => {
          return layer.createPlatformLogger(`mcp-app`)
        }, deps: [LayeredLoggerFactory]
      }
    ])
    const parsed = this.parseArguments(argv);

    // 处理全局帮助
    if (parsed.options.help || parsed.options.h) {
      this.showHelp(parsed.command === 'help' ? parsed.args[0] : undefined);
      return;
    }

    // 查找并执行命令
    const command = this.commands.get(parsed.command);

    if (!command) {
      console.error(`❌ 未知命令: ${parsed.command}`);
      console.log('\n运行 "sker help" 查看可用命令');
      process.exit(1);
    }

    try {
      await command.handler(parsed.args, parsed.options);
    } catch (error) {
      console.error(`❌ 命令失败: ${(error as Error).message}`);
      if (parsed.options.debug || parsed.options.d) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  }
}

/**
 * 主入口点
 */
async function main(): Promise<void> {
  createRootInjector([])
  const cli = new SkerCli();
  await cli.run(process.argv);
}

// 仅在这是主模块时运行
main().catch((error) => {
  console.error('💥 CLI 执行失败:', error);
  process.exit(1);
});