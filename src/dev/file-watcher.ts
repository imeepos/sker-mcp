/**
 * File Watcher Implementation
 * 
 * Monitors package.json main files for changes in development mode plugins.
 * Uses chokidar for reliable cross-platform file watching with debouncing.
 */

import { Injectable, Inject } from '@sker/di';
import { LOGGER } from '../core/tokens.js';
import type { IWinstonLogger } from '../core/logging/winston-logger.js';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs/promises';

/**
 * File watcher event callback
 */
export type FileWatcherCallback = (filePath: string, pluginName: string) => void;

/**
 * Plugin watch configuration
 */
export interface PluginWatchConfig {
  /** Plugin name */
  pluginName: string;
  /** Plugin directory path */
  pluginPath: string;
  /** Main file path to watch */
  mainFilePath: string;
  /** Package.json path */
  packageJsonPath: string;
}

/**
 * File Watcher for Plugin Development
 * 
 * Monitors package.json main files for plugins in development mode.
 * Only watches plugins that have sker.development=true in their package.json.
 */
@Injectable()
export class FileWatcher {
  private watchers = new Map<string, chokidar.FSWatcher>();
  private watchConfigs = new Map<string, PluginWatchConfig>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private isWatching = false;
  private onChange: FileWatcherCallback | null = null;

  constructor(
    @Inject(LOGGER) private readonly logger: IWinstonLogger
  ) {
    this.logger.debug('FileWatcher initialized');
  }

  /**
   * Check if a plugin is in development mode
   */
  async isInDevelopmentMode(pluginPath: string): Promise<boolean> {
    try {
      const packageJsonPath = path.join(pluginPath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const pkg = JSON.parse(packageContent);
      
      return pkg.sker?.development === true;
    } catch (error) {
      this.logger.debug('Failed to read package.json for development mode check', {
        pluginPath,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Set up file watching for a plugin
   */
  async watchPlugin(pluginPath: string): Promise<void> {
    try {
      // Check if plugin is in development mode
      if (!(await this.isInDevelopmentMode(pluginPath))) {
        this.logger.debug('Plugin not in development mode, skipping watch', { pluginPath });
        return;
      }

      const packageJsonPath = path.join(pluginPath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const pkg = JSON.parse(packageContent);
      
      if (!pkg.main) {
        this.logger.warn('No main field in package.json, cannot watch plugin', { pluginPath });
        return;
      }

      const pluginName = pkg.name || path.basename(pluginPath);
      const mainFilePath = path.resolve(pluginPath, pkg.main);

      // Check if already watching
      if (this.watchers.has(pluginName)) {
        this.logger.debug('Plugin already being watched', { pluginName });
        return;
      }

      // Create watch configuration
      const watchConfig: PluginWatchConfig = {
        pluginName,
        pluginPath,
        mainFilePath,
        packageJsonPath
      };

      // Set up watcher for the main file only
      const watcher = chokidar.watch(mainFilePath, {
        ignoreInitial: true,
        persistent: true,
        usePolling: false,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50
        }
      });

      // Set up event handlers
      watcher.on('change', (filePath: string) => {
        this.handleFileChange(filePath, watchConfig);
      });

      watcher.on('error', (error: Error) => {
        this.logger.error('File watcher error', {
          pluginName,
          mainFilePath,
          error: error.message
        });
      });

      // Store watcher and config
      this.watchers.set(pluginName, watcher);
      this.watchConfigs.set(pluginName, watchConfig);

      this.logger.info('Started watching plugin main file', {
        pluginName,
        mainFilePath,
        development: true
      });

    } catch (error) {
      this.logger.error('Failed to setup plugin watching', {
        pluginPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Stop watching a plugin
   */
  async stopWatching(pluginPath: string): Promise<void> {
    try {
      // Find plugin name by path
      let pluginNameToStop: string | null = null;
      for (const [pluginName, config] of this.watchConfigs.entries()) {
        if (config.pluginPath === pluginPath) {
          pluginNameToStop = pluginName;
          break;
        }
      }

      if (!pluginNameToStop) {
        this.logger.debug('Plugin not being watched', { pluginPath });
        return;
      }

      await this.stopWatchingByName(pluginNameToStop);
      
    } catch (error) {
      this.logger.error('Failed to stop watching plugin', {
        pluginPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Stop watching a plugin by name
   */
  async stopWatchingByName(pluginName: string): Promise<void> {
    try {
      const watcher = this.watchers.get(pluginName);
      if (watcher) {
        await watcher.close();
        this.watchers.delete(pluginName);
      }

      // Clear debounce timer
      const timer = this.debounceTimers.get(pluginName);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(pluginName);
      }

      this.watchConfigs.delete(pluginName);

      this.logger.debug('Stopped watching plugin', { pluginName });

    } catch (error) {
      this.logger.error('Failed to stop watching plugin by name', {
        pluginName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check if a plugin is being watched
   */
  isWatchingPlugin(pluginPath: string): boolean {
    for (const config of this.watchConfigs.values()) {
      if (config.pluginPath === pluginPath) {
        return true;
      }
    }
    return false;
  }

  /**
   * Set change callback
   */
  setChangeCallback(callback: FileWatcherCallback): void {
    this.onChange = callback;
  }

  /**
   * Start watching all configured plugins
   */
  async startWatching(): Promise<void> {
    this.isWatching = true;
    this.logger.info('File watcher started', {
      watchingPlugins: this.watchers.size
    });
  }

  /**
   * Stop watching all plugins
   */
  async stopWatchingAll(): Promise<void> {
    this.isWatching = false;

    const pluginNames = Array.from(this.watchers.keys());
    
    for (const pluginName of pluginNames) {
      await this.stopWatchingByName(pluginName);
    }

    this.logger.info('File watcher stopped', {
      stoppedPlugins: pluginNames.length
    });
  }

  /**
   * Get watching status
   */
  getWatchingStatus(): {
    isWatching: boolean;
    watchingPlugins: Array<{
      pluginName: string;
      pluginPath: string;
      mainFile: string;
    }>;
    totalWatchers: number;
  } {
    const watchingPlugins = Array.from(this.watchConfigs.values()).map(config => ({
      pluginName: config.pluginName,
      pluginPath: config.pluginPath,
      mainFile: config.mainFilePath
    }));

    return {
      isWatching: this.isWatching,
      watchingPlugins,
      totalWatchers: this.watchers.size
    };
  }

  /**
   * Handle file change with debouncing
   */
  private handleFileChange(filePath: string, config: PluginWatchConfig): void {
    const { pluginName } = config;

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(pluginName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounced timer (500ms delay)
    const timer = setTimeout(() => {
      this.logger.debug('File changed, triggering reload', {
        pluginName,
        filePath,
        mainFile: config.mainFilePath
      });

      if (this.onChange) {
        this.onChange(filePath, pluginName);
      }

      this.debounceTimers.delete(pluginName);
    }, 500);

    this.debounceTimers.set(pluginName, timer);
  }

  /**
   * Cleanup all watchers
   */
  async cleanup(): Promise<void> {
    await this.stopWatchingAll();
    this.onChange = null;
    
    this.logger.debug('FileWatcher cleanup completed');
  }
}