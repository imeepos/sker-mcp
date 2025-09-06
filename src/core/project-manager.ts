/**
 * Project Manager
 * 
 * This module provides project directory management functionality for the Sker Daemon MCP system.
 * It handles home directory resolution, plugin directory scanning, and ensures proper
 * project structure initialization.
 */

import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { Injectable } from '@sker/di';

/**
 * ProjectManager class handles project directory structure and path management
 */

@Injectable({ providedIn: 'root' })
export class ProjectManager {
  private readonly homeDirectory: string;

  /**
   * Constructor initializes the project manager with home directory
   * Uses SKER_HOME_DIR environment variable or defaults to ~/.sker
   */
  constructor() {
    this.homeDirectory = this.resolveHomeDirectory();
  }

  /**
   * Resolves the home directory for the project
   * Priority: SKER_HOME_DIR env var > ~/.sker default
   */
  private resolveHomeDirectory(): string {
    const envHomeDir = process.env.SKER_HOME_DIR;

    if (envHomeDir && envHomeDir.trim() !== '') {
      // Resolve relative paths to absolute paths
      return path.resolve(envHomeDir.trim());
    }

    // Default to ~/.sker
    return path.join(os.homedir(), '.sker');
  }

  /**
   * Gets the project home directory path
   */
  getHomeDirectory(): string {
    return this.homeDirectory;
  }

  /**
   * Gets the plugins directory path
   */
  getPluginsDirectory(): string {
    return path.join(this.homeDirectory, 'plugins');
  }

  /**
   * Gets the configuration directory path
   */
  getConfigDirectory(): string {
    return path.join(this.homeDirectory, 'config');
  }

  /**
   * Gets the logs directory path
   */
  getLogsDirectory(): string {
    return path.join(this.homeDirectory, 'logs');
  }

  /**
   * Resolves a path to absolute form
   * If path is already absolute, returns it unchanged
   * If path is relative, resolves it from current working directory
   */
  resolvePath(pathToResolve: string): string {
    if (path.isAbsolute(pathToResolve)) {
      return pathToResolve;
    }

    return path.resolve(pathToResolve);
  }

  /**
   * Resolves a path relative to the project home directory
   */
  resolveFromHome(relativePath: string): string {
    return path.join(this.homeDirectory, relativePath);
  }

  /**
   * Ensures a directory exists, creating it if necessary
   */
  async ensureDirectoryExists(directoryPath: string): Promise<void> {
    try {
      await fs.access(directoryPath);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(directoryPath, { recursive: true });
    }
  }

  /**
   * Creates the complete project directory structure
   */
  async createProjectStructure(): Promise<void> {
    await this.ensureDirectoryExists(this.homeDirectory);
    await this.ensureDirectoryExists(this.getPluginsDirectory());
    await this.ensureDirectoryExists(this.getConfigDirectory());
    await this.ensureDirectoryExists(this.getLogsDirectory());
  }

  /**
   * Scans the plugins directory and returns a list of plugin directory names
   */
  async scanPluginsDirectory(): Promise<string[]> {
    try {
      const pluginsDir = this.getPluginsDirectory();
      await this.ensureDirectoryExists(pluginsDir);

      const entries = await fs.readdir(pluginsDir, { withFileTypes: true });

      // Return only directories
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort(); // Sort alphabetically for consistent ordering

    } catch (error) {
      // If we can't read the directory, return empty array
      return [];
    }
  }

  /**
   * Gets plugin directory path for a specific plugin
   */
  getPluginDirectory(pluginName: string): string {
    return path.join(this.getPluginsDirectory(), pluginName);
  }

  /**
   * Checks if a plugin directory exists
   */
  async pluginDirectoryExists(pluginName: string): Promise<boolean> {
    try {
      const pluginDir = this.getPluginDirectory(pluginName);
      const stats = await fs.stat(pluginDir);
      return stats.isDirectory();
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets the package.json path for a specific plugin
   */
  getPluginPackageJsonPath(pluginName: string): string {
    return path.join(this.getPluginDirectory(pluginName), 'package.json');
  }

  /**
   * Checks if a plugin has a valid package.json
   */
  async hasValidPluginPackageJson(pluginName: string): Promise<boolean> {
    try {
      const packageJsonPath = this.getPluginPackageJsonPath(pluginName);
      await fs.access(packageJsonPath);

      const packageData = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageData);

      // Basic validation - must have name and main/index
      return !!(packageJson.name && (packageJson.main || packageJson.index));
    } catch (error) {
      return false;
    }
  }
}