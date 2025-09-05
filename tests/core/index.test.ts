describe('Core Module Index', () => {
  it('should_export_all_core_components', async () => {
    const coreModule = await import('../../src/core');
    
    // Check that all expected exports are available
    expect(typeof coreModule.PluginStatus).toBe('object');
    expect(typeof coreModule.MCP_SERVER_CONFIG).toBe('object'); // Now InjectionToken object
    expect(typeof coreModule.createMcpProviders).toBe('function');
    expect(typeof coreModule.createPlatformProviders).toBe('function');
    expect(typeof coreModule.ProjectManager).toBe('function');
    expect(typeof coreModule.MetadataCollector).toBe('function');
    
    // Type interfaces are not available at runtime, but tokens are
    expect(coreModule.MCP_TOOLS).toBeDefined();
    expect(coreModule.MCP_RESOURCES).toBeDefined();
    expect(coreModule.MCP_PROMPTS).toBeDefined();
    
    // Check decorator exports
    expect(typeof coreModule.McpTool).toBe('function'); // This is the decorator function
    expect(typeof coreModule.McpResource).toBe('function'); // This is the decorator function
    expect(typeof coreModule.McpPrompt).toBe('function'); // This is the decorator function
  });

  it('should_allow_integrated_usage_of_all_components', async () => {
    const { 
      ProjectManager,
      MetadataCollector,
      McpTool, // This is the decorator function
      createMcpProviders,
      MCP_TOOLS
    } = await import('../../src/core');
    const { z } = await import('zod');
    
    // Test integrated usage
    const projectManager = new ProjectManager();
    expect(projectManager.getHomeDirectory()).toBeDefined();
    
    const metadataCollector = new MetadataCollector();
    
    // Create a test service with decorators
    class TestIntegratedService {
      @McpTool({
        name: 'integrated-tool',
        description: 'Integration test tool',
        inputSchema: z.object({ test: z.string() })
      })
      integratedTool() {
        return 'integrated';
      }
    }
    
    metadataCollector.registerService(TestIntegratedService);
    const metadata = metadataCollector.collectAllMetadata();
    
    expect(metadata.tools).toHaveLength(1);
    expect(metadata.tools[0]?.name).toBe('integrated-tool');
    
    // Test provider creation
    const providers = createMcpProviders();
    const toolsProvider = providers.find(p => p.provide === MCP_TOOLS);
    
    expect(toolsProvider).toBeDefined();
    expect(toolsProvider?.multi).toBe(true);
  });
});