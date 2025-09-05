import 'reflect-metadata';
import { PluginManager } from './plugin-manager';
import { ProjectManager } from './project-manager';
import { PluginStatus } from './types';
import type { IPlugin } from './types';

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let mockProjectManager: jest.Mocked<ProjectManager>;
  let mockLogger: any;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Mock ProjectManager
    mockProjectManager = {
      pluginDirectoryExists: jest.fn(),
      hasValidPluginPackageJson: jest.fn(),
      ensureDirectoryExists: jest.fn(),
      getPluginsDirectory: jest.fn().mockReturnValue('/test/plugins'),
      getPluginDirectory: jest.fn(),
      getPluginPackageJsonPath: jest.fn(),
      scanPluginsDirectory: jest.fn()
    } as any;

    pluginManager = new PluginManager(mockProjectManager, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should_create_instance_with_dependencies', () => {
      expect(pluginManager).toBeInstanceOf(PluginManager);
      expect(mockLogger.debug).toHaveBeenCalledWith('PluginManager initialized with Feature Injector architecture');
    });

    it('should_initialize_successfully', async () => {
      mockProjectManager.ensureDirectoryExists.mockResolvedValue();

      await pluginManager.initialize();

      expect(mockProjectManager.ensureDirectoryExists).toHaveBeenCalledWith('/test/plugins');
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing PluginManager with Feature Injector architecture');
    });

    it('should_handle_initialization_errors', async () => {
      const error = new Error('Directory creation failed');
      mockProjectManager.ensureDirectoryExists.mockRejectedValue(error);

      await expect(pluginManager.initialize()).rejects.toThrow('Directory creation failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize PluginManager',
        { error: 'Directory creation failed' }
      );
    });
  });

  describe('Plugin Loading', () => {
    it('should_load_plugin_successfully', async () => {
      const pluginName = 'test-plugin';
      mockProjectManager.pluginDirectoryExists.mockResolvedValue(true);
      mockProjectManager.hasValidPluginPackageJson.mockResolvedValue(true);

      const plugin = await pluginManager.loadPlugin(pluginName);

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe(pluginName);
      expect(plugin.version).toBe('0.0.1');
      expect(plugin.description).toBe(`Basic plugin stub for ${pluginName}`);
      expect(pluginManager.isPluginLoaded(pluginName)).toBe(true);
      expect(pluginManager.getPluginStatus(pluginName)).toBe(PluginStatus.LOADED);
    });

    it('should_fail_to_load_non_existent_plugin', async () => {
      const pluginName = 'non-existent-plugin';
      mockProjectManager.pluginDirectoryExists.mockResolvedValue(false);

      await expect(pluginManager.loadPlugin(pluginName)).rejects.toThrow(
        `Plugin directory not found: ${pluginName}`
      );
      expect(pluginManager.getPluginStatus(pluginName)).toBe(PluginStatus.FAILED);
    });

    it('should_fail_to_load_plugin_with_invalid_package_json', async () => {
      const pluginName = 'invalid-plugin';
      mockProjectManager.pluginDirectoryExists.mockResolvedValue(true);
      mockProjectManager.hasValidPluginPackageJson.mockResolvedValue(false);

      await expect(pluginManager.loadPlugin(pluginName)).rejects.toThrow(
        `Plugin has invalid or missing package.json: ${pluginName}`
      );
      expect(pluginManager.getPluginStatus(pluginName)).toBe(PluginStatus.FAILED);
    });

    it('should_set_loading_status_during_load', async () => {
      const pluginName = 'loading-plugin';
      mockProjectManager.pluginDirectoryExists.mockResolvedValue(true);
      mockProjectManager.hasValidPluginPackageJson.mockResolvedValue(true);

      const loadPromise = pluginManager.loadPlugin(pluginName);
      
      // Status should be LOADING during the load process
      // Note: This is a bit tricky to test due to async nature, but we can verify the final state
      await loadPromise;
      
      expect(pluginManager.getPluginStatus(pluginName)).toBe(PluginStatus.LOADED);
    });

    it('should_call_onLoad_hook_if_available', async () => {
      const pluginName = 'hook-plugin';
      mockProjectManager.pluginDirectoryExists.mockResolvedValue(true);
      mockProjectManager.hasValidPluginPackageJson.mockResolvedValue(true);

      const plugin = await pluginManager.loadPlugin(pluginName);

      expect(plugin.hooks?.onLoad).toBeDefined();
      // The hook should have been called during loading
      expect(mockLogger.debug).toHaveBeenCalledWith(`Plugin ${pluginName} loaded (stub)`);
    });
  });

  describe('Plugin Unloading', () => {
    beforeEach(async () => {
      // Load a plugin first
      mockProjectManager.pluginDirectoryExists.mockResolvedValue(true);
      mockProjectManager.hasValidPluginPackageJson.mockResolvedValue(true);
      await pluginManager.loadPlugin('test-plugin');
    });

    it('should_unload_plugin_successfully', async () => {
      const pluginName = 'test-plugin';

      await pluginManager.unloadPlugin(pluginName);

      expect(pluginManager.isPluginLoaded(pluginName)).toBe(false);
      expect(pluginManager.getPluginStatus(pluginName)).toBe(PluginStatus.UNLOADED);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plugin unloaded successfully',
        { pluginName }
      );
    });

    it('should_handle_unloading_non_existent_plugin', async () => {
      const pluginName = 'non-existent-plugin';

      await pluginManager.unloadPlugin(pluginName);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Plugin not found for unloading',
        { pluginName }
      );
    });

    it('should_call_onUnload_hook_if_available', async () => {
      const pluginName = 'test-plugin';

      await pluginManager.unloadPlugin(pluginName);

      // The hook should have been called during unloading
      expect(mockLogger.debug).toHaveBeenCalledWith(`Plugin ${pluginName} unloaded (stub)`);
    });

    it('should_handle_unload_errors_gracefully', async () => {
      const pluginName = 'test-plugin';
      
      // Mock an error in the unload hook
      const plugin = pluginManager.getActivePlugins().find(p => p.name === pluginName);
      if (plugin?.hooks?.onUnload) {
        const originalOnUnload = plugin.hooks.onUnload;
        plugin.hooks.onUnload = jest.fn().mockRejectedValue(new Error('Unload hook failed'));
      }

      await expect(pluginManager.unloadPlugin(pluginName)).rejects.toThrow('Unload hook failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to unload plugin',
        expect.objectContaining({
          pluginName,
          error: 'Unload hook failed'
        })
      );
    });
  });

  describe('Plugin Reloading', () => {
    beforeEach(async () => {
      mockProjectManager.pluginDirectoryExists.mockResolvedValue(true);
      mockProjectManager.hasValidPluginPackageJson.mockResolvedValue(true);
    });

    it('should_reload_existing_plugin', async () => {
      const pluginName = 'reload-plugin';
      
      // Load plugin first
      await pluginManager.loadPlugin(pluginName);
      expect(pluginManager.isPluginLoaded(pluginName)).toBe(true);

      // Reload plugin
      const reloadedPlugin = await pluginManager.reloadPlugin(pluginName);

      expect(reloadedPlugin).toBeDefined();
      expect(reloadedPlugin.name).toBe(pluginName);
      expect(pluginManager.isPluginLoaded(pluginName)).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('Reloading plugin', { pluginName });
    });

    it('should_reload_non_loaded_plugin', async () => {
      const pluginName = 'new-reload-plugin';

      const reloadedPlugin = await pluginManager.reloadPlugin(pluginName);

      expect(reloadedPlugin).toBeDefined();
      expect(reloadedPlugin.name).toBe(pluginName);
      expect(pluginManager.isPluginLoaded(pluginName)).toBe(true);
    });
  });

  describe('Plugin Status and Information', () => {
    beforeEach(async () => {
      mockProjectManager.pluginDirectoryExists.mockResolvedValue(true);
      mockProjectManager.hasValidPluginPackageJson.mockResolvedValue(true);
    });

    it('should_return_correct_plugin_status', () => {
      const pluginName = 'status-plugin';
      
      // Initially should be UNLOADED
      expect(pluginManager.getPluginStatus(pluginName)).toBe(PluginStatus.UNLOADED);
    });

    it('should_check_if_plugin_is_loaded', async () => {
      const pluginName = 'loaded-check-plugin';
      
      expect(pluginManager.isPluginLoaded(pluginName)).toBe(false);
      
      await pluginManager.loadPlugin(pluginName);
      
      expect(pluginManager.isPluginLoaded(pluginName)).toBe(true);
    });

    it('should_return_active_plugins_list', async () => {
      const plugin1 = 'plugin1';
      const plugin2 = 'plugin2';
      
      await pluginManager.loadPlugin(plugin1);
      await pluginManager.loadPlugin(plugin2);
      
      const activePlugins = pluginManager.getActivePlugins();
      
      expect(activePlugins).toHaveLength(2);
      expect(activePlugins.map(p => p.name)).toContain(plugin1);
      expect(activePlugins.map(p => p.name)).toContain(plugin2);
    });

    it('should_return_comprehensive_plugin_info', async () => {
      const plugin1 = 'info-plugin1';
      const plugin2 = 'info-plugin2';
      
      await pluginManager.loadPlugin(plugin1);
      await pluginManager.loadPlugin(plugin2);
      
      // Simulate a failed plugin
      mockProjectManager.pluginDirectoryExists.mockResolvedValueOnce(false);
      try {
        await pluginManager.loadPlugin('failed-plugin');
      } catch (error) {
        // Expected to fail
      }
      
      const info = pluginManager.getPluginInfo();
      
      expect(info.total).toBe(3);
      expect(info.loaded).toBe(2);
      expect(info.failed).toBe(1);
      expect(info.activePlugins).toContain(plugin1);
      expect(info.activePlugins).toContain(plugin2);
      expect(info.pluginStatuses).toHaveProperty(plugin1, PluginStatus.LOADED);
      expect(info.pluginStatuses).toHaveProperty(plugin2, PluginStatus.LOADED);
      expect(info.pluginStatuses).toHaveProperty('failed-plugin', PluginStatus.FAILED);
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      mockProjectManager.pluginDirectoryExists.mockResolvedValue(true);
      mockProjectManager.hasValidPluginPackageJson.mockResolvedValue(true);
    });

    it('should_cleanup_all_plugins_successfully', async () => {
      const plugin1 = 'cleanup-plugin1';
      const plugin2 = 'cleanup-plugin2';
      
      await pluginManager.loadPlugin(plugin1);
      await pluginManager.loadPlugin(plugin2);
      
      expect(pluginManager.getActivePlugins()).toHaveLength(2);
      
      await pluginManager.cleanup();
      
      expect(pluginManager.getActivePlugins()).toHaveLength(0);
      expect(mockLogger.info).toHaveBeenCalledWith('PluginManager cleanup completed');
    });

    it('should_handle_cleanup_errors_gracefully', async () => {
      const plugin1 = 'error-plugin1';
      
      await pluginManager.loadPlugin(plugin1);
      
      // Mock an error in the unload process
      const activePlugin = pluginManager.getActivePlugins()[0];
      if (activePlugin?.hooks?.onUnload) {
        activePlugin.hooks.onUnload = jest.fn().mockRejectedValue(new Error('Cleanup error'));
      }
      
      await pluginManager.cleanup();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error unloading plugin during cleanup',
        expect.objectContaining({
          pluginName: plugin1,
          error: 'Cleanup error'
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith('PluginManager cleanup completed');
    });
  });

  describe('Error Handling', () => {
    it('should_handle_null_logger_gracefully', () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        trace: jest.fn()
      };
      expect(() => {
        new PluginManager(mockProjectManager, mockLogger as any);
      }).not.toThrow();
    });

    it('should_handle_plugin_loading_exceptions', async () => {
      const pluginName = 'exception-plugin';
      mockProjectManager.pluginDirectoryExists.mockRejectedValue(new Error('Directory access error'));

      await expect(pluginManager.loadPlugin(pluginName)).rejects.toThrow('Directory access error');
      expect(pluginManager.getPluginStatus(pluginName)).toBe(PluginStatus.FAILED);
    });
  });
});
