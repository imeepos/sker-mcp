/**
 * Environment Configuration Tests
 * 
 * This module provides tests for environment configuration processing,
 * including environment variable parsing, template loading, and validation.
 */

import { EnvironmentConfigProcessor, EnvironmentUtils } from './environment-config.js';
import { ConfigValidator } from './config-schema.js';
import os from 'os';
import path from 'path';

describe('EnvironmentConfigProcessor', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear Sker-related environment variables
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('SKER_')) {
        delete process.env[key];
      }
    });
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Environment Detection', () => {
    it('should detect development environment by default', () => {
      const env = EnvironmentConfigProcessor.getCurrentEnvironment();
      expect(env).toBe('development');
    });

    it('should detect production environment from NODE_ENV', () => {
      process.env.NODE_ENV = 'production';
      const env = EnvironmentConfigProcessor.getCurrentEnvironment();
      expect(env).toBe('production');
    });

    it('should detect testing environment from NODE_ENV', () => {
      process.env.NODE_ENV = 'testing';
      const env = EnvironmentConfigProcessor.getCurrentEnvironment();
      expect(env).toBe('testing');
    });

    it('should detect environment from SKER_ENV', () => {
      process.env.SKER_ENV = 'production';
      const env = EnvironmentConfigProcessor.getCurrentEnvironment();
      expect(env).toBe('production');
    });

    it('should normalize environment names', () => {
      process.env.NODE_ENV = 'prod';
      expect(EnvironmentConfigProcessor.getCurrentEnvironment()).toBe('production');
      
      process.env.NODE_ENV = 'test';
      expect(EnvironmentConfigProcessor.getCurrentEnvironment()).toBe('testing');
    });
  });

  describe('Directory Configuration', () => {
    it('should provide default Sker home directory', () => {
      const homeDir = EnvironmentConfigProcessor.getSkerHomeDir();
      expect(homeDir).toBe(path.join(os.homedir(), '.sker'));
    });

    it('should use custom Sker home directory from environment', () => {
      process.env.SKER_HOME_DIR = '/custom/sker/path';
      const homeDir = EnvironmentConfigProcessor.getSkerHomeDir();
      expect(homeDir).toBe('/custom/sker/path');
    });

    it('should provide configuration directory', () => {
      const configDir = EnvironmentConfigProcessor.getConfigDir();
      expect(configDir).toContain('.sker');
      expect(configDir).toContain('config');
    });

    it('should provide log directory', () => {
      const logDir = EnvironmentConfigProcessor.getLogDir();
      expect(logDir).toContain('.sker');
      expect(logDir).toContain('logs');
    });

    it('should provide plugin directory', () => {
      const pluginDir = EnvironmentConfigProcessor.getPluginDir();
      expect(pluginDir).toContain('.sker');
      expect(pluginDir).toContain('plugins');
    });
  });

  describe('Environment Variable Loading', () => {
    it('should load server configuration from environment', () => {
      process.env.SKER_SERVER_NAME = 'env-test-server';
      process.env.SKER_SERVER_VERSION = '2.0.0';
      process.env.SKER_SERVER_HTTP_PORT = '8080';
      
      const config = EnvironmentConfigProcessor.loadFromEnvironment();
      
      expect(config.server?.name).toBe('env-test-server');
      expect(config.server?.version).toBe('2.0.0');
      expect(config.server?.transport?.http?.port).toBe(8080);
    });

    it('should load logging configuration from environment', () => {
      process.env.SKER_LOG_LEVEL = 'debug';
      process.env.SKER_LOG_FORMAT = 'json';
      process.env.SKER_LOG_COLORIZE = 'false';
      
      const config = EnvironmentConfigProcessor.loadFromEnvironment();
      
      expect(config.logging?.level).toBe('debug');
      expect(config.logging?.format).toBe('json');
      expect(config.logging?.colorize).toBe(false);
    });

    it('should load plugin configuration from environment', () => {
      process.env.SKER_PLUGIN_DIRECTORIES = 'plugins,extra-plugins,/custom/plugins';
      process.env.SKER_PLUGIN_MAX_DEPTH = '5';
      process.env.SKER_PLUGIN_WATCH = 'true';
      
      const config = EnvironmentConfigProcessor.loadFromEnvironment();
      
      expect(config.plugins?.discovery?.directories).toEqual(['plugins', 'extra-plugins', '/custom/plugins']);
      expect(config.plugins?.discovery?.maxDepth).toBe(5);
      expect(config.plugins?.discovery?.watch).toBe(true);
    });

    it('should handle boolean parsing', () => {
      process.env.SKER_SERVER_HTTP_CORS = 'true';
      process.env.SKER_LOG_TIMESTAMP = 'false';
      process.env.SKER_DEV_ENABLED = '1';
      
      const config = EnvironmentConfigProcessor.loadFromEnvironment();
      
      expect(config.server?.transport?.http?.cors).toBe(true);
      expect(config.logging?.timestamp).toBe(false);
      expect(config.environment?.settings?.development?.enabled).toBe(true);
    });

    it('should handle array parsing', () => {
      process.env.SKER_PLUGIN_DIRECTORIES = 'dir1, dir2 , dir3';
      process.env.SKER_SECURITY_API_KEYS = 'key1,key2,key3';
      
      const config = EnvironmentConfigProcessor.loadFromEnvironment();
      
      expect(config.plugins?.discovery?.directories).toEqual(['dir1', 'dir2', 'dir3']);
      expect(config.security?.apiKey?.keys).toEqual(['key1', 'key2', 'key3']);
    });
  });

  describe('Environment Templates', () => {
    it('should provide development template', () => {
      process.env.NODE_ENV = 'development';
      const template = EnvironmentConfigProcessor.getEnvironmentTemplate();
      
      expect(template.environment?.environment).toBe('development');
      expect(template.environment?.settings?.development?.enabled).toBe(true);
      expect(template.logging?.level).toBe('debug');
    });

    it('should provide production template', () => {
      process.env.NODE_ENV = 'production';
      const template = EnvironmentConfigProcessor.getEnvironmentTemplate();
      
      expect(template.environment?.environment).toBe('production');
      expect(template.logging?.level).toBe('warn');
      expect(template.security?.authentication).toBe(true);
    });

    it('should provide testing template', () => {
      process.env.NODE_ENV = 'testing';
      const template = EnvironmentConfigProcessor.getEnvironmentTemplate();
      
      expect(template.environment?.environment).toBe('testing');
      expect(template.logging?.level).toBe('error');
    });
  });

  describe('Complete Configuration Creation', () => {
    it('should create complete environment configuration', () => {
      process.env.SKER_SERVER_NAME = 'full-test';
      process.env.NODE_ENV = 'development';
      
      const config = EnvironmentConfigProcessor.createEnvironmentConfig();
      
      expect(config.server.name).toBe('full-test');
      expect(config.environment.environment).toBe('development');
      expect(ConfigValidator.validateConfig(config)).toBeTruthy();
    });

    it('should merge configurations with correct priority', () => {
      process.env.SKER_SERVER_NAME = 'env-override';
      process.env.NODE_ENV = 'production';
      
      const config = EnvironmentConfigProcessor.createEnvironmentConfig();
      
      // Environment variable should override template
      expect(config.server.name).toBe('env-override');
      // Template should provide environment-specific settings
      expect(config.environment.environment).toBe('production');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid environment configuration', () => {
      const result = EnvironmentConfigProcessor.validateEnvironmentConfig();
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should provide warnings for production issues', () => {
      process.env.NODE_ENV = 'production';
      process.env.SKER_DEV_ENABLED = 'true';
      process.env.SKER_LOG_LEVEL = 'debug';
      
      const result = EnvironmentConfigProcessor.validateEnvironmentConfig();
      
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Development mode'))).toBe(true);
    });
  });

  describe('Environment Variables Listing', () => {
    it('should list Sker environment variables', () => {
      process.env.SKER_SERVER_NAME = 'test';
      process.env.SKER_LOG_LEVEL = 'debug';
      process.env.NODE_ENV = 'development';
      process.env.OTHER_VAR = 'ignored';
      
      const skerVars = EnvironmentConfigProcessor.getSkerEnvironmentVariables();
      
      expect(skerVars.SKER_SERVER_NAME).toBe('test');
      expect(skerVars.SKER_LOG_LEVEL).toBe('debug');
      expect(skerVars.NODE_ENV).toBe('development');
      expect(skerVars.OTHER_VAR).toBeUndefined();
    });
  });

  describe('Directory Processing', () => {
    it('should process relative plugin directories', () => {
      process.env.SKER_HOME_DIR = '/test/sker';
      process.env.SKER_PLUGIN_DIRECTORIES = 'plugins,extra';

      const config = EnvironmentConfigProcessor.loadFromEnvironment();
      const processed = EnvironmentConfigProcessor.processDirectoryConfig(config);

      expect(processed.plugins?.discovery?.directories).toEqual([
        path.join('/test/sker', 'plugins'),
        path.join('/test/sker', 'extra')
      ]);
    });

    it('should preserve absolute plugin directories', () => {
      process.env.SKER_PLUGIN_DIRECTORIES = '/absolute/path,relative,/another/absolute';
      
      const config = EnvironmentConfigProcessor.loadFromEnvironment();
      const processed = EnvironmentConfigProcessor.processDirectoryConfig(config);
      
      const dirs = processed.plugins?.discovery?.directories || [];
      expect(dirs[0]).toBe('/absolute/path');
      expect(dirs[1]).toContain('relative'); // Should be made absolute
      expect(dirs[2]).toBe('/another/absolute');
    });
  });

  describe('Documentation Generation', () => {
    it('should generate environment documentation', () => {
      const docs = EnvironmentConfigProcessor.generateEnvironmentDocs();
      
      expect(docs).toContain('# Sker Daemon Environment Variables');
      expect(docs).toContain('SKER_SERVER_NAME');
      expect(docs).toContain('SKER_LOG_LEVEL');
      expect(docs).toContain('## Environment Variables');
    });
  });
});

