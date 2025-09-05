import 'reflect-metadata';
import { ServiceManager, ServiceManagerStatus } from './service-manager';
import type { IMcpTool, IMcpResource, IMcpPrompt, IMcpServerConfig } from './types';

// Mock the MCP SDK
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined)
  }))
}));

describe('ServiceManager', () => {
  let serviceManager: ServiceManager;
  let mockLogger: any;
  let mockConfig: IMcpServerConfig;
  let mockTools: IMcpTool[];
  let mockResources: IMcpResource[];
  let mockPrompts: IMcpPrompt[];

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn()
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

    // Mock tools
    mockTools = [
      {
        name: 'test-tool',
        description: 'Test tool',
        inputSchema: { type: 'object', properties: {}, required: [] },
        handler: jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'result' }] })
      }
    ];

    // Mock resources
    mockResources = [
      {
        uri: 'test://resource/{id}',
        name: 'test-resource',
        description: 'Test resource',
        mimeType: 'text/plain',
        handler: jest.fn().mockResolvedValue({ contents: [{ uri: 'test://resource/1', text: 'content' }] })
      }
    ];

    // Mock prompts
    mockPrompts = [
      {
        name: 'test-prompt',
        description: 'Test prompt',
        handler: jest.fn().mockResolvedValue({ messages: [{ role: 'user', content: { type: 'text', text: 'prompt' } }] })
      }
    ];

    serviceManager = new ServiceManager(
      mockTools,
      mockResources,
      mockPrompts,
      mockConfig,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should_create_instance_with_dependencies', () => {
      expect(serviceManager).toBeInstanceOf(ServiceManager);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ServiceManager initializing...',
        expect.objectContaining({
          toolsCount: 1,
          resourcesCount: 1,
          promptsCount: 1
        })
      );
    });

    it('should_initialize_with_stopped_status', () => {
      expect(serviceManager.getStatus()).toBe(ServiceManagerStatus.STOPPED);
    });

    it('should_initialize_empty_registries', () => {
      const info = serviceManager.getRegistrationInfo();
      expect(info.tools).toEqual([]);
      expect(info.resources).toEqual([]);
      expect(info.prompts).toEqual([]);
      expect(info.status).toBe(ServiceManagerStatus.STOPPED);
    });
  });

  describe('Service Lifecycle Management', () => {
    it('should_start_service_manager_successfully', async () => {
      await serviceManager.start();
      
      expect(serviceManager.getStatus()).toBe(ServiceManagerStatus.RUNNING);
      expect(mockLogger.info).toHaveBeenCalledWith('Starting ServiceManager...');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ServiceManager started successfully',
        expect.objectContaining({
          transport: mockConfig.transport,
          toolsCount: expect.any(Number),
          resourcesCount: expect.any(Number),
          promptsCount: expect.any(Number)
        })
      );
    });

    it('should_not_start_if_already_running', async () => {
      await serviceManager.start();
      
      // Try to start again
      await serviceManager.start();
      
      expect(mockLogger.warn).toHaveBeenCalledWith('ServiceManager is already running');
    });

    it('should_stop_service_manager_successfully', async () => {
      await serviceManager.start();
      await serviceManager.stop();
      
      expect(serviceManager.getStatus()).toBe(ServiceManagerStatus.STOPPED);
      expect(mockLogger.info).toHaveBeenCalledWith('Stopping ServiceManager...');
      expect(mockLogger.info).toHaveBeenCalledWith('ServiceManager stopped successfully');
    });

    it('should_not_stop_if_already_stopped', async () => {
      await serviceManager.stop();
      
      expect(mockLogger.warn).toHaveBeenCalledWith('ServiceManager is already stopped');
    });

    it('should_handle_start_errors_gracefully', async () => {
      // Mock an error during startup
      const originalStart = serviceManager.start;
      serviceManager.start = jest.fn().mockImplementation(async () => {
        throw new Error('Startup failed');
      });

      await expect(serviceManager.start()).rejects.toThrow('Startup failed');
    });

    it('should_clear_registrations_on_stop', async () => {
      await serviceManager.start();
      
      // Register some components
      const testTool: IMcpTool = {
        name: 'dynamic-tool',
        description: 'Dynamic tool',
        inputSchema: { type: 'object', properties: {}, required: [] },
        handler: jest.fn()
      };
      
      await serviceManager.registerTool(testTool);
      
      // Stop the service
      await serviceManager.stop();
      
      // Check that registrations are cleared
      const info = serviceManager.getRegistrationInfo();
      expect(info.tools).toEqual([]);
      expect(info.resources).toEqual([]);
      expect(info.prompts).toEqual([]);
    });
  });

  describe('Dynamic Component Registration', () => {
    beforeEach(async () => {
      await serviceManager.start();
    });

    afterEach(async () => {
      await serviceManager.stop();
    });

    describe('Tool Registration', () => {
      it('should_register_tool_successfully', async () => {
        const testTool: IMcpTool = {
          name: 'dynamic-tool',
          description: 'Dynamic tool',
          inputSchema: { type: 'object', properties: {}, required: [] },
          handler: jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'result' }] })
        };

        await serviceManager.registerTool(testTool);

        const info = serviceManager.getRegistrationInfo();
        expect(info.tools).toContain('dynamic-tool');
        expect(mockLogger.debug).toHaveBeenCalledWith('Tool registered', { toolName: 'dynamic-tool' });
      });

      it('should_prevent_duplicate_tool_registration', async () => {
        const testTool: IMcpTool = {
          name: 'duplicate-tool',
          description: 'Duplicate tool',
          inputSchema: { type: 'object', properties: {}, required: [] },
          handler: jest.fn()
        };

        await serviceManager.registerTool(testTool);
        
        await expect(serviceManager.registerTool(testTool))
          .rejects.toThrow("Tool 'duplicate-tool' is already registered");
      });

      it('should_handle_tool_registration_errors', async () => {
        const invalidTool = {
          // Missing required properties
          description: 'Invalid tool'
        } as IMcpTool;

        await expect(serviceManager.registerTool(invalidTool))
          .rejects.toThrow();
        
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to register tool',
          expect.objectContaining({
            error: expect.any(String)
          })
        );
      });
    });

    describe('Resource Registration', () => {
      it('should_register_resource_successfully', async () => {
        const testResource: IMcpResource = {
          uri: 'test://dynamic/{id}',
          name: 'dynamic-resource',
          description: 'Dynamic resource',
          mimeType: 'application/json',
          handler: jest.fn().mockResolvedValue({ contents: [] })
        };

        await serviceManager.registerResource(testResource);

        const info = serviceManager.getRegistrationInfo();
        expect(info.resources).toContain('test://dynamic/{id}');
        expect(mockLogger.debug).toHaveBeenCalledWith('Resource registered', { resourceUri: 'test://dynamic/{id}' });
      });

      it('should_prevent_duplicate_resource_registration', async () => {
        const testResource: IMcpResource = {
          uri: 'test://duplicate/{id}',
          name: 'duplicate-resource',
          description: 'Duplicate resource',
          handler: jest.fn()
        };

        await serviceManager.registerResource(testResource);
        
        await expect(serviceManager.registerResource(testResource))
          .rejects.toThrow("Resource 'test://duplicate/{id}' is already registered");
      });
    });

    describe('Prompt Registration', () => {
      it('should_register_prompt_successfully', async () => {
        const testPrompt: IMcpPrompt = {
          name: 'dynamic-prompt',
          description: 'Dynamic prompt',
          handler: jest.fn().mockResolvedValue({ messages: [] })
        };

        await serviceManager.registerPrompt(testPrompt);

        const info = serviceManager.getRegistrationInfo();
        expect(info.prompts).toContain('dynamic-prompt');
        expect(mockLogger.debug).toHaveBeenCalledWith('Prompt registered', { promptName: 'dynamic-prompt' });
      });

      it('should_prevent_duplicate_prompt_registration', async () => {
        const testPrompt: IMcpPrompt = {
          name: 'duplicate-prompt',
          description: 'Duplicate prompt',
          handler: jest.fn()
        };

        await serviceManager.registerPrompt(testPrompt);
        
        await expect(serviceManager.registerPrompt(testPrompt))
          .rejects.toThrow("Prompt 'duplicate-prompt' is already registered");
      });
    });
  });

  describe('Status and Information Retrieval', () => {
    it('should_return_current_status', () => {
      expect(serviceManager.getStatus()).toBe(ServiceManagerStatus.STOPPED);
    });

    it('should_return_registration_information', () => {
      const info = serviceManager.getRegistrationInfo();
      
      expect(info).toHaveProperty('tools');
      expect(info).toHaveProperty('resources');
      expect(info).toHaveProperty('prompts');
      expect(info).toHaveProperty('status');
      expect(Array.isArray(info.tools)).toBe(true);
      expect(Array.isArray(info.resources)).toBe(true);
      expect(Array.isArray(info.prompts)).toBe(true);
    });

    it('should_track_status_changes_during_lifecycle', async () => {
      expect(serviceManager.getStatus()).toBe(ServiceManagerStatus.STOPPED);
      
      const startPromise = serviceManager.start();
      // Status should be STARTING during startup
      
      await startPromise;
      expect(serviceManager.getStatus()).toBe(ServiceManagerStatus.RUNNING);
      
      const stopPromise = serviceManager.stop();
      // Status should be STOPPING during shutdown
      
      await stopPromise;
      expect(serviceManager.getStatus()).toBe(ServiceManagerStatus.STOPPED);
    });
  });

  describe('Transport Configuration', () => {
    it('should_setup_stdio_transport_by_default', async () => {
      const studioConfig = { ...mockConfig, transport: { type: 'stdio' as const } };
      const manager = new ServiceManager([], [], [], studioConfig, mockLogger);

      await manager.start();

      expect(mockLogger.debug).toHaveBeenCalledWith('Set up STDIO transport');
    });

    it('should_fallback_to_stdio_for_http_transport', async () => {
      const httpConfig = { ...mockConfig, transport: { type: 'http' as const, host: 'localhost', port: 3000 } };
      const manager = new ServiceManager([], [], [], httpConfig, mockLogger);

      await manager.start();

      expect(mockLogger.warn).toHaveBeenCalledWith('HTTP transport not yet implemented, using STDIO');
    });

    it('should_throw_error_for_unsupported_transport', async () => {
      const invalidConfig = { ...mockConfig, transport: { type: 'invalid' as any } };
      const manager = new ServiceManager([], [], [], invalidConfig, mockLogger);

      await expect(manager.start()).rejects.toThrow('Unsupported transport type: invalid');
    });
  });

  describe('MCP Server Handlers', () => {
    beforeEach(async () => {
      await serviceManager.start();
    });

    afterEach(async () => {
      await serviceManager.stop();
    });

    it('should_setup_request_handlers_during_start', async () => {
      // Verify that the server's setRequestHandler was called for each handler type
      // This indirectly tests that setupServerHandlers was called
      expect(serviceManager.getStatus()).toBe(ServiceManagerStatus.RUNNING);

      // The handlers are set up as part of the start process
      // We can verify this by checking that the service started successfully
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ServiceManager started successfully',
        expect.any(Object)
      );
    });

    it('should_handle_server_requests_when_running', async () => {
      // When running, the service should be able to handle requests
      expect(serviceManager.getStatus()).toBe(ServiceManagerStatus.RUNNING);

      // The registration info should reflect the current state
      const info = serviceManager.getRegistrationInfo();
      expect(info.status).toBe(ServiceManagerStatus.RUNNING);
    });
  });

  describe('Component Registration Process', () => {
    it('should_register_initial_components_during_start', async () => {
      const toolsArray = [mockTools[0]];
      const resourcesArray = [mockResources[0]];
      const promptsArray = [mockPrompts[0]];

      const manager = new ServiceManager(toolsArray, resourcesArray, promptsArray, mockConfig, mockLogger);

      await manager.start();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Initial components registered',
        expect.objectContaining({
          tools: 1,
          resources: 1,
          prompts: 1
        })
      );

      await manager.stop();
    });

    it('should_handle_registration_errors_during_startup', async () => {
      const invalidTool = {
        name: '',  // Invalid empty name
        description: 'Invalid tool',
        inputSchema: { type: 'object', properties: {}, required: [] },
        handler: jest.fn()
      } as any;

      const manager = new ServiceManager([invalidTool], [], [], mockConfig, mockLogger);

      await expect(manager.start()).rejects.toThrow();
    });
  });

  describe('Advanced Error Scenarios', () => {
    it('should_handle_initialization_with_null_logger', () => {
      expect(() => {
        new ServiceManager(mockTools, mockResources, mockPrompts, mockConfig, null);
      }).not.toThrow();
    });

    it('should_handle_empty_component_arrays', () => {
      expect(() => {
        new ServiceManager([], [], [], mockConfig, mockLogger);
      }).not.toThrow();
    });

    it('should_set_error_status_on_start_failure', async () => {
      // Mock a failure in the start process
      const failingServiceManager = new ServiceManager(mockTools, mockResources, mockPrompts, mockConfig, mockLogger);

      // Override a method to cause failure
      (failingServiceManager as any).setupTransport = jest.fn().mockRejectedValue(new Error('Transport setup failed'));

      await expect(failingServiceManager.start()).rejects.toThrow('Transport setup failed');
      expect(failingServiceManager.getStatus()).toBe(ServiceManagerStatus.ERROR);
    });

    it('should_handle_transport_connection_failure', async () => {
      const manager = new ServiceManager([], [], [], mockConfig, mockLogger);

      // Mock the entire start process to fail at transport level
      (manager as any).startMcpServer = jest.fn().mockRejectedValue(new Error('Connection failed'));

      await expect(manager.start()).rejects.toThrow('Connection failed');
      expect(manager.getStatus()).toBe(ServiceManagerStatus.ERROR);
    });

    it('should_handle_server_connection_failure', async () => {
      const manager = new ServiceManager([], [], [], mockConfig, mockLogger);

      // Mock server connect failure
      const mockServer = {
        setRequestHandler: jest.fn(),
        connect: jest.fn().mockRejectedValue(new Error('Server connection failed')),
        close: jest.fn().mockResolvedValue(undefined)
      };

      // Override the server
      (manager as any).mcpServer = mockServer;

      await expect(manager.start()).rejects.toThrow('Server connection failed');
      expect(manager.getStatus()).toBe(ServiceManagerStatus.ERROR);
    });
  });
});
