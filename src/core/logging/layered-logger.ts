/**
 * Layered Logger System Implementation
 * 
 * This module implements the three-layer logging architecture:
 * - Platform Logger: System-level logging (framework, core services)
 * - Application Logger: Application-level logging (business logic, user actions)
 * - Plugin Logger: Plugin-level logging (per-plugin isolated logging)
 */

import { Injectable, Inject } from '@sker/di';
import { LOGGER_CONFIG, PROJECT_MANAGER } from '../tokens.js';
import type { ProjectManager } from '../project-manager.js';
import { WinstonLogger, WinstonLoggerConfig, IWinstonLogger } from './winston-logger.js';
import path from 'path';

/**
 * Logging layers enumeration
 */
export enum LogLayer {
  PLATFORM = 'platform',
  APPLICATION = 'application', 
  PLUGIN = 'plugin'
}

/**
 * Layer-specific logger configuration
 */
export interface LayeredLoggerConfig extends WinstonLoggerConfig {
  layer: LogLayer;
  layerName?: string; // For plugin layer, this would be plugin name
  separateFiles?: boolean; // Whether to use separate log files per layer
  inheritParentLevel?: boolean; // Whether to inherit parent layer log level
}

/**
 * Layered logger factory interface
 */
export interface ILayeredLoggerFactory {
  /** Create platform-level logger */
  createPlatformLogger(component: string): IWinstonLogger;
  /** Create application-level logger */
  createApplicationLogger(component: string): IWinstonLogger;
  /** Create plugin-level logger */
  createPluginLogger(pluginName: string, component: string): IWinstonLogger;
  /** Get existing logger by layer and component */
  getLogger(layer: LogLayer, component: string, layerName?: string): IWinstonLogger | null;
  /** Configure logging for specific layer */
  configureLayer(layer: LogLayer, config: Partial<WinstonLoggerConfig>): void;
  /** List all active loggers by layer */
  listLoggersByLayer(layer: LogLayer): string[];
}

/**
 * Layered Winston logger implementation
 */
export class LayeredWinstonLogger extends WinstonLogger {
  private layer: LogLayer;
  private layerName?: string;

  constructor(
    component: string,
    layer: LogLayer,
    layerName: string | undefined,
    config: LayeredLoggerConfig,
    projectManager?: ProjectManager
  ) {
    // Create layer-specific config
    const layeredConfig = LayeredWinstonLogger.createLayerConfig(layer, layerName, config, projectManager);
    super(component, layeredConfig, projectManager);
    
    this.layer = layer;
    this.layerName = layerName;
  }

  private static createLayerConfig(
    layer: LogLayer, 
    layerName: string | undefined,
    baseConfig: LayeredLoggerConfig,
    projectManager?: ProjectManager
  ): WinstonLoggerConfig {
    const config = { ...baseConfig };
    const logDir = projectManager
      ? path.join(projectManager.getHomeDirectory(), 'logs')
      : path.join(process.cwd(), 'logs');

    // Configure file transport based on layer
    if (config.transports?.file?.enabled && config.separateFiles !== false) {
      let filename: string;
      
      switch (layer) {
        case LogLayer.PLATFORM:
          filename = path.join(logDir, 'platform', 'sker-platform-%DATE%.log');
          break;
        case LogLayer.APPLICATION:
          filename = path.join(logDir, 'application', 'sker-app-%DATE%.log');
          break;
        case LogLayer.PLUGIN:
          const pluginDir = path.join(logDir, 'plugins', layerName || 'unknown');
          filename = path.join(pluginDir, `${layerName || 'plugin'}-%DATE%.log`);
          break;
        default:
          filename = path.join(logDir, 'sker-daemon-%DATE%.log');
      }

      config.transports.file.filename = filename;
    }

    // Set layer-specific log levels if not overridden
    if (!config.level) {
      switch (layer) {
        case LogLayer.PLATFORM:
          config.level = 'warn'; // Platform logs only warnings and errors by default
          break;
        case LogLayer.APPLICATION:
          config.level = 'info'; // Application logs info and above
          break;
        case LogLayer.PLUGIN:
          config.level = 'debug'; // Plugin logs everything for debugging
          break;
      }
    }

    return config;
  }

  getLayer(): LogLayer {
    return this.layer;
  }

  getLayerName(): string | undefined {
    return this.layerName;
  }

  child(context: Record<string, any>): IWinstonLogger {
    // Create child logger in the same layer
    const childContext = {
      ...context,
      layer: this.layer,
      layerName: this.layerName
    };
    
    const childLogger = super.child(childContext);
    return childLogger;
  }
}

/**
 * Layered logger factory implementation
 */
@Injectable()
export class LayeredLoggerFactory implements ILayeredLoggerFactory {
  private loggers = new Map<string, LayeredWinstonLogger>();
  private layerConfigs = new Map<LogLayer, Partial<WinstonLoggerConfig>>();
  private baseConfig: LayeredLoggerConfig;

  constructor(
    @Inject(LOGGER_CONFIG) config: WinstonLoggerConfig,
    @Inject(PROJECT_MANAGER) private readonly projectManager: ProjectManager
  ) {
    this.baseConfig = {
      ...config,
      layer: LogLayer.APPLICATION, // Default layer
      separateFiles: true,
      inheritParentLevel: false
    } as LayeredLoggerConfig;

    // Initialize default layer configurations
    this.initializeLayerConfigs();
  }

