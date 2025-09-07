import 'reflect-metadata';
import { McpApplication, ApplicationStatus, type IServiceManager } from './mcp-application';
import type { IPluginManager, IMcpServerConfig } from './types';

describe('McpApplication', () => {
  let mcpApplication: McpApplication;
  let mockProjectManager: any;
  let mockServiceManager: jest.Mocked<IServiceManager>;
  let mockPluginManager: jest.Mocked<IPluginManager>;
  let mockConfig: IMcpServerConfig;
  let mockLogger: any;

  beforeEach(() => {
    // Mock ProjectManager
    mockProjectManager = {
      createProjectStructure: jest.fn().mockResolvedValue(undefined),
      getHomeDirectory: jest.fn().mockReturnValue('/test/home'),
      getPluginsDirectory: jest.fn().mockReturnValue('/test/plugins'),
      scanPluginsDirectory: jest.fn().mockResolvedValue(['test-plugin'])
    };

    // Mock ServiceManager
    mockServiceManager = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      registerTool: jest.fn().mockResolvedValue(undefined),
      registerResource: jest.fn().mockResolvedValue(undefined),
      registerPrompt: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockReturnValue('stopped')
    };

    // Mock PluginManager
    mockPluginManager = {
      loadPlugin: jest.fn().mockResolvedValue({
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin'
      }),
      unloadPlugin: jest.fn().mockResolvedValue(undefined),
      reloadPlugin: jest.fn().mockResolvedValue({
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin'
      }),
      isPluginLoaded: jest.fn().mockReturnValue(false),
      getPluginStatus: jest.fn().mockReturnValue('unloaded'),
      getActivePlugins: jest.fn().mockReturnValue([])
    };

    // Mock configuration
    mockConfig = {
      name: 'test-mcp-server',
      version: '1.0.0',
      transport: { type: 'stdio' },
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    };

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    mcpApplication = new McpApplication(
      mockProjectManager,
      mockServiceManager as any,
      mockPluginManager as any,
      mockConfig,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should_create_instance_with_dependencies', () => {
      expect(mcpApplication).toBeInstanceOf(McpApplication);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'MCP 应用程序已初始化',
        { name: 'test-mcp-server', version: '1.0.0' }
      );
    });

    it('should_initialize_with_stopped_status', () => {
      expect(mcpApplication.getStatus()).toBe(ApplicationStatus.STOPPED);
    });

    it('should_handle_null_logger_gracefully', () => {
      expect(() => {
        new McpApplication(
          mockProjectManager,
          mockServiceManager as any,
          mockPluginManager as any,
          mockConfig,
          null
        );
      }).not.toThrow();
    });
  });

  describe('Application Lifecycle - Start', () => {
    it('should_start_application_successfully', async () => {
      await mcpApplication.start();

      expect(mcpApplication.getStatus()).toBe(ApplicationStatus.RUNNING);
      expect(mockProjectManager.createProjectStructure).toHaveBeenCalled();
      expect(mockProjectManager.scanPluginsDirectory).toHaveBeenCalled();
      expect(mockServiceManager.start).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'MCP 应用程序启动成功',
        expect.objectContaining({
          status: ApplicationStatus.RUNNING,
          transport: mockConfig.transport
        })
      );
    });

    it('should_not_start_if_already_running', async () => {
      await mcpApplication.start();
      
      // Reset mocks to check if methods are called again
      jest.clearAllMocks();
      
      await mcpApplication.start();
      
      expect(mockProjectManager.createProjectStructure).not.toHaveBeenCalled();
      expect(mockServiceManager.start).not.toHaveBeenCalled();
    });

    it('should_handle_concurrent_start_attempts', async () => {
      const startPromise1 = mcpApplication.start();
      const startPromise2 = mcpApplication.start();
      
      await Promise.all([startPromise1, startPromise2]);
      
      expect(mcpApplication.getStatus()).toBe(ApplicationStatus.RUNNING);
      // Should only call start sequence once
      expect(mockProjectManager.createProjectStructure).toHaveBeenCalledTimes(1);
    });

    it('should_handle_project_structure_creation_failure', async () => {
      const error = new Error('Failed to create project structure');
      mockProjectManager.createProjectStructure.mockRejectedValue(error);

      await expect(mcpApplication.start()).rejects.toThrow('Failed to create project structure');
      expect(mcpApplication.getStatus()).toBe(ApplicationStatus.ERROR);
      expect(mockLogger.error).toHaveBeenCalledWith(
        '启动 MCP 应用程序失败',
        expect.objectContaining({
          error: 'Failed to create project structure'
        })
      );
    });

    it('should_handle_plugin_initialization_failure', async () => {
      const error = new Error('Plugin initialization failed');
      mockProjectManager.scanPluginsDirectory.mockRejectedValue(error);

      await expect(mcpApplication.start()).rejects.toThrow('Plugin initialization failed');
      expect(mcpApplication.getStatus()).toBe(ApplicationStatus.ERROR);
    });

    it('should_handle_service_manager_start_failure', async () => {
      const error = new Error('Service manager start failed');
      mockServiceManager.start.mockRejectedValue(error);

      await expect(mcpApplication.start()).rejects.toThrow('Service manager start failed');
      expect(mcpApplication.getStatus()).toBe(ApplicationStatus.ERROR);
    });
  });

  describe('Application Lifecycle - Stop', () => {
    beforeEach(async () => {
      await mcpApplication.start();
    });

    it('should_stop_application_successfully', async () => {
      // Mock that there are active plugins to unload
      mockPluginManager.getActivePlugins.mockReturnValue([
        {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test plugin',
          services: []
        }
      ]);

      await mcpApplication.stop();

      expect(mcpApplication.getStatus()).toBe(ApplicationStatus.STOPPED);
      expect(mockServiceManager.stop).toHaveBeenCalled();
      expect(mockPluginManager.unloadPlugin).toHaveBeenCalledWith('test-plugin');
    });

    it('should_not_stop_if_already_stopped', async () => {
      await mcpApplication.stop();
      
      // Reset mocks
      jest.clearAllMocks();
      
      await mcpApplication.stop();
      
      expect(mockServiceManager.stop).not.toHaveBeenCalled();
    });

    it('should_handle_concurrent_stop_attempts', async () => {
      const stopPromise1 = mcpApplication.stop();
      const stopPromise2 = mcpApplication.stop();
      
      await Promise.all([stopPromise1, stopPromise2]);
      
      expect(mcpApplication.getStatus()).toBe(ApplicationStatus.STOPPED);
      expect(mockServiceManager.stop).toHaveBeenCalledTimes(1);
    });

    it('should_handle_service_manager_stop_failure', async () => {
      const error = new Error('Service manager stop failed');
      mockServiceManager.stop.mockRejectedValue(error);

      await expect(mcpApplication.stop()).rejects.toThrow('Service manager stop failed');
      expect(mcpApplication.getStatus()).toBe(ApplicationStatus.ERROR);
    });

    it('should_handle_plugin_cleanup_failure_gracefully', async () => {
      // Mock that there are active plugins to unload
      mockPluginManager.getActivePlugins.mockReturnValue([
        {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test plugin',
          services: []
        }
      ]);

      const error = new Error('Plugin cleanup failed');
      mockPluginManager.unloadPlugin.mockRejectedValue(error);

      // Should not throw - plugin errors are logged but don't fail the shutdown
      await expect(mcpApplication.stop()).resolves.not.toThrow();
      expect(mcpApplication.getStatus()).toBe(ApplicationStatus.STOPPED);
      expect(mockLogger.error).toHaveBeenCalledWith(
        '卸载插件失败',
        expect.objectContaining({
          plugin: 'test-plugin',
          error: 'Plugin cleanup failed'
        })
      );
    });
  });

  describe('Event System', () => {
    it('should_emit_events_during_startup', async () => {
      const eventListener = jest.fn();
      mcpApplication.addEventListener(eventListener);

      await mcpApplication.start();

      expect(eventListener).toHaveBeenCalledWith('starting', undefined);
      expect(eventListener).toHaveBeenCalledWith('started', undefined);
    });

    it('should_emit_events_during_shutdown', async () => {
      await mcpApplication.start();
      
      const eventListener = jest.fn();
      mcpApplication.addEventListener(eventListener);

      await mcpApplication.stop();

      expect(eventListener).toHaveBeenCalledWith('stopping', undefined);
      expect(eventListener).toHaveBeenCalledWith('stopped', undefined);
    });

    it('should_emit_error_events_on_failure', async () => {
      const eventListener = jest.fn();
      mcpApplication.addEventListener(eventListener);
      
      const error = new Error('Test error');
      mockServiceManager.start.mockRejectedValue(error);

      await expect(mcpApplication.start()).rejects.toThrow('Test error');

      expect(eventListener).toHaveBeenCalledWith('starting', undefined);
      expect(eventListener).toHaveBeenCalledWith('error', error);
    });

    it('should_remove_event_listeners', async () => {
      const eventListener = jest.fn();
      mcpApplication.addEventListener(eventListener);
      mcpApplication.removeEventListener(eventListener);

      await mcpApplication.start();

      expect(eventListener).not.toHaveBeenCalled();
    });

    it('should_handle_multiple_event_listeners', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      mcpApplication.addEventListener(listener1);
      mcpApplication.addEventListener(listener2);

      await mcpApplication.start();

      expect(listener1).toHaveBeenCalledWith('starting', undefined);
      expect(listener1).toHaveBeenCalledWith('started', undefined);
      expect(listener2).toHaveBeenCalledWith('starting', undefined);
      expect(listener2).toHaveBeenCalledWith('started', undefined);
    });
  });

  describe('Status Management', () => {
    it('should_return_current_status', () => {
      expect(mcpApplication.getStatus()).toBe(ApplicationStatus.STOPPED);
    });

    it('should_track_status_changes_during_lifecycle', async () => {
      expect(mcpApplication.getStatus()).toBe(ApplicationStatus.STOPPED);
      
      const startPromise = mcpApplication.start();
      // Note: Status changes happen quickly, so we test final state
      
      await startPromise;
      expect(mcpApplication.getStatus()).toBe(ApplicationStatus.RUNNING);
      
      await mcpApplication.stop();
      expect(mcpApplication.getStatus()).toBe(ApplicationStatus.STOPPED);
    });

    it('should_set_error_status_on_failure', async () => {
      mockServiceManager.start.mockRejectedValue(new Error('Test error'));

      await expect(mcpApplication.start()).rejects.toThrow('Test error');
      expect(mcpApplication.getStatus()).toBe(ApplicationStatus.ERROR);
    });
  });
});
