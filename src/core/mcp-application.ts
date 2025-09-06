/**
 * MCP Application Main Class
 * 
 * This module provides the main application class for the Sker Daemon MCP system.
 * It orchestrates the startup and shutdown process, manages the lifecycle of all
 * core components, and provides a unified interface for application management.
 */

import { Injectable, Inject } from '@sker/di';
import { 
  ProjectManager,
  MCP_SERVER_CONFIG, 
  SERVICE_MANAGER,
  PROJECT_MANAGER,
  PLUGIN_MANAGER,
  LOGGER,
  type IMcpTool, 
  type IMcpResource, 
  type IMcpPrompt, 
  type IMcpServerConfig,
  type IPluginManager 
} from '@sker/mcp';

/**
 * Application status enumeration
 */
export enum ApplicationStatus {
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

/**
 * Application lifecycle event type
 */
export type ApplicationEvent = 
  | 'starting'
  | 'started'
  | 'stopping'
  | 'stopped'
  | 'error';

/**
 * Application event listener function type
 */
export type ApplicationEventListener = (event: ApplicationEvent, error?: Error) => void;

/**
 * Service Manager interface
 */
export interface IServiceManager {
  /**
   * Start the service manager
   */
  start(): Promise<void>;
  
  /**
   * Stop the service manager
   */
  stop(): Promise<void>;
  
  /**
   * Register a tool dynamically
   */
  registerTool(tool: IMcpTool): Promise<void>;
  
  /**
   * Register a resource dynamically
   */
  registerResource(resource: IMcpResource): Promise<void>;
  
  /**
   * Register a prompt dynamically
   */
  registerPrompt(prompt: IMcpPrompt): Promise<void>;
  
  /**
   * Get current status
   */
  getStatus(): 'starting' | 'running' | 'stopping' | 'stopped';
}

/**
 * Main MCP Application class
 * 
 * This class serves as the central orchestrator for the entire MCP daemon system.
 * It manages the lifecycle of all core components, handles application events,
 * and provides a unified interface for starting, stopping, and managing the application.
 */
@Injectable()
export class McpApplication {
  private status: ApplicationStatus = ApplicationStatus.STOPPED;
  private eventListeners: ApplicationEventListener[] = [];
  private startupPromise: Promise<void> | null = null;
  private shutdownPromise: Promise<void> | null = null;

  constructor(
    @Inject(PROJECT_MANAGER) private readonly projectManager: ProjectManager,
    @Inject(SERVICE_MANAGER) private readonly serviceManager: IServiceManager,
    @Inject(PLUGIN_MANAGER) private readonly pluginManager: IPluginManager,
    @Inject(MCP_SERVER_CONFIG) private readonly config: IMcpServerConfig,
    @Inject(LOGGER) private readonly logger: any
  ) {
    this.logger?.info('McpApplication initialized', { 
      name: this.config.name, 
      version: this.config.version 
    });
  }

