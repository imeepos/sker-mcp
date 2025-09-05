/**
 * Logging System Demo
 * 
 * This file demonstrates how to use the Winston layered logging system
 * in the Sker Daemon MCP project.
 */

import { 
  LayeredLoggerFactory, 
  LogLayer, 
  LoggerUtils, 
  WinstonLogger,
  getLoggingConfig,
  ensureLogDirectories
} from '../core/logging/index.js';
import { ProjectManager } from '../core/project-manager.js';

/**
 * Demo class showing platform-level logging
 */
class PlatformServiceDemo {
  private logger: any;

  constructor(loggerFactory: LayeredLoggerFactory) {
    this.logger = loggerFactory.createPlatformLogger('platform-service');
  }

  async initialize(): Promise<void> {
    this.logger.info('Platform service initializing', 
      LoggerUtils.platformContext('PlatformServiceDemo', 'initialize', {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      })
    );

    try {
      // Simulate some platform work
      await this.simulateWork();
      this.logger.info('Platform service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize platform service', { error });
      throw error;
    }
  }

  private async simulateWork(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.logger.debug('Platform work completed');
        resolve();
      }, 100);
    });
  }
}

/**
 * Demo class showing application-level logging
 */
class ApplicationServiceDemo {
  private logger: any;

  constructor(loggerFactory: LayeredLoggerFactory) {
    this.logger = loggerFactory.createApplicationLogger('app-service');
  }

  async processUserRequest(userId: string, action: string): Promise<void> {
    this.logger.info('Processing user request', 
      LoggerUtils.applicationContext('user-management', action, userId, {
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId()
      })
    );

    const timer = this.logger.startTimer('user-request-processing');

    try {
      // Simulate processing
      await this.simulateProcessing();
      
      this.logger.info('User request processed successfully', {
        userId,
        action,
        status: 'success'
      });
    } catch (error) {
      this.logger.error('Failed to process user request', {
        userId,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      timer(); // Log the timing
    }
  }

  private async simulateProcessing(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

/**
 * Demo class showing plugin-level logging
 */
class PluginDemo {
  private logger: any;

  constructor(loggerFactory: LayeredLoggerFactory, pluginName: string) {
    this.logger = loggerFactory.createPluginLogger(pluginName, 'plugin-core');
  }

  async executePlugin(operation: string, params: any): Promise<any> {
    this.logger.debug('Plugin operation starting', 
      LoggerUtils.pluginContext('demo-plugin', operation, {
        params,
        startTime: Date.now()
      })
    );

    try {
      const result = await this.performOperation(operation, params);
      
      this.logger.info('Plugin operation completed', {
        operation,
        result: typeof result,
        success: true
      });
      
      return result;
    } catch (error) {
      this.logger.error('Plugin operation failed', {
        operation,
        params,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async performOperation(operation: string, params: any): Promise<any> {
    // Simulate plugin work
    this.logger.debug(`Performing operation: ${operation}`, { params });
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (operation === 'fail') {
          reject(new Error('Simulated plugin failure'));
        } else {
          resolve({ operation, result: 'success', params });
        }
      }, 150);
    });
  }
}

/**
 * Main demo function
 */
export async function runLoggingDemo(): Promise<void> {
  console.log('🚀 Starting Logging System Demo...\n');

  try {
    // Initialize logging configuration
    const config = getLoggingConfig();
    ensureLogDirectories(config);

    // Create project manager and logger factory
    const projectManager = new ProjectManager();
    const loggerFactory = new LayeredLoggerFactory(config, projectManager);

    console.log('✅ Created layered logger factory\n');

    // Demo Platform Logging
    console.log('📊 Platform Layer Demo:');
    const platformService = new PlatformServiceDemo(loggerFactory);
    await platformService.initialize();
    console.log('  ✅ Platform service initialized\n');

    // Demo Application Logging
    console.log('🏗️ Application Layer Demo:');
    const appService = new ApplicationServiceDemo(loggerFactory);
    await appService.processUserRequest('user-123', 'create-resource');
    await appService.processUserRequest('user-456', 'update-profile');
    console.log('  ✅ Application requests processed\n');

    // Demo Plugin Logging
    console.log('🔌 Plugin Layer Demo:');
    const plugin1 = new PluginDemo(loggerFactory, 'demo-plugin-1');
    const plugin2 = new PluginDemo(loggerFactory, 'demo-plugin-2');

    await plugin1.executePlugin('process-data', { type: 'json', size: 1024 });
    await plugin2.executePlugin('transform', { input: 'text', output: 'html' });
    
    // Demo error handling
    try {
      await plugin1.executePlugin('fail', { test: true });
    } catch (error) {
      console.log('  ⚠️ Caught expected plugin error (logged)');
    }
    
    console.log('  ✅ Plugin operations completed\n');

    // Demo logger utilities
    console.log('🛠️ Logger Utilities Demo:');
    const utilLogger = loggerFactory.createApplicationLogger('utils-demo');
    
    // Child logger demo
    const childLogger = utilLogger.child({ component: 'child-demo' });
    childLogger.info('This is a child logger message');
    
    // Request context demo
    utilLogger.setRequestContext('req-789', 'user-999');
    utilLogger.info('Message with request context');
    utilLogger.clearRequestContext();
    
    console.log('  ✅ Logger utilities demonstrated\n');

    // Show logger statistics
    console.log('📈 Logger Statistics:');
    const platformLoggers = loggerFactory.listLoggersByLayer(LogLayer.PLATFORM);
    const appLoggers = loggerFactory.listLoggersByLayer(LogLayer.APPLICATION);
    const pluginLoggers = loggerFactory.listLoggersByLayer(LogLayer.PLUGIN);
    
    console.log(`  Platform loggers: ${platformLoggers.length}`);
    console.log(`  Application loggers: ${appLoggers.length}`);
    console.log(`  Plugin loggers: ${pluginLoggers.length}`);

    console.log('\n🎉 Logging demo completed successfully!');
    console.log('📁 Check the logs directory for generated log files.');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    throw error;
  }
}

/**
 * Run demo if this file is executed directly
 */
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('logging-demo.ts')) {
  runLoggingDemo().catch(console.error);
}