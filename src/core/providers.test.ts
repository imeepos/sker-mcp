describe('Provider Configuration Factory', () => {
  describe('createMcpProviders', () => {
    it('should_return_array_of_providers', async () => {
      const { createMcpProviders } = await import('../../src/core/providers');
      
      const providers = createMcpProviders();
      
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should_include_MCP_SERVER_CONFIG_provider', async () => {
      const { createMcpProviders } = await import('../../src/core/providers');
      const { MCP_SERVER_CONFIG } = await import('../../src/core/tokens');
      
      const providers = createMcpProviders();
      const configProvider = providers.find(p => p.provide === MCP_SERVER_CONFIG);
      
      expect(configProvider).toBeDefined();
      expect((configProvider as any)?.useValue).toBeDefined();
    });

    it('should_include_MCP_TOOLS_provider_with_multi_true', async () => {
      const { createMcpProviders } = await import('../../src/core/providers');
      const { MCP_TOOLS } = await import('../../src/core/tokens');
      
      const providers = createMcpProviders();
      const toolsProvider = providers.find(p => p.provide === MCP_TOOLS);
      
      expect(toolsProvider).toBeDefined();
      expect((toolsProvider as any)?.useValue).toEqual([]);
      expect(toolsProvider?.multi).toBe(true);
    });

    it('should_include_MCP_RESOURCES_provider_with_multi_true', async () => {
      const { createMcpProviders } = await import('../../src/core/providers');
      const { MCP_RESOURCES } = await import('../../src/core/tokens');
      
      const providers = createMcpProviders();
      const resourcesProvider = providers.find(p => p.provide === MCP_RESOURCES);
      
      expect(resourcesProvider).toBeDefined();
      expect((resourcesProvider as any)?.useValue).toEqual([]);
      expect(resourcesProvider?.multi).toBe(true);
    });

    it('should_include_MCP_PROMPTS_provider_with_multi_true', async () => {
      const { createMcpProviders } = await import('../../src/core/providers');
      const { MCP_PROMPTS } = await import('../../src/core/tokens');
      
      const providers = createMcpProviders();
      const promptsProvider = providers.find(p => p.provide === MCP_PROMPTS);
      
      expect(promptsProvider).toBeDefined();
      expect((promptsProvider as any)?.useValue).toEqual([]);
      expect(promptsProvider?.multi).toBe(true);
    });
  });

  describe('createPlatformProviders', () => {
    it('should_return_array_of_providers', async () => {
      const { createPlatformProviders } = await import('../../src/core/providers');
      
      const providers = createPlatformProviders();
      
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should_include_APP_NAME_provider', async () => {
      const { createPlatformProviders } = await import('../../src/core/providers');
      const { APP_NAME } = await import('../../src/core/tokens');
      
      const providers = createPlatformProviders();
      const appNameProvider = providers.find(p => p.provide === APP_NAME);
      
      expect(appNameProvider).toBeDefined();
      expect(typeof (appNameProvider as any)?.useValue).toBe('string');
      expect((appNameProvider as any)?.useValue).toContain('sker');
    });

    it('should_include_manager_providers', async () => {
      const { createPlatformProviders } = await import('../../src/core/providers');
      const { SERVICE_MANAGER, PROJECT_MANAGER, PLUGIN_MANAGER } = await import('../../src/core/tokens');
      
      const providers = createPlatformProviders();
      const managerTokens = [SERVICE_MANAGER, PROJECT_MANAGER, PLUGIN_MANAGER];
      
      managerTokens.forEach(token => {
        const provider = providers.find(p => p.provide === token);
        expect(provider).toBeDefined();
        expect((provider as any)?.useClass).toBeDefined();
      });
    });
  });

  describe('Provider Integration', () => {
    it('should_create_providers_that_work_with_dependency_injection', async () => {
      const { createMcpProviders, createPlatformProviders } = await import('../../src/core/providers');
      
      const mcpProviders = createMcpProviders();
      const platformProviders = createPlatformProviders();
      const allProviders = [...mcpProviders, ...platformProviders];
      
      // Test that providers have correct structure for @sker/di
      allProviders.forEach(provider => {
        expect(provider).toHaveProperty('provide');
        
        // Now providers can be InjectionToken objects, StringToken strings, or SymbolToken symbols
        const provideType = typeof provider.provide;
        const isValidTokenType = (
          provideType === 'symbol' ||
          provideType === 'string' || 
          (provideType === 'object' && provider.provide !== null && 'toString' in provider.provide)
        );
        expect(isValidTokenType).toBe(true);
        
        expect(
          provider.hasOwnProperty('useValue') || 
          provider.hasOwnProperty('useClass') || 
          provider.hasOwnProperty('useFactory')
        ).toBe(true);
      });
    });

    it('should_have_no_duplicate_providers', async () => {
      const { createMcpProviders, createPlatformProviders } = await import('../../src/core/providers');
      
      const mcpProviders = createMcpProviders();
      const platformProviders = createPlatformProviders();
      const allProviders = [...mcpProviders, ...platformProviders];
      
      const tokens = allProviders.map(p => p.provide);
      const uniqueTokens = new Set(tokens);
      
      expect(uniqueTokens.size).toBe(tokens.length);
    });
  });
});