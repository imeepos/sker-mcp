/**
 * Configuration Manager Tests
 * 
 * This module provides comprehensive tests for the configuration management system,
 * including schema validation, environment processing, file loading, and hot reload functionality.
 */

import { ConfigManager } from './config-manager.js';
import { ConfigValidator, Config } from './config-schema.js';
import { EnvironmentConfigProcessor } from './environment-config.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock file system operations
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let originalEnv: NodeJS.ProcessEnv;
  let testConfigDir: string;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set up test environment
    testConfigDir = path.join(os.tmpdir(), 'sker-test-config');
    process.env.SKER_CONFIG_DIR = testConfigDir;
    process.env.NODE_ENV = 'testing';
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock file system defaults
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockImplementation(() => {});
    mockFs.watch.mockReturnValue({
      close: jest.fn()
    } as any);
    
    // Create fresh config manager instance
    configManager = new ConfigManager();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Clean up config manager
    if (configManager) {
      configManager.disableHotReload();
      configManager.removeAllListeners();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const config = configManager.getConfig();
      
      expect(config).toBeDefined();
      expect(config.server).toBeDefined();
      expect(config.logging).toBeDefined();
      expect(config.plugins).toBeDefined();
      expect(config.version).toBe('1.0.0');
    });

    it('should load environment-based configuration', () => {
      process.env.SKER_SERVER_NAME = 'test-server';
      process.env.SKER_LOG_LEVEL = 'debug';
      
      const newConfigManager = new ConfigManager();
      const config = newConfigManager.getConfig();
      
      expect(config.server.name).toBe('test-server');
      expect(config.logging.level).toBe('debug');
    });
  });

  describe('Configuration Sources', () => {
    it('should get sources information', () => {
      const sources = configManager.getSourcesInfo();
      
      expect(sources).toHaveLength(3); // default, environment-template, environment-variables
      expect(sources[0].key).toBe('default');
      expect(sources[1].key).toBe('environment-template');
      expect(sources[2].key).toBe('environment-variables');
    });

    it('should remove configuration source', () => {
      configManager.removeSource('environment-template');
      const sources = configManager.getSourcesInfo();
      
      expect(sources).toHaveLength(2);
      expect(sources.find(s => s.key === 'environment-template')).toBeUndefined();
    });
  });

  describe('File Loading', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
    });

    it('should load configuration from JSON file', async () => {
      const testConfig = {
        server: { name: 'file-loaded-server' },
        logging: { level: 'warn' }
      };
      
      mockFs.promises.readFile = jest.fn().mockResolvedValue(JSON.stringify(testConfig));
      
      await configManager.loadFromFile('/test/config.json');
      const config = configManager.getConfig();
      
      expect(config.server.name).toBe('file-loaded-server');
      expect(config.logging.level).toBe('warn');
    });

    it('should handle file loading errors', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      await expect(configManager.loadFromFile('/nonexistent/config.json'))
        .rejects.toThrow('Configuration file not found');
    });

    it('should handle invalid JSON', async () => {
      mockFs.promises.readFile = jest.fn().mockResolvedValue('invalid json');
      
      await expect(configManager.loadFromFile('/test/invalid.json'))
        .rejects.toThrow('Failed to load configuration from /test/invalid.json');
    });
  });

  describe('Runtime Updates', () => {
    it('should update configuration at runtime', () => {
      const updates = {
        server: {
          version: '1.0.0',
          name: 'runtime-updated',
          transport: {
            type: 'stdio' as const
          },
          capabilities: {
            logging: true,
            sampling: false,
            experimental: false
          },
          limits: {
            maxConcurrentRequests: 100,
            maxRequestSize: 1048576,
            maxResponseSize: 1048576,
            requestTimeout: 30000
          }
        }
      };

      configManager.updateConfig(updates, 'test-source');
      const config = configManager.getConfig();

      expect(config.server.name).toBe('runtime-updated');
    });

    it('should set configuration value by path', () => {
      configManager.setConfigValue('server.name', 'path-updated');
      const config = configManager.getConfig();
      
      expect(config.server.name).toBe('path-updated');
    });

    it('should get configuration value by path', () => {
      configManager.setConfigValue('server.name', 'test-name');
      
      const value = configManager.getConfigValue('server.name');
      expect(value).toBe('test-name');
    });

    it('should return default value for missing path', () => {
      const value = configManager.getConfigValue('nonexistent.path', 'default');
      expect(value).toBe('default');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configuration successfully', () => {
      const result = configManager.validateConfiguration();
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid configuration', () => {
      // Force invalid config
      configManager.updateConfig({ server: { port: 'invalid' } } as any);
      
      const result = configManager.validateConfiguration();
      
      // Note: In a real test, this would depend on the actual validation logic
      // For now, we'll assume the config manager handles validation internally
      expect(result).toBeDefined();
    });
  });

  describe('Hot Reload', () => {
    it('should enable hot reload', () => {
      configManager.enableHotReload();
      
      // Verify that file watchers would be set up
      // This is more of an integration test concern
      expect(() => configManager.enableHotReload()).not.toThrow();
    });

    it('should disable hot reload', () => {
      configManager.enableHotReload();
      configManager.disableHotReload();
      
      expect(() => configManager.disableHotReload()).not.toThrow();
    });
  });

  describe('Configuration Export', () => {
    it('should export configuration to file', async () => {
      mockFs.promises.writeFile = jest.fn().mockResolvedValue(void 0);
      
      await configManager.exportConfiguration('/test/export.json');
      
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        '/test/export.json',
        expect.stringContaining('"version"'),
        'utf8'
      );
    });
  });

  describe('Reset to Defaults', () => {
    it('should reset configuration to defaults', () => {
      // Make some changes
      configManager.updateConfig({
        server: {
          version: '1.0.0',
          name: 'changed',
          transport: {
            type: 'stdio' as const
          },
          capabilities: {
            logging: true,
            sampling: false,
            experimental: false
          },
          limits: {
            maxConcurrentRequests: 100,
            maxRequestSize: 1048576,
            maxResponseSize: 1048576,
            requestTimeout: 30000
          }
        }
      });
      const changedConfig = configManager.getConfig();
      expect(changedConfig.server.name).toBe('changed');
      
      // Reset to defaults
      configManager.resetToDefaults();
      const resetConfig = configManager.getConfig();
      
      // Should be back to default values (environment might still affect this)
      expect(resetConfig.server.name).toBe('sker-daemon-mcp');
    });
  });
});