  /**
   * Starts the MCP application
   * 
   * This method orchestrates the complete startup sequence:
   * 1. Creates project directory structure
   * 2. Initializes plugins
   * 3. Starts service manager
   * 4. Sets up MCP server and transport
   */
  async start(): Promise<void> {
    // Prevent concurrent startup attempts
    if (this.startupPromise) {
      return this.startupPromise;
    }

    // If already running, return immediately
    if (this.status === ApplicationStatus.RUNNING) {
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
   * Performs the actual startup sequence
   */
  private async performStartup(): Promise<void> {
    try {
      this.setStatus(ApplicationStatus.STARTING);
      this.emitEvent('starting');

      this.logger?.info('Starting MCP Application...', { 
        config: this.config 
      });

      // Step 1: Create project directory structure
      this.logger?.debug('Creating project directory structure...');
      await this.projectManager.createProjectStructure();

      // Step 2: Initialize plugin system
      this.logger?.debug('Initializing plugin system...');
      await this.initializePlugins();

      // Step 3: Start service manager
      this.logger?.debug('Starting service manager...');
      await this.serviceManager.start();

      this.setStatus(ApplicationStatus.RUNNING);
      this.emitEvent('started');
      
      this.logger?.info('MCP Application started successfully', {
        status: this.status,
        transport: this.config.transport
      });

    } catch (error) {
      this.setStatus(ApplicationStatus.ERROR);
      this.emitEvent('error', error as Error);
      
      this.logger?.error('Failed to start MCP Application', { 
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      
      throw error;
    }
  }

  /**
   * Stops the MCP application
   * 
   * This method orchestrates the graceful shutdown sequence:
   * 1. Stops service manager
   * 2. Unloads all plugins
   * 3. Cleans up resources
   */
  async stop(): Promise<void> {
    // Prevent concurrent shutdown attempts
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    // If already stopped, return immediately
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
   * Performs the actual shutdown sequence
   */
  private async performShutdown(): Promise<void> {
    try {
      this.setStatus(ApplicationStatus.STOPPING);
      this.emitEvent('stopping');

      this.logger?.info('Stopping MCP Application...');

      // Step 1: Stop service manager
      this.logger?.debug('Stopping service manager...');
      await this.serviceManager.stop();

      // Step 2: Unload all plugins
      this.logger?.debug('Unloading plugins...');
      await this.shutdownPlugins();

      this.setStatus(ApplicationStatus.STOPPED);
      this.emitEvent('stopped');
      
      this.logger?.info('MCP Application stopped successfully');

    } catch (error) {
      this.setStatus(ApplicationStatus.ERROR);
      this.emitEvent('error', error as Error);
      
      this.logger?.error('Error during shutdown', { 
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      
      throw error;
    }
  }

  /**
   * Initializes the plugin system
   */
  private async initializePlugins(): Promise<void> {
    try {
      // Discover available plugins
      const pluginDirs = await this.projectManager.scanPluginsDirectory();
      
      this.logger?.debug('Discovered plugins', { 
        plugins: pluginDirs,
        count: pluginDirs.length
      });

      // Load enabled plugins
      for (const pluginName of pluginDirs) {
        try {
          await this.pluginManager.loadPlugin(pluginName);
          this.logger?.debug('Loaded plugin', { plugin: pluginName });
        } catch (error) {
          this.logger?.error('Failed to load plugin', { 
            plugin: pluginName,
            error: (error as Error).message
          });
          // Continue loading other plugins even if one fails
        }
      }
    } catch (error) {
      this.logger?.error('Plugin initialization failed', { 
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Shuts down the plugin system
   */
  private async shutdownPlugins(): Promise<void> {
    try {
      const activePlugins = this.pluginManager.getActivePlugins();
      
      for (const plugin of activePlugins) {
        try {
          await this.pluginManager.unloadPlugin(plugin.name);
          this.logger?.debug('Unloaded plugin', { plugin: plugin.name });
        } catch (error) {
          this.logger?.error('Failed to unload plugin', { 
            plugin: plugin.name,
            error: (error as Error).message
          });
          // Continue with other plugins even if one fails
        }
      }
    } catch (error) {
      this.logger?.error('Plugin shutdown failed', { 
        error: (error as Error).message
      });
      // Don't throw during shutdown - log and continue
    }
  }

  /**
   * Restarts the application
   */
  async restart(): Promise<void> {
    this.logger?.info('Restarting MCP Application...');
    await this.stop();
    await this.start();
  }

  /**
   * Gets the current application status
   */
  getStatus(): ApplicationStatus {
    return this.status;
  }

  /**
   * Checks if the application is running
   */
  isRunning(): boolean {
    return this.status === ApplicationStatus.RUNNING;
  }

  /**
   * Gets application information
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
   * Adds an event listener for application events
   */
  addEventListener(listener: ApplicationEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Removes an event listener
   */
  removeEventListener(listener: ApplicationEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index >= 0) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Sets the application status and logs the change
   */
  private setStatus(status: ApplicationStatus): void {
    const previousStatus = this.status;
    this.status = status;
    
    this.logger?.debug('Application status changed', { 
      from: previousStatus, 
      to: status 
    });
  }

  /**
   * Emits an application event to all listeners
   */
  private emitEvent(event: ApplicationEvent, error?: Error): void {
    this.logger?.debug('Emitting application event', { event, error: error?.message });
    
    for (const listener of this.eventListeners) {
      try {
        listener(event, error);
      } catch (listenerError) {
        this.logger?.error('Event listener error', { 
          event,
          error: (listenerError as Error).message
        });
        // Continue with other listeners even if one fails
      }
    }
  }

  /**
   * Sets up graceful shutdown handlers
   */
  setupGracefulShutdown(): void {
    const shutdownHandler = (signal: string) => {
      this.logger?.info(`Received ${signal}, shutting down gracefully...`);
      
      this.stop()
        .then(() => {
          this.logger?.info('Shutdown completed');
          process.exit(0);
        })
        .catch((error) => {
          this.logger?.error('Error during shutdown', { error: error.message });
          process.exit(1);
        });
    };

    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger?.error('Uncaught exception', { 
        error: error.message, 
        stack: error.stack 
      });
      
      this.setStatus(ApplicationStatus.ERROR);
      this.emitEvent('error', error);
      
      // Try to shutdown gracefully
      this.stop()
        .finally(() => process.exit(1));
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      
      this.logger?.error('Unhandled promise rejection', { 
        error: error.message, 
        stack: error.stack 
      });
      
      this.setStatus(ApplicationStatus.ERROR);
      this.emitEvent('error', error);
      
      // Try to shutdown gracefully
      this.stop()
        .finally(() => process.exit(1));
    });
  }
}