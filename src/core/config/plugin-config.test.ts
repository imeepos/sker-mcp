/**
 * Plugin Configuration Tests
 * 
 * This module provides tests for plugin-specific configuration management,
 * including plugin configuration isolation, validation, and file operations.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  PluginConfigManager, 
  PluginConfigUtils, 
  PluginIsolationLevel 
} from './plugin-config.js';
import { ConfigManager } from './config-manager.js';
import fs from 'fs';

// Mock file system operations
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('PluginConfigManager', () => {
  let configManager: ConfigManager;
  let pluginConfigManager: PluginConfigManager;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock file system defaults
    mockFs.existsSync.mockReturnValue(false);
    mockFs.promises.readdir.mockResolvedValue([]);
    mockFs.promises.readFile.mockResolvedValue('{}');
    mockFs.promises.writeFile.mockResolvedValue(void 0);
    
    // Create fresh instances
    configManager = new ConfigManager();
    pluginConfigManager = new PluginConfigManager(configManager);
  });

  afterEach(() => {
    if (pluginConfigManager) {
      pluginConfigManager.removeAllListeners();
    }
  });

  describe('Initialization', () => {
    it('should initialize with config manager', () => {
      expect(pluginConfigManager).toBeInstanceOf(PluginConfigManager);
    });

    it('should handle config manager changes', () => {
      const mockHandler = jest.fn();
      pluginConfigManager.on('pluginConfigChanged', mockHandler);
      
      // Simulate main config change
      configManager.updateConfig({
        plugins: {
          plugins: {
            'test-plugin': { enabled: true }
          }
        }
      });
      
      // Plugin config manager should react to this change
      expect(() => pluginConfigManager.loadPluginConfig('test-plugin')).not.toThrow();
    });
  });

  describe('Plugin Schema Registration', () => {
    it('should register plugin schema', () => {
      const schema = {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' }
        }
      };
      const defaults = { enabled: true };
      
      pluginConfigManager.registerPluginSchema('test-plugin', schema, defaults);
      
      const config = pluginConfigManager.getPluginConfig('test-plugin');
      expect(config).toEqual(defaults);
    });
  });

  describe('Plugin Configuration Management', () => {
    beforeEach(() => {
      pluginConfigManager.registerPluginSchema('test-plugin', {}, { enabled: false, setting: 'default' });
    });

    it('should get plugin configuration', () => {
      const config = pluginConfigManager.getPluginConfig('test-plugin');
      expect(config.enabled).toBe(false);
      expect(config.setting).toBe('default');
    });

    it('should set plugin configuration', () => {
      const newConfig = { enabled: true, setting: 'updated' };
      
      pluginConfigManager.setPluginConfig('test-plugin', newConfig);
      
      const config = pluginConfigManager.getPluginConfig('test-plugin');
      expect(config.enabled).toBe(true);
      expect(config.setting).toBe('updated');
    });

    it('should emit configuration change events', () => {
      const mockHandler = jest.fn();
      pluginConfigManager.on('pluginConfigChanged', mockHandler);
      
      const newConfig = { enabled: true };
      pluginConfigManager.setPluginConfig('test-plugin', newConfig);
      
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginName: 'test-plugin',
          current: newConfig,
          source: 'runtime'
        })
      );
    });

    it('should track configuration metadata', () => {
      const config = { enabled: true };
      pluginConfigManager.setPluginConfig('test-plugin', config, 'file');
      
      const meta = pluginConfigManager.getPluginConfigMeta('test-plugin');
      expect(meta?.name).toBe('test-plugin');
      expect(meta?.version).toBe('1.0.0');
    });
  });

  describe('Plugin Isolation Management', () => {
    it('should get default isolation level', () => {
      const level = pluginConfigManager.getPluginIsolationLevel('unknown-plugin');
      expect(level).toBe(PluginIsolationLevel.SERVICE); // Default from main config
    });

    it('should set plugin-specific isolation level', () => {
      pluginConfigManager.setPluginIsolationLevel('test-plugin', PluginIsolationLevel.FULL);
      
      const level = pluginConfigManager.getPluginIsolationLevel('test-plugin');
      expect(level).toBe(PluginIsolationLevel.FULL);
    });
  });

  describe('File Operations', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
    });

    it('should load plugin configuration from file', async () => {
      const configData = {
        meta: { name: 'test-plugin', version: '1.0.0' },
        config: { enabled: true, fromFile: true }
      };
      
      mockFs.promises.readFile.mockResolvedValue(JSON.stringify(configData));
      
      await pluginConfigManager.loadPluginConfigFromFile('test-plugin', '/test/config.json');
      
      const config = pluginConfigManager.getPluginConfig('test-plugin');
      expect(config.enabled).toBe(true);
      expect(config.fromFile).toBe(true);
    });

    it('should save plugin configuration to file', async () => {
      pluginConfigManager.setPluginConfig('test-plugin', { enabled: true });
      
      await pluginConfigManager.savePluginConfigToFile('test-plugin', '/test/config.json');
      
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        '/test/config.json',
        expect.stringContaining('"enabled": true'),
        'utf8'
      );
    });

    it('should handle file loading errors', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      await expect(
        pluginConfigManager.loadPluginConfigFromFile('test-plugin', '/nonexistent.json')
      ).rejects.toThrow('Plugin configuration file not found');
    });

    it('should handle missing plugin configuration for save', async () => {
      await expect(
        pluginConfigManager.savePluginConfigToFile('nonexistent-plugin', '/test/config.json')
      ).rejects.toThrow('No configuration found for plugin: nonexistent-plugin');
    });
  });

  describe('Configuration Discovery', () => {
    it('should discover plugin configuration files', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.readdir.mockResolvedValue([
        'plugin1.config.json',
        'plugin2.config.yaml',
        'not-a-config.txt',
        'plugin3.config.yml'
      ]);
      
      const discovered = await pluginConfigManager.discoverPluginConfigs();
      
      expect(discovered.size).toBe(3);
      expect(discovered.has('plugin1')).toBe(true);
      expect(discovered.has('plugin2')).toBe(true);
      expect(discovered.has('plugin3')).toBe(true);
    });

    it('should load all discovered configurations', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.readdir.mockResolvedValue(['plugin1.config.json']);
      mockFs.promises.readFile.mockResolvedValue(JSON.stringify({
        config: { discovered: true }
      }));
      
      await pluginConfigManager.loadDiscoveredConfigs();
      
      const config = pluginConfigManager.getPluginConfig('plugin1');
      expect(config?.discovered).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate plugin configuration', () => {
      pluginConfigManager.registerPluginSchema('test-plugin', {}, { enabled: true });
      
      const isValid = pluginConfigManager.validatePluginConfig('test-plugin');
      expect(isValid).toBe(true);
    });

    it('should handle validation without schema', () => {
      pluginConfigManager.setPluginConfig('no-schema-plugin', { anything: 'goes' });
      
      const isValid = pluginConfigManager.validatePluginConfig('no-schema-plugin');
      expect(isValid).toBe(true); // No schema = assume valid
    });

    it('should get validation errors', () => {
      pluginConfigManager.setPluginConfig('test-plugin', { invalid: 'config' });
      
      const errors = pluginConfigManager.getPluginConfigErrors('test-plugin');
      expect(Array.isArray(errors)).toBe(true);
    });
  });

  describe('Configuration Reset and Removal', () => {
    beforeEach(() => {
      pluginConfigManager.registerPluginSchema('test-plugin', {}, { enabled: false });
      pluginConfigManager.setPluginConfig('test-plugin', { enabled: true, custom: 'setting' });
    });

    it('should reset plugin configuration to defaults', () => {
      pluginConfigManager.resetPluginConfig('test-plugin');
      
      const config = pluginConfigManager.getPluginConfig('test-plugin');
      expect(config.enabled).toBe(false);
      expect(config.custom).toBeUndefined();
    });

    it('should remove plugin configuration', () => {
      const mockHandler = jest.fn();
      pluginConfigManager.on('pluginConfigRemoved', mockHandler);
      
      pluginConfigManager.removePluginConfig('test-plugin');
      
      const config = pluginConfigManager.getPluginConfig('test-plugin');
      expect(config).toBeUndefined();
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({ pluginName: 'test-plugin' })
      );
    });
  });

  describe('Configuration Templates and Export', () => {
    it('should create plugin configuration template', () => {
      pluginConfigManager.registerPluginSchema('test-plugin', { schema: 'definition' }, { enabled: true });
      
      const template = pluginConfigManager.createPluginConfigTemplate('test-plugin');
      
      expect(template.meta.name).toBe('test-plugin');
      expect(template.config.enabled).toBe(true);
      expect(template.schema).toBe('Schema available');
    });

    it('should export plugin configuration', () => {
      pluginConfigManager.setPluginConfig('test-plugin', { exported: true });
      
      const exported = pluginConfigManager.exportPluginConfig('test-plugin');
      
      expect(exported.config.exported).toBe(true);
      expect(exported.meta).toBeDefined();
      expect(exported.validation).toBeDefined();
      expect(exported.lastUpdate).toBeDefined();
    });

    it('should handle export of non-existent plugin', () => {
      expect(() => {
        pluginConfigManager.exportPluginConfig('non-existent');
      }).toThrow('No configuration found for plugin: non-existent');
    });
  });

  describe('All Configurations', () => {
    it('should get all plugin configurations', () => {
      pluginConfigManager.setPluginConfig('plugin1', { setting1: 'value1' });
      pluginConfigManager.setPluginConfig('plugin2', { setting2: 'value2' });
      
      const allConfigs = pluginConfigManager.getAllPluginConfigs();
      
      expect(allConfigs.size).toBe(2);
      expect(allConfigs.get('plugin1')?.config.setting1).toBe('value1');
      expect(allConfigs.get('plugin2')?.config.setting2).toBe('value2');
    });
  });
});

describe('PluginConfigUtils', () => {
  describe('Configuration Utilities', () => {
    it('should merge plugin configurations', () => {
      const config1 = { a: 1, b: { c: 2 } };
      const config2 = { b: { d: 3 }, e: 4 };
      
      const merged = PluginConfigUtils.mergePluginConfigs(config1, config2);
      
      expect(merged.a).toBe(1);
      expect(merged.b.c).toBe(2);
      expect(merged.b.d).toBe(3);
      expect(merged.e).toBe(4);
    });

    it('should clone plugin configuration', () => {
      const original = { nested: { deep: { value: 'test' } } };
      
      const cloned = PluginConfigUtils.clonePluginConfig(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.nested).not.toBe(original.nested);
    });
  });

  describe('Plugin Name Utilities', () => {
    it('should validate plugin names', () => {
      expect(PluginConfigUtils.validatePluginName('valid-plugin')).toBe(true);
      expect(PluginConfigUtils.validatePluginName('ValidPlugin123')).toBe(true);
      expect(PluginConfigUtils.validatePluginName('valid_plugin')).toBe(true);
      
      expect(PluginConfigUtils.validatePluginName('123invalid')).toBe(false);
      expect(PluginConfigUtils.validatePluginName('invalid.plugin')).toBe(false);
      expect(PluginConfigUtils.validatePluginName('invalid plugin')).toBe(false);
    });

    it('should sanitize plugin names', () => {
      expect(PluginConfigUtils.sanitizePluginName('Invalid.Plugin Name')).toBe('invalid-plugin-name');
      expect(PluginConfigUtils.sanitizePluginName('123Plugin')).toBe('123plugin');
      expect(PluginConfigUtils.sanitizePluginName('plugin--with--dashes')).toBe('plugin-with-dashes');
      expect(PluginConfigUtils.sanitizePluginName('--leading-trailing--')).toBe('leading-trailing');
    });
  });

  describe('File Path Utilities', () => {
    it('should generate plugin configuration file name', () => {
      const fileName = PluginConfigUtils.getPluginConfigFileName('test-plugin');
      expect(fileName).toBe('test-plugin.config.json');
    });

    it('should generate sanitized file name', () => {
      const fileName = PluginConfigUtils.getPluginConfigFileName('Invalid Plugin Name');
      expect(fileName).toBe('invalid-plugin-name.config.json');
    });

    it('should get plugin configuration file path', () => {
      const filePath = PluginConfigUtils.getPluginConfigFilePath('test-plugin');
      expect(filePath).toContain('.sker');
      expect(filePath).toContain('config');
      expect(filePath).toContain('plugins');
      expect(filePath).toContain('test-plugin.config.json');
    });
  });
});

describe('Integration Tests', () => {
  let configManager: ConfigManager;
  let pluginConfigManager: PluginConfigManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    
    configManager = new ConfigManager();
    pluginConfigManager = new PluginConfigManager(configManager);
  });

  it('should integrate with main configuration system', () => {
    // Set up main configuration
    configManager.updateConfig({
      plugins: {
        plugins: {
          'integrated-plugin': { mainConfig: true }
        }
      }
    });
    
    // Register plugin schema
    pluginConfigManager.registerPluginSchema('integrated-plugin', {}, { defaultValue: 'test' });
    
    // Plugin should load configuration from main config
    const pluginConfig = pluginConfigManager.getPluginConfig('integrated-plugin');
    expect(pluginConfig.mainConfig).toBe(true);
    expect(pluginConfig.defaultValue).toBe('test');
  });

  it('should update main configuration when plugin configuration changes', () => {
    pluginConfigManager.setPluginConfig('new-plugin', { newSetting: 'value' });
    
    const mainConfig = configManager.getConfig();
    expect(mainConfig.plugins.plugins['new-plugin']).toEqual({ newSetting: 'value' });
  });
});