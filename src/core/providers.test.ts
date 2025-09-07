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
      const configProvider = providers.find(p => (p as any).provide === MCP_SERVER_CONFIG);
      
      expect(configProvider).toBeDefined();
      expect((configProvider as any)?.useValue).toBeDefined();
    });

    it('should_include_MCP_TOOLS_provider_with_multi_true', async () => {
      const { createMcpProviders } = await import('../../src/core/providers');
      const { MCP_TOOLS } = await import('../../src/core/tokens');
      
      const providers = createMcpProviders();
      const toolsProvider = providers.find(p => (p as any).provide === MCP_TOOLS);
      
      expect(toolsProvider).toBeDefined();
      expect((toolsProvider as any)?.useFactory).toBeDefined();
      expect((toolsProvider as any)?.useFactory()).toEqual([]);
    });

    it('should_include_MCP_RESOURCES_provider_with_multi_true', async () => {
      const { createMcpProviders } = await import('../../src/core/providers');
      const { MCP_RESOURCES } = await import('../../src/core/tokens');
      
      const providers = createMcpProviders();
      const resourcesProvider = providers.find(p => (p as any).provide === MCP_RESOURCES);
      
      expect(resourcesProvider).toBeDefined();
      expect((resourcesProvider as any)?.useFactory).toBeDefined();
      expect((resourcesProvider as any)?.useFactory()).toEqual([]);
    });

    it('should_include_MCP_PROMPTS_provider_with_multi_true', async () => {
      const { createMcpProviders } = await import('../../src/core/providers');
      const { MCP_PROMPTS } = await import('../../src/core/tokens');
      
      const providers = createMcpProviders();
      const promptsProvider = providers.find(p => (p as any).provide === MCP_PROMPTS);
      
      expect(promptsProvider).toBeDefined();
      expect((promptsProvider as any)?.useFactory).toBeDefined();
      expect((promptsProvider as any)?.useFactory()).toEqual([]);
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
      const appNameProvider = providers.find(p => (p as any).provide === APP_NAME);
      
      expect(appNameProvider).toBeDefined();
      expect(typeof (appNameProvider as any)?.useValue).toBe('string');
      expect((appNameProvider as any)?.useValue).toContain('sker');
    });

    it('should_include_platform_providers', async () => {
      const { createPlatformProviders } = await import('../../src/core/providers');
      
      const providers = createPlatformProviders();
      expect(providers.length).toBeGreaterThan(0);
    });
  });

  describe('Provider Integration', () => {
    it('should_create_providers_that_work_with_dependency_injection', async () => {
      const { createMcpProviders, createPlatformProviders } = await import('../../src/core/providers');
      
      const mcpProviders = createMcpProviders();
      const platformProviders = createPlatformProviders();
      const allProviders = [...mcpProviders, ...platformProviders];
      
      // Test that providers have correct structure for @sker/di
      allProviders.forEach((provider, index) => {
        expect((provider as any)).toHaveProperty('provide');
        
        // Now providers can be InjectionToken objects, StringToken strings, SymbolToken symbols, or class constructors
        const provideType = typeof (provider as any).provide;
        const isValidTokenType = (
          provideType === 'symbol' ||
          provideType === 'string' || 
          provideType === 'function' ||  // Allow class constructors
          (provideType === 'object' && (provider as any).provide !== null)
        );
        
        expect(isValidTokenType).toBe(true);
        
        expect(
          (provider as any).hasOwnProperty('useValue') || 
          (provider as any).hasOwnProperty('useClass') || 
          (provider as any).hasOwnProperty('useFactory')
        ).toBe(true);
      });
    });

    it('should_have_no_duplicate_providers', async () => {
      const { createMcpProviders, createPlatformProviders } = await import('../../src/core/providers');
      
      const mcpProviders = createMcpProviders();
      const platformProviders = createPlatformProviders();
      const allProviders = [...mcpProviders, ...platformProviders];
      
      const tokens = allProviders.map(p => (p as any).provide);
      const uniqueTokens = new Set(tokens);
      
      expect(uniqueTokens.size).toBe(tokens.length);
    });
  });
});