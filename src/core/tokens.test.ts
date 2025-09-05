describe('Core Injection Tokens', () => {
  describe('MCP Service Tokens', () => {
    it('should_export_typed_MCP_SERVER_CONFIG_token', async () => {
      const { MCP_SERVER_CONFIG } = await import('./tokens');
      expect(MCP_SERVER_CONFIG).toBeDefined();
      expect(String(MCP_SERVER_CONFIG)).toContain('MCP_SERVER_CONFIG');
      // Test that it has a factory function
      expect(MCP_SERVER_CONFIG.factory).toBeDefined();
      const defaultConfig = MCP_SERVER_CONFIG.factory!();
      expect(defaultConfig).toHaveProperty('name');
      expect(defaultConfig).toHaveProperty('version');
      expect(defaultConfig).toHaveProperty('transport');
    });

    it('should_export_typed_MCP_TOOLS_token', async () => {
      const { MCP_TOOLS } = await import('./tokens');
      expect(MCP_TOOLS).toBeDefined();
      expect(String(MCP_TOOLS)).toContain('MCP_TOOLS');
      expect(MCP_TOOLS.factory).toBeDefined();
      const defaultTools = MCP_TOOLS.factory!();
      expect(Array.isArray(defaultTools)).toBe(true);
    });

    it('should_export_typed_MCP_RESOURCES_token', async () => {
      const { MCP_RESOURCES } = await import('./tokens');
      expect(MCP_RESOURCES).toBeDefined();
      expect(String(MCP_RESOURCES)).toContain('MCP_RESOURCES');
      expect(MCP_RESOURCES.factory).toBeDefined();
      const defaultResources = MCP_RESOURCES.factory!();
      expect(Array.isArray(defaultResources)).toBe(true);
    });

    it('should_export_typed_MCP_PROMPTS_token', async () => {
      const { MCP_PROMPTS } = await import('./tokens');
      expect(MCP_PROMPTS).toBeDefined();
      expect(String(MCP_PROMPTS)).toContain('MCP_PROMPTS');
      expect(MCP_PROMPTS.factory).toBeDefined();
      const defaultPrompts = MCP_PROMPTS.factory!();
      expect(Array.isArray(defaultPrompts)).toBe(true);
    });
  });

  describe('Manager Tokens', () => {
    it('should_export_typed_SERVICE_MANAGER_token', async () => {
      const { SERVICE_MANAGER } = await import('./tokens');
      expect(SERVICE_MANAGER).toBeDefined();
      expect(String(SERVICE_MANAGER)).toContain('SERVICE_MANAGER');
    });

    it('should_export_typed_PROJECT_MANAGER_token', async () => {
      const { PROJECT_MANAGER } = await import('./tokens');
      expect(PROJECT_MANAGER).toBeDefined();
      expect(String(PROJECT_MANAGER)).toContain('PROJECT_MANAGER');
    });

    it('should_export_typed_PLUGIN_MANAGER_token', async () => {
      const { PLUGIN_MANAGER } = await import('./tokens');
      expect(PLUGIN_MANAGER).toBeDefined();
      expect(String(PLUGIN_MANAGER)).toContain('PLUGIN_MANAGER');
    });
  });

  describe('Logger Tokens', () => {
    it('should_export_typed_LOGGER_token', async () => {
      const { LOGGER } = await import('./tokens');
      expect(LOGGER).toBeDefined();
      expect(String(LOGGER)).toContain('LOGGER');
    });

    it('should_export_typed_LOGGER_CONFIG_token', async () => {
      const { LOGGER_CONFIG } = await import('./tokens');
      expect(LOGGER_CONFIG).toBeDefined();
      expect(String(LOGGER_CONFIG)).toContain('LOGGER_CONFIG');
      expect(LOGGER_CONFIG.factory).toBeDefined();
      const defaultConfig = LOGGER_CONFIG.factory!();
      expect(defaultConfig).toHaveProperty('level');
      expect(defaultConfig).toHaveProperty('format');
      expect(defaultConfig).toHaveProperty('transports');
    });

    it('should_export_typed_LOGGER_FACTORY_token', async () => {
      const { LOGGER_FACTORY } = await import('./tokens');
      expect(LOGGER_FACTORY).toBeDefined();
      expect(String(LOGGER_FACTORY)).toContain('LOGGER_FACTORY');
    });

    it('should_export_typed_APP_NAME_token', async () => {
      const { APP_NAME } = await import('./tokens');
      expect(APP_NAME).toBeDefined();
      expect(typeof APP_NAME).toBe('string');
      expect(APP_NAME).toBe('APP_NAME');
    });
  });

  describe('Token Uniqueness and Types', () => {
    it('should_ensure_all_tokens_are_unique', async () => {
      const tokens = await import('./tokens');
      const tokenValues = Object.values(tokens).filter(v => 
        typeof v === 'object' && v !== null && 'toString' in v ||
        typeof v === 'string' ||
        typeof v === 'symbol'
      );
      const tokenSet = new Set(tokenValues.map(t => String(t)));
      
      expect(tokenSet.size).toBe(tokenValues.length);
    });

    it('should_provide_type_safety_through_interfaces', async () => {
      // Interface types are not exported at runtime, but provide compile-time type safety
      // This test just verifies that the tokens exist and have the expected structure
      const { MCP_SERVER_CONFIG, MCP_TOOLS, LOGGER_CONFIG } = await import('./tokens');
      
      // Verify tokens exist and have expected properties
      expect(MCP_SERVER_CONFIG).toBeDefined();
      expect(MCP_TOOLS).toBeDefined();
      expect(LOGGER_CONFIG).toBeDefined();
      
      // Verify factory functions return correctly typed objects
      const serverConfig = MCP_SERVER_CONFIG.factory!();
      expect(serverConfig).toHaveProperty('name');
      expect(serverConfig).toHaveProperty('transport');
      expect(serverConfig.transport).toHaveProperty('type');
    });

    it('should_export_alternative_token_types', async () => {
      const { APP_VERSION, DEBUG_MODE } = await import('./tokens');
      
      // StringToken should be a string
      expect(typeof APP_VERSION).toBe('string');
      expect(APP_VERSION).toBe('APP_VERSION');
      
      // SymbolToken should be a symbol  
      expect(typeof DEBUG_MODE).toBe('symbol');
      expect(String(DEBUG_MODE)).toContain('DEBUG_MODE');
    });
  });

  describe('Type Safety Features', () => {
    it('should_provide_factory_functions_with_correct_types', async () => {
      const { MCP_SERVER_CONFIG, MCP_TOOLS, LOGGER_CONFIG } = await import('./tokens');
      
      // Test MCP_SERVER_CONFIG factory
      const serverConfig = MCP_SERVER_CONFIG.factory!();
      expect(serverConfig.name).toBe('sker-daemon-mcp');
      expect(serverConfig.transport.type).toBe('stdio');
      
      // Test MCP_TOOLS factory
      const tools = MCP_TOOLS.factory!();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(0);
      
      // Test LOGGER_CONFIG factory
      const loggerConfig = LOGGER_CONFIG.factory!();
      expect(loggerConfig.level).toBe('info');
      expect(loggerConfig.format).toBe('json');
      expect(loggerConfig.transports.console.enabled).toBe(true);
    });

    it('should_maintain_token_identity_across_imports', async () => {
      const tokens1 = await import('./tokens');
      const tokens2 = await import('./tokens');
      
      // Same token instances should be equal
      expect(tokens1.MCP_SERVER_CONFIG).toBe(tokens2.MCP_SERVER_CONFIG);
      expect(tokens1.MCP_TOOLS).toBe(tokens2.MCP_TOOLS);
      expect(tokens1.LOGGER_CONFIG).toBe(tokens2.LOGGER_CONFIG);
      expect(tokens1.APP_NAME).toBe(tokens2.APP_NAME);
      expect(tokens1.DEBUG_MODE).toBe(tokens2.DEBUG_MODE);
    });
  });
});