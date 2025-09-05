#!/usr/bin/env node

/**
 * Command Line Interface for Sker Daemon MCP Server
 * 
 * This module provides a command-line interface for managing the Sker Daemon MCP server.
 * It includes commands for starting, stopping, status checking, plugin management,
 * and configuration management.
 */

import 'reflect-metadata';
import { Injector, createInjector } from '@sker/di';
import { McpApplication } from './core/mcp-application.js';
import { ProjectManager } from './core/project-manager.js';
import { createMcpProviders, createPlatformProviders } from './core/providers.js';
import { PROJECT_MANAGER } from './core/tokens.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * CLI command interface
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
 * Parsed CLI arguments interface
 */
interface ParsedArgs {
  command: string;
  args: string[];
  options: Record<string, any>;
}

/**
 * Main CLI class
 */
class SkerCli {
  private commands: Map<string, CliCommand> = new Map();

  constructor() {
    this.setupCommands();
  }

  /**
   * Sets up all available CLI commands
   */
  private setupCommands(): void {
    // Start command
    this.addCommand({
      name: 'start',
      description: 'Start the MCP server',
      aliases: ['run'],
      handler: this.handleStart.bind(this)
    });

    // Status command
    this.addCommand({
      name: 'status',
      description: 'Show server status information',
      aliases: ['info'],
      handler: this.handleStatus.bind(this)
    });

    // Init command
    this.addCommand({
      name: 'init',
      description: 'Initialize project directory structure',
      handler: this.handleInit.bind(this)
    });

    // Plugin commands
    this.addCommand({
      name: 'plugin',
      description: 'Plugin management commands',
      args: ['action', 'plugin-name?'],
      handler: this.handlePlugin.bind(this)
    });

    // Config commands
    this.addCommand({
      name: 'config',
      description: 'Configuration management commands',
      args: ['action', 'key?', 'value?'],
      handler: this.handleConfig.bind(this)
    });

    // Version command
    this.addCommand({
      name: 'version',
      description: 'Show version information',
      aliases: ['v'],
      handler: this.handleVersion.bind(this)
    });
  }

