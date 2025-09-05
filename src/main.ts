#!/usr/bin/env node

/**
 * Main Entry Point for Sker Daemon MCP Server
 * 
 * This is the primary entry point for the Sker Daemon MCP server application.
 * It sets up the dependency injection container, configures all providers,
 * and starts the MCP application.
 * 
 * Features:
 * - Dependency injection setup with @sker/di
 * - Reflection metadata initialization
 * - Graceful error handling and logging
 * - Application lifecycle management
 * - Plugin system initialization
 */

import 'reflect-metadata';
import { Injector, createPlatformInjector, createRootInjector } from '@sker/di';
import { McpApplication } from './core/mcp-application.js';
import { createMcpProviders, createPlatformProviders } from './core/providers.js';

/**
 * Application configuration interface
 */
interface AppConfig {
  /**
   * Debug mode flag
   */
  debug: boolean;
  
  /**
   * Log level override
   */
  logLevel: string;
  
  /**
   * Custom config file path
   */
  configFile?: string;
  
  /**
   * Custom home directory
   */
  homeDir?: string;
}

/**
 * Main application class
 */
class MainApplication {
  private injector: Injector | null = null;
  private application: McpApplication | null = null;
  private config: AppConfig = {
    debug: false,
    logLevel: 'info'
  };

  /**
   * Constructor initializes configuration from environment and CLI args
   */
  constructor() {
    this.parseConfiguration();
  }

  /**
   * Parses configuration from environment variables and command line arguments
   */
  private parseConfiguration(): void {
    // Parse environment variables
    this.config = {
      debug: process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development',
      logLevel: process.env.LOG_LEVEL || 'info'
    };
    
    // Add optional properties if they exist
    if (process.env.CONFIG_FILE) {
      this.config.configFile = process.env.CONFIG_FILE;
    }
    if (process.env.SKER_HOME_DIR) {
      this.config.homeDir = process.env.SKER_HOME_DIR;
    }

    // Parse command line arguments (simple implementation)
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--debug':
        case '-d':
          this.config.debug = true;
          break;
          
        case '--log-level':
          if (i + 1 < args.length) {
            const nextLevel = args[++i];
            if (nextLevel) {
              this.config.logLevel = nextLevel;
            }
          }
          break;
          
        case '--config':
        case '-c':
          if (i + 1 < args.length) {
            const nextConfig = args[++i];
            if (nextConfig) {
              this.config.configFile = nextConfig;
            }
          }
          break;
          
        case '--home':
          if (i + 1 < args.length) {
            const nextHome = args[++i];
            if (nextHome) {
              this.config.homeDir = nextHome;
            }
          }
          break;
          
        case '--help':
          this.showHelp();
          process.exit(0);
      }
    }
  }

  /**
   * Shows help information
   */
  private showHelp(): void {
    console.log(`
Sker Daemon MCP Server

Usage: sker-mcp [options]

Options:
  -d, --debug              Enable debug mode
  --log-level <level>      Set log level (error|warn|info|debug|trace)
  -c, --config <file>      Use custom config file
  -h, --home <dir>         Use custom home directory
  --help                   Show this help message

Environment Variables:
  DEBUG=true               Enable debug mode
  LOG_LEVEL=<level>        Set log level
  CONFIG_FILE=<file>       Custom config file path
  SKER_HOME_DIR=<dir>      Custom home directory

Examples:
  sker-mcp --debug
  sker-mcp --log-level debug --home ~/.sker-dev
  SKER_HOME_DIR=/custom/path sker-mcp
    `.trim());
  }

  /**
   * Initializes the dependency injection container
   */
  private setupDependencyInjection(): void {
    console.log('Setting up dependency injection...');
    
    // Create injector with all providers
    const providers = [
      ...createMcpProviders(),
      ...createPlatformProviders()
    ];

    this.injector = createPlatformInjector(providers);
    
    console.log('Dependency injection configured successfully');
  }

  /**
   * Creates and configures the MCP application
   */
  private createApplication(): void {
    if (!this.injector) {
      throw new Error('Injector not initialized');
    }

    console.log('Creating MCP application...');

    try {
      // Create the main application instance
      this.application = this.injector.get(McpApplication);
      
      if (!this.application) {
        throw new Error('Failed to create McpApplication instance');
      }

      // Set up graceful shutdown
      this.application.setupGracefulShutdown();

      console.log('MCP application created successfully');

    } catch (error) {
      console.error('Failed to create MCP application:', error);
      throw error;
    }
  }

  /**
   * Starts the application
   */
  private async startApplication(): Promise<void> {
    if (!this.application) {
      throw new Error('Application not created');
    }

    console.log('Starting MCP application...');

    try {
      await this.application.start();
      
      console.log('✅ Sker Daemon MCP Server is running');
      console.log('📡 Transport: stdio');
      console.log('📁 Home directory:', process.env.SKER_HOME_DIR || '~/.sker');
      
      if (this.config.debug) {
        console.log('🐛 Debug mode is enabled');
      }

      // Keep the process alive
      this.keepAlive();

    } catch (error) {
      console.error('❌ Failed to start MCP application:', error);
      throw error;
    }
  }

  /**
   * Keeps the process alive and handles cleanup
   */
  private keepAlive(): void {
    // The process will stay alive due to the MCP server's stdio transport
    // This method exists for any additional keep-alive logic if needed
    
    // Log periodic status (in debug mode only)
    if (this.config.debug) {
      const statusInterval = setInterval(() => {
        if (this.application?.isRunning()) {
          console.log(`🟢 Status: ${this.application.getStatus()}`);
        } else {
          clearInterval(statusInterval);
        }
      }, 30000); // Every 30 seconds
    }
  }

  /**
   * Main run method
   */
  async run(): Promise<void> {
    try {
      console.log('🚀 Starting Sker Daemon MCP Server...');
      
      // Apply environment variable overrides
      if (this.config.homeDir) {
        process.env.SKER_HOME_DIR = this.config.homeDir;
      }
      
      // Set debug mode
      if (this.config.debug) {
        process.env.DEBUG = 'true';
        process.env.NODE_ENV = 'development';
      }

      // Setup dependency injection
      this.setupDependencyInjection();

      // Create application
      this.createApplication();

      // Start the application
      await this.startApplication();

    } catch (error) {
      console.error('💥 Fatal error during startup:', error);
      
      // Try to cleanup if possible
      if (this.application) {
        try {
          await this.application.stop();
        } catch (cleanupError) {
          console.error('Error during cleanup:', cleanupError);
        }
      }

      process.exit(1);
    }
  }
}

/**
 * Error handling for uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Promise Rejection at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

/**
 * Entry point - create and run the application
 */
async function main(): Promise<void> {
  createRootInjector([]);
  const app = new MainApplication();
  await app.run();
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Main execution failed:', error);
    process.exit(1);
  });
}