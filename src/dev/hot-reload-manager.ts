/**
 * Hot Reload Manager Implementation
 * 
 * Coordinates file watching with plugin reloading to provide seamless
 * development experience. Automatically reloads plugins when their
 * main files change during development.
 */

import { Injectable, Inject } from '@sker/di';
import { LOGGER } from '../core/tokens.js';
import { ProjectManager } from '../core/project-manager.js';
import { PluginManager } from '../core/plugin-manager.js';
import type { IWinstonLogger } from '../core/logging/winston-logger.js';
import { FileWatcher, type PluginWatchConfig } from './file-watcher.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Hot reload event types
 */
export enum HotReloadEvent {
  RELOAD_STARTED = 'reload_started',
  RELOAD_SUCCESS = 'reload_success', 
  RELOAD_FAILED = 'reload_failed',
  WATCH_STARTED = 'watch_started',
  WATCH_STOPPED = 'watch_stopped'
}

/**
 * Hot reload event data
 */
export interface HotReloadEventData {
  event: HotReloadEvent;
  pluginName: string;
  filePath?: string;
  duration?: number;
  error?: string;
  timestamp: Date;
}

/**
 * Hot reload event callback
 */
export type HotReloadEventCallback = (data: HotReloadEventData) => void;

/**
 * Development mode statistics
 */
export interface DevModeStats {
  isActive: boolean;
  watchingPlugins: number;
  totalReloads: number;
  successfulReloads: number;
  failedReloads: number;
  averageReloadTime: number;
  lastReloadTime?: Date;
  uptime: number;
}

/**
 * Hot Reload Manager for Plugin Development
 * 
 * Manages the coordination between file watching and plugin reloading.
 * Provides a simple interface for development mode operations.
 */
@Injectable()
export class HotReloadManager {
  private fileWatcher: FileWatcher;
  private isDevMode = false;
  private startTime?: Date;
  private eventCallbacks: HotReloadEventCallback[] = [];
  private reloadStats = {
    total: 0,
    successful: 0,
    failed: 0,
    totalTime: 0
  };

  constructor(
    @Inject(LOGGER) private readonly logger: IWinstonLogger,
    @Inject(PluginManager) private readonly pluginManager: PluginManager,
    @Inject(ProjectManager) private readonly projectManager: ProjectManager
  ) {
    this.fileWatcher = new FileWatcher(this.logger);
    this.setupFileWatcher();
    
    this.logger.debug('HotReloadManager initialized');
  }

  /**
   * Start development mode
   */
  async startDevMode(): Promise<void> {
    if (this.isDevMode) {
      this.logger.warn('Development mode is already active');
      return;
    }

    const startTime = Date.now();
    this.startTime = new Date();
    
    try {
      this.logger.info('Starting development mode');

      // Discover all plugins in development mode
      await this.scanAndWatchDevelopmentPlugins();

      // Start file watching
      await this.fileWatcher.startWatching();

      this.isDevMode = true;

      const duration = Date.now() - startTime;
      const status = this.fileWatcher.getWatchingStatus();

      this.logger.info('Development mode started successfully', {
        watchingPlugins: status.watchingPlugins.length,
        duration
      });

      this.emitEvent({
        event: HotReloadEvent.WATCH_STARTED,
        pluginName: 'system',
        duration,
        timestamp: new Date()
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to start development mode', {
        error: error instanceof Error ? error.message : String(error),
        duration
      });
      throw error;
    }
  }

