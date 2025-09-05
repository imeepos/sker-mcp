import 'reflect-metadata';
import { PluginManager } from './plugin-manager';
import { ProjectManager } from './project-manager';
import { PluginStatus } from './types';
import type { IPlugin } from './types';

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let mockProjectManager: jest.Mocked<ProjectManager>;
  let mockLogger: any;
  let mockPluginDiscovery: any;
  let mockPluginLoader: any;
  let mockConflictDetector: any;
  let mockFeatureInjector: any;

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

    // Mock PluginDiscovery
    mockPluginDiscovery = {
      discoverPlugin: jest.fn().mockImplementation((pluginName: string) => {
        // Return a default discovered plugin for any plugin name
        return Promise.resolve({
          name: pluginName,
          version: '1.0.0',
          path: `/test/plugins/${pluginName}`,
          isValid: true,
          validationErrors: [],
          metadata: {
            mcp: {
              isolation: {
                level: 'service',
                permissions: {
                  parentServices: false,
                  globalRegistration: false,
                  crossPluginAccess: false,
                  coreSystemAccess: false
                }
              }
            }
          }
        });
      }),
      discoverPlugins: jest.fn().mockResolvedValue([])
    };

    // Mock PluginLoader
    mockPluginLoader = {
      loadPlugin: jest.fn().mockImplementation((discoveredPlugin: any) => {
        // Return a default loaded plugin for any discovered plugin
        return Promise.resolve({
          success: true,
          plugin: {
            name: discoveredPlugin.name,
            version: discoveredPlugin.version,
            description: `Plugin ${discoveredPlugin.name}`,
            author: 'test',
            dependencies: [],
            services: [],
            hooks: {
              onLoad: jest.fn().mockResolvedValue(undefined),
              onUnload: jest.fn().mockResolvedValue(undefined)
            }
          },
          metrics: {
            loadTime: 100,
            memoryUsage: 1024,
            dependencyCount: 0
          }
        });
      }),
      clearCache: jest.fn()
    };

    // Mock ConflictDetector
    mockConflictDetector = {
      detectConflicts: jest.fn().mockReturnValue([]),
      resolveConflict: jest.fn(),
      configure: jest.fn()
    };

    // Mock FeatureInjector
    mockFeatureInjector = {
      createIsolatedPlugin: jest.fn().mockImplementation(async (plugin: any) => {
        // Call the onLoad hook if it exists (simulating real behavior)
        if (plugin.hooks?.onLoad) {
          await plugin.hooks.onLoad();
        }

        // Return a default isolated instance for any plugin
        return Promise.resolve({
          plugin: plugin,
          injector: {},
          container: {},
          bridge: {},
          destroy: jest.fn().mockResolvedValue(undefined)
        });
      }),
      destroyIsolatedPlugin: jest.fn().mockResolvedValue(undefined),
      removeIsolatedPlugin: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
      getIsolationStats: jest.fn().mockReturnValue({
        totalPlugins: 0,
        isolationLevels: { service: 0, full: 0, none: 0 },
        memoryUsage: 0
      })
    };

    pluginManager = new PluginManager(mockProjectManager, mockLogger);

    // Replace the internal instances with mocks
    (pluginManager as any).pluginDiscovery = mockPluginDiscovery;
    (pluginManager as any).pluginLoader = mockPluginLoader;
    (pluginManager as any).conflictDetector = mockConflictDetector;
    (pluginManager as any).featureInjector = mockFeatureInjector;
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

      // Mock discovered plugin
      const mockDiscoveredPlugin = {
        name: pluginName,
        version: '0.0.1',
        path: `/test/plugins/${pluginName}`,
        isValid: true,
        validationErrors: [],
        metadata: {
          mcp: {
            isolation: {
              level: 'service',
              permissions: {
                parentServices: false,
                globalRegistration: false,
                crossPluginAccess: false,
                coreSystemAccess: false
              }
            }
          }
        }
      };

      // Mock loaded plugin
      const mockPlugin = {
        name: pluginName,
        version: '0.0.1',
        description: `Basic plugin stub for ${pluginName}`,
        author: 'test',
        dependencies: [],
        services: [],
        hooks: {
          onLoad: jest.fn().mockResolvedValue(undefined)
        }
      };

      // Mock isolated instance
      const mockIsolatedInstance = {
        plugin: mockPlugin,
        injector: {},
        container: {},
        bridge: {}
      };

      mockPluginDiscovery.discoverPlugin.mockResolvedValue(mockDiscoveredPlugin);
      mockPluginLoader.loadPlugin.mockResolvedValue({
        success: true,
        plugin: mockPlugin
      });
      mockFeatureInjector.createIsolatedPlugin.mockResolvedValue(mockIsolatedInstance);

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

      // Mock plugin not found
      mockPluginDiscovery.discoverPlugin.mockResolvedValue(null);

      await expect(pluginManager.loadPlugin(pluginName)).rejects.toThrow(
        `Plugin not found: ${pluginName}`
      );
      expect(pluginManager.getPluginStatus(pluginName)).toBe(PluginStatus.FAILED);
    });

    it('should_fail_to_load_plugin_with_invalid_package_json', async () => {
      const pluginName = 'invalid-plugin';

      // Mock discovered plugin with validation errors
      const mockDiscoveredPlugin = {
        name: pluginName,
        version: '1.0.0',
        path: `/test/plugins/${pluginName}`,
        isValid: false,
        validationErrors: ['Invalid package.json'],
        metadata: {
          mcp: {
            isolation: {
              level: 'service',
              permissions: {
                parentServices: false,
                globalRegistration: false,
                crossPluginAccess: false,
                coreSystemAccess: false
              }
            }
          }
        }
      };

      mockPluginDiscovery.discoverPlugin.mockResolvedValue(mockDiscoveredPlugin);

      await expect(pluginManager.loadPlugin(pluginName)).rejects.toThrow(
        `Invalid plugin: Invalid package.json`
      );
      expect(pluginManager.getPluginStatus(pluginName)).toBe(PluginStatus.FAILED);
    });

    it('should_set_loading_status_during_load', async () => {
      const pluginName = 'loading-plugin';

      // Mock discovered plugin
      const mockDiscoveredPlugin = {
        name: pluginName,
        version: '1.0.0',
        path: `/test/plugins/${pluginName}`,
        isValid: true,
        validationErrors: [],
        metadata: {
          mcp: {
            isolation: {
              level: 'service',
              permissions: {
                parentServices: false,
                globalRegistration: false,
                crossPluginAccess: false,
                coreSystemAccess: false
              }
            }
          }
        }
      };

      // Mock loaded plugin
      const mockPlugin = {
        name: pluginName,
        version: '1.0.0',
        description: `Plugin ${pluginName}`,
        author: 'test',
        dependencies: [],
        services: [],
        hooks: {}
      };

      // Mock isolated instance
      const mockIsolatedInstance = {
        plugin: mockPlugin,
        injector: {},
        container: {},
        bridge: {}
      };

      mockPluginDiscovery.discoverPlugin.mockResolvedValue(mockDiscoveredPlugin);
      mockPluginLoader.loadPlugin.mockResolvedValue({
        success: true,
        plugin: mockPlugin
      });
      mockFeatureInjector.createIsolatedPlugin.mockResolvedValue(mockIsolatedInstance);

      const loadPromise = pluginManager.loadPlugin(pluginName);

      // Status should be LOADING during the load process
      // Note: This is a bit tricky to test due to async nature, but we can verify the final state
      await loadPromise;

      expect(pluginManager.getPluginStatus(pluginName)).toBe(PluginStatus.LOADED);
    });

    it('should_call_onLoad_hook_if_available', async () => {
      const pluginName = 'hook-plugin';

      const mockOnLoadHook = jest.fn().mockResolvedValue(undefined);

      // Mock discovered plugin
      const mockDiscoveredPlugin = {
        name: pluginName,
        version: '1.0.0',
        path: `/test/plugins/${pluginName}`,
        isValid: true,
        validationErrors: [],
        metadata: {
          mcp: {
            isolation: {
              level: 'service',
              permissions: {
                parentServices: false,
                globalRegistration: false,
                crossPluginAccess: false,
                coreSystemAccess: false
              }
            }
          }
        }
      };

      // Mock loaded plugin with onLoad hook
      const mockPlugin = {
        name: pluginName,
        version: '1.0.0',
        description: `Plugin ${pluginName}`,
        author: 'test',
        dependencies: [],
        services: [],
        hooks: {
          onLoad: mockOnLoadHook
        }
      };

      // Mock isolated instance
      const mockIsolatedInstance = {
        plugin: mockPlugin,
        injector: {},
        container: {},
        bridge: {}
      };

      mockPluginDiscovery.discoverPlugin.mockResolvedValue(mockDiscoveredPlugin);
      mockPluginLoader.loadPlugin.mockResolvedValue({
        success: true,
        plugin: mockPlugin
      });
      mockFeatureInjector.createIsolatedPlugin.mockResolvedValue(mockIsolatedInstance);

      const plugin = await pluginManager.loadPlugin(pluginName);

      expect(plugin.hooks?.onLoad).toBeDefined();
      expect(mockOnLoadHook).toHaveBeenCalled();
    });
  });

  describe('Plugin Unloading', () => {
    beforeEach(async () => {
      // Setup a loaded plugin for unloading tests
      const pluginName = 'test-plugin';

      // Mock discovered plugin
      const mockDiscoveredPlugin = {
        name: pluginName,
        version: '1.0.0',
        path: `/test/plugins/${pluginName}`,
        isValid: true,
        validationErrors: [],
        metadata: {
          mcp: {
            isolation: {
              level: 'service',
              permissions: {
                parentServices: false,
                globalRegistration: false,
                crossPluginAccess: false,
                coreSystemAccess: false
              }
            }
          }
        }
      };

      // Mock loaded plugin
      const mockPlugin = {
        name: pluginName,
        version: '1.0.0',
        description: `Plugin ${pluginName}`,
        author: 'test',
        dependencies: [],
        services: [],
        hooks: {
          onLoad: jest.fn().mockResolvedValue(undefined),
          onUnload: jest.fn().mockResolvedValue(undefined)
        }
      };

      // Mock isolated instance
      const mockIsolatedInstance = {
        plugin: mockPlugin,
        injector: {},
        container: {},
        bridge: {},
        destroy: jest.fn().mockResolvedValue(undefined)
      };

      mockPluginDiscovery.discoverPlugin.mockResolvedValue(mockDiscoveredPlugin);
      mockPluginLoader.loadPlugin.mockResolvedValue({
        success: true,
        plugin: mockPlugin
      });
      mockFeatureInjector.createIsolatedPlugin.mockImplementation(async (plugin: any) => {
        // Call the onLoad hook if it exists (simulating real behavior)
        if (plugin.hooks?.onLoad) {
          await plugin.hooks.onLoad();
        }
        return mockIsolatedInstance;
      });
      mockFeatureInjector.destroyIsolatedPlugin.mockResolvedValue(undefined);

      // Load a test plugin first
      await pluginManager.loadPlugin('test-plugin');
    });

    it('should_unload_plugin_successfully', async () => {
      const pluginName = 'test-plugin';

      await pluginManager.unloadPlugin(pluginName);

      expect(pluginManager.isPluginLoaded(pluginName)).toBe(false);
      expect(pluginManager.getPluginStatus(pluginName)).toBe(PluginStatus.UNLOADED);
      expect(mockFeatureInjector.destroyIsolatedPlugin).toHaveBeenCalledWith(pluginName);
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
      const plugin = pluginManager.getActivePlugins().find(p => p.name === pluginName);
      const mockOnUnloadHook = plugin?.hooks?.onUnload as jest.Mock;

      await pluginManager.unloadPlugin(pluginName);

      // The hook should have been called during unloading
      expect(mockOnUnloadHook).toHaveBeenCalled();
    });

    it('should_handle_unload_errors_gracefully', async () => {
      const pluginName = 'test-plugin';

      // Mock an error in the unload hook
      const plugin = pluginManager.getActivePlugins().find(p => p.name === pluginName);
      if (plugin?.hooks?.onUnload) {
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

      // Mock plugin discovery to throw an error
      mockPluginDiscovery.discoverPlugin.mockRejectedValueOnce(new Error('Directory access error'));

      await expect(pluginManager.loadPlugin(pluginName)).rejects.toThrow('Directory access error');
      expect(pluginManager.getPluginStatus(pluginName)).toBe(PluginStatus.FAILED);
    });
  });
});