describe('EnvironmentUtils', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.NODE_ENV;
    delete process.env.SKER_ENV;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Checking', () => {
    it('should check development environment', () => {
      expect(EnvironmentUtils.isDevelopment()).toBe(true);
      
      process.env.NODE_ENV = 'production';
      expect(EnvironmentUtils.isDevelopment()).toBe(false);
    });

    it('should check production environment', () => {
      expect(EnvironmentUtils.isProduction()).toBe(false);
      
      process.env.NODE_ENV = 'production';
      expect(EnvironmentUtils.isProduction()).toBe(true);
    });

    it('should check testing environment', () => {
      expect(EnvironmentUtils.isTesting()).toBe(false);
      
      process.env.NODE_ENV = 'testing';
      expect(EnvironmentUtils.isTesting()).toBe(true);
    });

    it('should get environment name', () => {
      expect(EnvironmentUtils.getEnvironment()).toBe('development');
      
      process.env.NODE_ENV = 'production';
      expect(EnvironmentUtils.getEnvironment()).toBe('production');
    });
  });

  describe('Directory Management', () => {
    it('should provide all directories', () => {
      const directories = EnvironmentUtils.getDirectories();

      // In test environment, SKER_HOME_DIR is set to './test-sker-home'
      expect(directories.home).toContain('test-sker-home');
      expect(directories.config).toContain('config');
      expect(directories.logs).toContain('logs');
      expect(directories.plugins).toContain('plugins');
    });

    it('should ensure directories (mocked)', () => {
      // Mock fs to avoid actual directory creation in tests
      const mockFs = require('fs');
      mockFs.mkdirSync = jest.fn();
      
      expect(() => EnvironmentUtils.ensureDirectories()).not.toThrow();
    });
  });
});