  /**
   * Stop development mode
   */
  async stopDevMode(): Promise<void> {
    if (!this.isDevMode) {
      this.logger.debug('Development mode is not active');
      return;
    }

    try {
      this.logger.info('Stopping development mode');

      // Stop file watching
      await this.fileWatcher.stopWatchingAll();

      this.isDevMode = false;
      const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;

      this.logger.info('Development mode stopped', {
        uptime,
        totalReloads: this.reloadStats.total,
        successfulReloads: this.reloadStats.successful
      });

      this.emitEvent({
        event: HotReloadEvent.WATCH_STOPPED,
        pluginName: 'system',
        duration: uptime,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error('Error stopping development mode', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Manually reload a specific plugin
   */
  async reloadPlugin(pluginName: string): Promise<boolean> {
    const startTime = Date.now();

    try {
      this.logger.info('Manual plugin reload requested', { pluginName });

      this.emitEvent({
        event: HotReloadEvent.RELOAD_STARTED,
        pluginName,
        timestamp: new Date()
      });

      // Use PluginManager to reload the plugin
      await this.pluginManager.reloadPlugin(pluginName);

      const duration = Date.now() - startTime;
      this.updateReloadStats(true, duration);

      this.logger.info('Manual plugin reload successful', { pluginName, duration });

      this.emitEvent({
        event: HotReloadEvent.RELOAD_SUCCESS,
        pluginName,
        duration,
        timestamp: new Date()
      });

      return true;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateReloadStats(false, duration);

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Manual plugin reload failed', {
        pluginName,
        error: errorMessage,
        duration
      });

      this.emitEvent({
        event: HotReloadEvent.RELOAD_FAILED,
        pluginName,
        error: errorMessage,
        duration,
        timestamp: new Date()
      });

      return false;
    }
  }

  /**
   * Get development mode status
   */
  getDevModeStatus(): DevModeStats {
    const status = this.fileWatcher.getWatchingStatus();
    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    const averageReloadTime = this.reloadStats.total > 0 
      ? this.reloadStats.totalTime / this.reloadStats.total 
      : 0;

    return {
      isActive: this.isDevMode,
      watchingPlugins: status.watchingPlugins.length,
      totalReloads: this.reloadStats.total,
      successfulReloads: this.reloadStats.successful,
      failedReloads: this.reloadStats.failed,
      averageReloadTime,
      uptime
    };
  }

  /**
   * Get list of plugins being watched
   */
  getWatchingPlugins(): Array<{
    pluginName: string;
    pluginPath: string;
    mainFile: string;
  }> {
    const status = this.fileWatcher.getWatchingStatus();
    return status.watchingPlugins;
  }

  /**
   * Add event callback
   */
  onEvent(callback: HotReloadEventCallback): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Remove event callback
   */
  offEvent(callback: HotReloadEventCallback): void {
    const index = this.eventCallbacks.indexOf(callback);
    if (index > -1) {
      this.eventCallbacks.splice(index, 1);
    }
  }

  /**
   * Cleanup hot reload manager
   */
  async cleanup(): Promise<void> {
    await this.stopDevMode();
    await this.fileWatcher.cleanup();
    this.eventCallbacks = [];
    
    this.logger.debug('HotReloadManager cleanup completed');
  }

  // Private methods

  /**
   * Setup file watcher event handling
   */
  private setupFileWatcher(): void {
    this.fileWatcher.setChangeCallback((filePath: string, pluginName: string) => {
      this.handleFileChange(filePath, pluginName);
    });
  }

  /**
   * Handle file change event
   */
  private async handleFileChange(filePath: string, pluginName: string): Promise<void> {
    this.logger.debug('File change detected, reloading plugin', {
      pluginName,
      filePath
    });

    const success = await this.reloadPlugin(pluginName);
    
    if (success) {
      this.logger.info('Hot reload successful', { pluginName, filePath });
    } else {
      this.logger.warn('Hot reload failed', { pluginName, filePath });
    }
  }

  /**
   * Scan plugins directory and setup watching for development plugins
   */
  private async scanAndWatchDevelopmentPlugins(): Promise<void> {
    try {
      const pluginsDir = this.projectManager.getPluginsDirectory();
      
      // Ensure plugins directory exists
      await this.projectManager.ensureDirectoryExists(pluginsDir);

      // Read directory contents
      const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
      
      let watchCount = 0;

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(pluginsDir, entry.name);
          
          try {
            // Check if plugin is in development mode
            if (await this.fileWatcher.isInDevelopmentMode(pluginPath)) {
              await this.fileWatcher.watchPlugin(pluginPath);
              watchCount++;
              
              this.logger.debug('Set up watching for development plugin', {
                pluginName: entry.name,
                pluginPath
              });
            } else {
              this.logger.debug('Plugin not in development mode, skipping', {
                pluginName: entry.name
              });
            }
          } catch (error) {
            this.logger.warn('Failed to setup watching for plugin', {
              pluginName: entry.name,
              pluginPath,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      this.logger.info('Plugin scanning completed', {
        totalPlugins: entries.filter(e => e.isDirectory()).length,
        developmentPlugins: watchCount
      });

    } catch (error) {
      this.logger.error('Failed to scan plugins directory', {
        pluginsDir: this.projectManager.getPluginsDirectory(),
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update reload statistics
   */
  private updateReloadStats(success: boolean, duration: number): void {
    this.reloadStats.total++;
    this.reloadStats.totalTime += duration;
    
    if (success) {
      this.reloadStats.successful++;
    } else {
      this.reloadStats.failed++;
    }
  }

  /**
   * Emit hot reload event
   */
  private emitEvent(data: HotReloadEventData): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(data);
      } catch (error) {
        this.logger.error('Error in hot reload event callback', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
}