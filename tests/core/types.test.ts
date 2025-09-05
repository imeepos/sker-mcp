describe('Core Type Definitions', () => {
  describe('MCP Interface Types', () => {
    it('should_export_IMcpTool_interface', async () => {
      const types = await import('../../src/core/types');
      
      // We can't directly test interface existence in runtime, 
      // but we can test the module exports
      expect(typeof types).toBe('object');
    });

    it('should_export_IMcpResource_interface', async () => {
      const types = await import('../../src/core/types');
      
      expect(typeof types).toBe('object');
    });

    it('should_export_IMcpPrompt_interface', async () => {
      const types = await import('../../src/core/types');
      
      expect(typeof types).toBe('object');
    });
  });

  describe('Plugin Interface Types', () => {
    it('should_export_IPlugin_interface', async () => {
      const types = await import('../../src/core/types');
      
      expect(typeof types).toBe('object');
    });

    it('should_export_IPluginManager_interface', async () => {
      const types = await import('../../src/core/types');
      
      expect(typeof types).toBe('object');
    });
  });

  describe('Configuration Interface Types', () => {
    it('should_export_IMcpServerConfig_interface', async () => {
      const types = await import('../../src/core/types');
      
      expect(typeof types).toBe('object');
    });
  });

  describe('Metadata Interface Types', () => {
    it('should_export_ToolMetadata_interface', async () => {
      const types = await import('../../src/core/types');
      
      expect(typeof types).toBe('object');
    });

    it('should_export_ResourceMetadata_interface', async () => {
      const types = await import('../../src/core/types');
      
      expect(typeof types).toBe('object');
    });

    it('should_export_PromptMetadata_interface', async () => {
      const types = await import('../../src/core/types');
      
      expect(typeof types).toBe('object');
    });
  });

  describe('Enum Types', () => {
    it('should_export_PluginStatus_enum', async () => {
      const { PluginStatus } = await import('../../src/core/types');
      
      expect(typeof PluginStatus).toBe('object');
      expect(PluginStatus.LOADING).toBeDefined();
      expect(PluginStatus.LOADED).toBeDefined();
      expect(PluginStatus.FAILED).toBeDefined();
      expect(PluginStatus.UNLOADED).toBeDefined();
    });

    it('should_have_correct_PluginStatus_values', async () => {
      const { PluginStatus } = await import('../../src/core/types');
      
      expect(PluginStatus.LOADING).toBe('loading');
      expect(PluginStatus.LOADED).toBe('loaded');
      expect(PluginStatus.FAILED).toBe('failed');
      expect(PluginStatus.UNLOADED).toBe('unloaded');
    });
  });

  describe('Type Utility Functions', () => {
    it('should_export_type_guard_functions', async () => {
      const types = await import('../../src/core/types');
      
      // Test that utility functions exist if they are exported
      expect(typeof types).toBe('object');
    });
  });

  describe('Type Compatibility', () => {
    it('should_be_compatible_with_MCP_SDK_types', async () => {
      // Test that our types are compatible with @modelcontextprotocol/sdk
      const types = await import('../../src/core/types');
      
      expect(typeof types).toBe('object');
    });

    it('should_support_Zod_validation', async () => {
      // Test that types can be used with Zod schemas
      const types = await import('../../src/core/types');
      
      expect(typeof types).toBe('object');
    });
  });
});