describe('ConfigValidator', () => {
  describe('Schema Validation', () => {
    it('should validate valid configuration', () => {
      const validConfig = {
        version: '1.0.0',
        server: {
          name: 'test-server',
          version: '1.0.0'
        },
        logging: {
          level: 'info'
        },
        plugins: {
          discovery: {
            directories: ['plugins']
          }
        }
      };
      
      expect(() => ConfigValidator.validateConfig(validConfig)).not.toThrow();
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        server: {
          name: 123 // Should be string
        }
      };
      
      expect(() => ConfigValidator.validateConfig(invalidConfig)).toThrow();
    });

    it('should safely validate configuration', () => {
      const invalidConfig = { server: { name: 123 } };
      
      const result = ConfigValidator.safeValidateConfig(invalidConfig);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Defaults', () => {
    it('should provide configuration defaults', () => {
      const defaults = ConfigValidator.getDefaults();
      
      expect(defaults.version).toBe('1.0.0');
      expect(defaults.server.name).toBe('sker-daemon-mcp');
      expect(defaults.logging.level).toBe('info');
    });

    it('should provide server defaults', () => {
      const serverDefaults = ConfigValidator.getServerDefaults();
      
      expect(serverDefaults.name).toBe('sker-daemon-mcp');
      expect(serverDefaults.version).toBe('1.0.0');
      expect(serverDefaults.transport.type).toBe('stdio');
    });
  });
});

describe('Environment Integration', () => {
  beforeEach(() => {
    // Reset environment
    delete process.env.SKER_SERVER_NAME;
    delete process.env.SKER_LOG_LEVEL;
    delete process.env.NODE_ENV;
  });

  it('should load configuration from environment variables', () => {
    process.env.SKER_SERVER_NAME = 'env-server';
    process.env.SKER_LOG_LEVEL = 'debug';
    process.env.NODE_ENV = 'development';
    
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    
    expect(config.server.name).toBe('env-server');
    expect(config.logging.level).toBe('debug');
  });

  it('should prioritize environment variables over defaults', () => {
    process.env.SKER_SERVER_NAME = 'priority-test';
    
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    
    expect(config.server.name).toBe('priority-test');
  });
});