  createPlatformLogger(component: string): IWinstonLogger {
    return this.createLayeredLogger(LogLayer.PLATFORM, component);
  }

  createApplicationLogger(component: string): IWinstonLogger {
    return this.createLayeredLogger(LogLayer.APPLICATION, component);
  }

  createPluginLogger(pluginName: string, component: string): IWinstonLogger {
    return this.createLayeredLogger(LogLayer.PLUGIN, component, pluginName);
  }

  getLogger(layer: LogLayer, component: string, layerName?: string): IWinstonLogger | null {
    const key = this.createLoggerKey(layer, component, layerName);
    return this.loggers.get(key) || null;
  }

  configureLayer(layer: LogLayer, config: Partial<WinstonLoggerConfig>): void {
    this.layerConfigs.set(layer, config);
    
    // Update existing loggers in this layer
    for (const [key, logger] of this.loggers.entries()) {
      if (logger.getLayer() === layer) {
        // Recreate logger with new config (simplified approach)
        // In production, you might want to update the existing Winston instance
        const [currentLayer, component, layerName] = this.parseLoggerKey(key);
        this.loggers.delete(key);
        this.createLayeredLogger(currentLayer, component, layerName);
      }
    }
  }

  listLoggersByLayer(layer: LogLayer): string[] {
    return Array.from(this.loggers.entries())
      .filter(([, logger]) => logger.getLayer() === layer)
      .map(([key]) => key);
  }

  private createLayeredLogger(layer: LogLayer, component: string, layerName?: string): LayeredWinstonLogger {
    const key = this.createLoggerKey(layer, component, layerName);
    
    // Return existing logger if found
    const existing = this.loggers.get(key);
    if (existing) {
      return existing;
    }

    // Create layer-specific configuration
    const layerConfig = this.layerConfigs.get(layer) || {};
    const config: LayeredLoggerConfig = {
      ...this.baseConfig,
      ...layerConfig,
      layer,
      layerName
    };

    // Create new layered logger
    const logger = new LayeredWinstonLogger(
      component, 
      layer, 
      layerName, 
      config, 
      this.projectManager
    );
    
    this.loggers.set(key, logger);
    return logger;
  }

  private createLoggerKey(layer: LogLayer, component: string, layerName?: string): string {
    return layerName ? `${layer}:${layerName}:${component}` : `${layer}:${component}`;
  }

  private parseLoggerKey(key: string): [LogLayer, string, string?] {
    const parts = key.split(':');
    if (parts.length === 3) {
      return [parts[0] as LogLayer, parts[2], parts[1]];
    }
    return [parts[0] as LogLayer, parts[1]];
  }

  private initializeLayerConfigs(): void {
    // Platform layer: Minimal logging, warnings and errors only
    this.layerConfigs.set(LogLayer.PLATFORM, {
      level: 'warn',
      transports: {
        console: {
          enabled: true,
          level: 'error' // Only show errors in console for platform layer
        },
        file: {
          enabled: true,
          level: 'warn',
          maxFiles: 7 // Keep platform logs for 1 week
        }
      }
    });

    // Application layer: Standard business logic logging
    this.layerConfigs.set(LogLayer.APPLICATION, {
      level: 'info',
      transports: {
        console: {
          enabled: true,
          level: 'info'
        },
        file: {
          enabled: true,
          level: 'debug',
          maxFiles: 14 // Keep app logs for 2 weeks
        }
      }
    });

    // Plugin layer: Verbose logging for debugging
    this.layerConfigs.set(LogLayer.PLUGIN, {
      level: 'debug',
      transports: {
        console: {
          enabled: true,
          level: 'warn' // Only show warnings/errors in console for plugins
        },
        file: {
          enabled: true,
          level: 'debug',
          maxFiles: 30 // Keep plugin logs for 1 month
        }
      }
    });
  }
}

/**
 * Logger utilities for different layers
 */
export class LoggerUtils {
  /**
   * Create a structured context for platform logs
   */
  static platformContext(service: string, operation: string, meta?: Record<string, any>): Record<string, any> {
    return {
      layer: LogLayer.PLATFORM,
      service,
      operation,
      category: 'platform',
      ...meta
    };
  }

  /**
   * Create a structured context for application logs
   */
  static applicationContext(feature: string, action: string, userId?: string, meta?: Record<string, any>): Record<string, any> {
    return {
      layer: LogLayer.APPLICATION,
      feature,
      action,
      userId,
      category: 'application',
      ...meta
    };
  }

  /**
   * Create a structured context for plugin logs
   */
  static pluginContext(pluginName: string, operation: string, meta?: Record<string, any>): Record<string, any> {
    return {
      layer: LogLayer.PLUGIN,
      pluginName,
      operation,
      category: 'plugin',
      ...meta
    };
  }
}

/**
 * Default layered logger configuration
 */
export const DEFAULT_LAYERED_CONFIG: LayeredLoggerConfig = {
  level: 'info',
  format: 'simple',
  layer: LogLayer.APPLICATION,
  separateFiles: true,
  inheritParentLevel: false,
  transports: {
    console: {
      enabled: true,
      level: 'info',
      colorize: true,
      timestamp: true
    },
    file: {
      enabled: true,
      level: 'debug',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxsize: 20971520, // 20MB
      maxFiles: 14 // 2 weeks
    }
  },
  options: {
    exitOnError: false,
    handleExceptions: true,
    handleRejections: true
  }
};