  /**
   * Adds a command to the CLI
   */
  private addCommand(command: CliCommand): void {
    this.commands.set(command.name, command);
    
    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commands.set(alias, command);
      }
    }
  }

  /**
   * Parses command line arguments
   */
  private parseArguments(argv: string[]): ParsedArgs {
    const args = argv.slice(2);
    const result: ParsedArgs = {
      command: args[0] || 'help',
      args: [],
      options: {}
    };

    let i = 1; // Skip command
    while (i < args.length) {
      const arg = args[i];
      if (!arg) break;

      if (arg.startsWith('--')) {
        // Long option
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
        // Short option
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
        // Regular argument
        result.args.push(arg);
        i++;
      }
    }

    return result;
  }

  /**
   * Creates a configured injector
   */
  private createInjector(): Injector {
    const providers = [
      ...createMcpProviders(),
      ...createPlatformProviders()
    ];

    return createInjector(providers);
  }

  /**
   * Handles the start command
   */
  private async handleStart(_args: string[], options: Record<string, any>): Promise<void> {
    console.log('🚀 Starting Sker Daemon MCP Server...');

    try {
      // Apply options to environment
      if (options.home) {
        process.env.SKER_HOME_DIR = options.home;
      }
      if (options.debug) {
        process.env.DEBUG = 'true';
      }
      if (options.config) {
        process.env.CONFIG_FILE = options.config;
      }

      // Create injector and application
      const injector = this.createInjector();
      const application = injector.get(McpApplication);

      // Set up graceful shutdown
      application.setupGracefulShutdown();

      // Start the application
      await application.start();

      console.log('✅ Server started successfully');
      console.log('📡 Listening on stdio transport');

      // Keep alive
      process.stdin.resume();

    } catch (error) {
      console.error('❌ Failed to start server:', (error as Error).message);
      if (options.debug) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  }

  /**
   * Handles the status command
   */
  private async handleStatus(_args: string[], options: Record<string, any>): Promise<void> {
    console.log('📊 Sker Daemon MCP Server Status\n');

    try {
      const injector = this.createInjector();
      const projectManager = injector.get(PROJECT_MANAGER) as ProjectManager;

      // Show directory information
      console.log('📁 Directory Information:');
      console.log(`   Home: ${projectManager.getHomeDirectory()}`);
      console.log(`   Plugins: ${projectManager.getPluginsDirectory()}`);
      console.log(`   Config: ${projectManager.getConfigDirectory()}`);
      console.log(`   Logs: ${projectManager.getLogsDirectory()}`);
      console.log();

      // Check directory existence
      const homeExists = await this.directoryExists(projectManager.getHomeDirectory());
      const pluginsExists = await this.directoryExists(projectManager.getPluginsDirectory());
      const configExists = await this.directoryExists(projectManager.getConfigDirectory());
      const logsExists = await this.directoryExists(projectManager.getLogsDirectory());

      console.log('🗂️  Directory Status:');
      console.log(`   Home: ${homeExists ? '✅ exists' : '❌ missing'}`);
      console.log(`   Plugins: ${pluginsExists ? '✅ exists' : '❌ missing'}`);
      console.log(`   Config: ${configExists ? '✅ exists' : '❌ missing'}`);
      console.log(`   Logs: ${logsExists ? '✅ exists' : '❌ missing'}`);
      console.log();

      // Scan plugins
      if (pluginsExists) {
        const plugins = await projectManager.scanPluginsDirectory();
        console.log(`🔌 Plugins (${plugins.length}):`);
        if (plugins.length > 0) {
          for (const plugin of plugins) {
            const hasPackageJson = await projectManager.hasValidPluginPackageJson(plugin);
            console.log(`   ${plugin}: ${hasPackageJson ? '✅ valid' : '❌ invalid'}`);
          }
        } else {
          console.log('   No plugins found');
        }
        console.log();
      }

      // Environment information
      console.log('🌍 Environment:');
      console.log(`   Node.js: ${process.version}`);
      console.log(`   Platform: ${process.platform}`);
      console.log(`   Architecture: ${process.arch}`);
      console.log(`   CWD: ${process.cwd()}`);
      console.log();

      // Configuration
      console.log('⚙️  Configuration:');
      console.log(`   SKER_HOME_DIR: ${process.env.SKER_HOME_DIR || 'not set'}`);
      console.log(`   DEBUG: ${process.env.DEBUG || 'false'}`);
      console.log(`   LOG_LEVEL: ${process.env.LOG_LEVEL || 'info'}`);
      console.log(`   CONFIG_FILE: ${process.env.CONFIG_FILE || 'not set'}`);

    } catch (error) {
      console.error('❌ Failed to get status:', (error as Error).message);
      if (options.debug) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  }

  /**
   * Handles the init command
   */
  private async handleInit(_args: string[], options: Record<string, any>): Promise<void> {
    console.log('🏗️  Initializing Sker Daemon MCP project...');

    try {
      const injector = this.createInjector();
      const projectManager = injector.get(PROJECT_MANAGER) as ProjectManager;

      // Create directory structure
      await projectManager.createProjectStructure();

      console.log('✅ Project structure created:');
      console.log(`   📁 ${projectManager.getHomeDirectory()}`);
      console.log(`   📁 ${projectManager.getPluginsDirectory()}`);
      console.log(`   📁 ${projectManager.getConfigDirectory()}`);
      console.log(`   📁 ${projectManager.getLogsDirectory()}`);

    } catch (error) {
      console.error('❌ Failed to initialize project:', (error as Error).message);
      if (options.debug) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  }

  /**
   * Handles plugin commands
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
          console.error('❌ Plugin name is required for info command');
          process.exit(1);
        }
        await this.showPluginInfo(pluginName, options);
        break;
      default:
        console.log('🔌 Plugin Commands:');
        console.log('   list              List all available plugins');
        console.log('   info <name>       Show plugin information');
        break;
    }
  }

  /**
   * Lists all plugins
   */
  private async listPlugins(options: Record<string, any>): Promise<void> {
    try {
      const injector = this.createInjector();
      const projectManager = injector.get(PROJECT_MANAGER) as ProjectManager;

      const plugins = await projectManager.scanPluginsDirectory();
      
      console.log(`🔌 Available Plugins (${plugins.length}):\n`);

      if (plugins.length === 0) {
        console.log('   No plugins found');
        console.log(`   Plugin directory: ${projectManager.getPluginsDirectory()}`);
        return;
      }

      for (const plugin of plugins) {
        const hasValidPackageJson = await projectManager.hasValidPluginPackageJson(plugin);
        const status = hasValidPackageJson ? '✅ valid' : '❌ invalid';
        console.log(`   ${plugin}: ${status}`);
      }

    } catch (error) {
      console.error('❌ Failed to list plugins:', (error as Error).message);
      if (options.debug) {
        console.error((error as Error).stack);
      }
    }
  }

  /**
   * Shows plugin information
   */
  private async showPluginInfo(pluginName: string, options: Record<string, any>): Promise<void> {
    try {
      const injector = this.createInjector();
      const projectManager = injector.get(PROJECT_MANAGER) as ProjectManager;

      const pluginExists = await projectManager.pluginDirectoryExists(pluginName);
      if (!pluginExists) {
        console.error(`❌ Plugin '${pluginName}' not found`);
        process.exit(1);
      }

      const hasValidPackageJson = await projectManager.hasValidPluginPackageJson(pluginName);
      console.log(`🔌 Plugin Information: ${pluginName}\n`);

      console.log(`📁 Directory: ${projectManager.getPluginDirectory(pluginName)}`);
      console.log(`📄 Package.json: ${hasValidPackageJson ? '✅ valid' : '❌ invalid/missing'}`);

      if (hasValidPackageJson) {
        const packageJsonPath = projectManager.getPluginPackageJsonPath(pluginName);
        const packageData = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageData);

        console.log('\n📋 Package Information:');
        console.log(`   Name: ${packageJson.name || 'not specified'}`);
        console.log(`   Version: ${packageJson.version || 'not specified'}`);
        console.log(`   Description: ${packageJson.description || 'not provided'}`);
        console.log(`   Main: ${packageJson.main || packageJson.index || 'not specified'}`);

        if (packageJson.mcpPlugin) {
          console.log('\n🔧 MCP Plugin Configuration:');
          console.log(`   ${JSON.stringify(packageJson.mcpPlugin, null, 2)}`);
        }
      }

    } catch (error) {
      console.error('❌ Failed to show plugin info:', (error as Error).message);
      if (options.debug) {
        console.error((error as Error).stack);
      }
    }
  }

  /**
   * Handles config commands
   */
  private async handleConfig(args: string[], options: Record<string, any>): Promise<void> {
    const action = args[0];

    switch (action) {
      case 'show':
        this.showConfig(options);
        break;
      default:
        console.log('⚙️  Configuration Commands:');
        console.log('   show              Show current configuration');
        break;
    }
  }

  /**
   * Shows current configuration
   */
  private showConfig(_options: Record<string, any>): void {
    console.log('⚙️  Current Configuration:\n');

    console.log('Environment Variables:');
    console.log(`   SKER_HOME_DIR: ${process.env.SKER_HOME_DIR || 'not set (default: ~/.sker)'}`);
    console.log(`   DEBUG: ${process.env.DEBUG || 'false'}`);
    console.log(`   LOG_LEVEL: ${process.env.LOG_LEVEL || 'info'}`);
    console.log(`   CONFIG_FILE: ${process.env.CONFIG_FILE || 'not set'}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

    console.log('\nSystem Information:');
    console.log(`   Node.js Version: ${process.version}`);
    console.log(`   Platform: ${process.platform}`);
    console.log(`   Architecture: ${process.arch}`);
    console.log(`   Working Directory: ${process.cwd()}`);
  }

  /**
   * Handles version command
   */
  private async handleVersion(_args: string[], options: Record<string, any>): Promise<void> {
    try {
      // Read package.json to get version
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageData = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageData);

      console.log(`Sker Daemon MCP Server v${packageJson.version}`);
      console.log(`Node.js ${process.version}`);
      
    } catch (error) {
      console.log('Sker Daemon MCP Server (version unknown)');
      if (options.debug) {
        console.error('Failed to read version:', (error as Error).message);
      }
    }
  }

  /**
   * Shows help information
   */
  private showHelp(command?: string): void {
    if (command && this.commands.has(command)) {
      const cmd = this.commands.get(command)!;
      console.log(`Usage: sker ${cmd.name} ${cmd.args?.join(' ') || ''}`);
      console.log(`\n${cmd.description}`);
      
      if (cmd.aliases && cmd.aliases.length > 0) {
        console.log(`\nAliases: ${cmd.aliases.join(', ')}`);
      }
      
      return;
    }

    console.log(`
Sker Daemon MCP Server CLI

Usage: sker <command> [options]

Commands:
  start, run            Start the MCP server
  status, info          Show server status information
  init                  Initialize project directory structure
  plugin <action>       Plugin management (list, info <name>)
  config <action>       Configuration management (show)
  version, v            Show version information
  help                  Show this help message

Global Options:
  -h, --help           Show help information
  -d, --debug          Enable debug output
  --home <dir>         Custom home directory
  -c, --config <file>  Custom config file

Examples:
  sker start --debug
  sker status
  sker init
  sker plugin list
  sker plugin info my-plugin
  sker config show
  sker version

Environment Variables:
  SKER_HOME_DIR        Custom home directory (default: ~/.sker)
  DEBUG                Enable debug mode
  LOG_LEVEL            Set log level
  CONFIG_FILE          Custom config file path
    `.trim());
  }

  /**
   * Utility method to check if directory exists
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
   * Main CLI run method
   */
  async run(argv: string[]): Promise<void> {
    const parsed = this.parseArguments(argv);

    // Handle global help
    if (parsed.options.help || parsed.options.h) {
      this.showHelp(parsed.command === 'help' ? parsed.args[0] : undefined);
      return;
    }

    // Find and execute command
    const command = this.commands.get(parsed.command);
    
    if (!command) {
      console.error(`❌ Unknown command: ${parsed.command}`);
      console.log('\nRun "sker help" to see available commands');
      process.exit(1);
    }

    try {
      await command.handler(parsed.args, parsed.options);
    } catch (error) {
      console.error(`❌ Command failed: ${(error as Error).message}`);
      if (parsed.options.debug || parsed.options.d) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const cli = new SkerCli();
  await cli.run(process.argv);
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 CLI execution failed:', error);
    process.exit(1);
  });
}