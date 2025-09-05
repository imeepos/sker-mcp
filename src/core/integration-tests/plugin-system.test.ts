/**
 * Plugin System Integration Tests
 * 
 * Focused integration tests for the plugin system including Feature Injector,
 * conflict detection, plugin isolation, and communication bridge functionality.
 */

import { z } from 'zod';
import { Injectable } from '@sker/di';
import { 
  FeatureInjector, 
  IsolationLevel, 
  PluginIsolationUtils 
} from '../plugins/feature-injector.js';
import { 
  PluginConflictDetector,
  ConflictType,
  ConflictSeverity,
  ResolutionStrategy,
  BuiltinConflictRules
} from '../plugins/conflict-detector.js';
import { McpTool, Input } from '../decorators/index.js';
import type {
  IPlugin,
  IEnhancedPlugin,
  PluginIsolationOptions,
  PluginPermissions,
  PluginConflict,
  IsolatedPluginInstance
} from '../types.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

/**
 * Mock plugin service A
 */
@Injectable()
class PluginServiceA {
  @McpTool({
    name: 'plugin-a-tool',
    description: 'Tool from plugin A'
  })
  async toolA(
    @Input({ schema: z.string(), description: 'Input for tool A' }) _input: string
  ) {
    const { input } = this.extractArgs(arguments[0] as CallToolRequest);
    return { result: `Plugin A processed: ${input}`, plugin: 'A' };
  }

  @McpTool({
    name: 'shared-tool',
    description: 'Shared tool name from plugin A'
  })
  async sharedTool(
    @Input({ schema: z.string(), description: 'Shared input' }) _input: string
  ) {
    const { input } = this.extractArgs(arguments[0] as CallToolRequest);
    return { result: `Plugin A shared: ${input}`, plugin: 'A' };
  }

  private extractArgs(request: CallToolRequest): any {
    return request.params?.arguments || {};
  }
}

/**
 * Mock plugin service B  
 */
@Injectable()
class PluginServiceB {
  @McpTool({
    name: 'plugin-b-tool',
    description: 'Tool from plugin B'
  })
  async toolB(
    @Input({ schema: z.number(), description: 'Input for tool B' }) _input: number
  ) {
    const { input } = this.extractArgs(arguments[0] as CallToolRequest);
    return { result: `Plugin B processed: ${input * 2}`, plugin: 'B' };
  }

  @McpTool({
    name: 'shared-tool', // Same name as PluginServiceA - should conflict
    description: 'Shared tool name from plugin B'
  })
  async sharedTool(
    @Input({ schema: z.number(), description: 'Shared numeric input' }) _input: number
  ) {
    const { input } = this.extractArgs(arguments[0] as CallToolRequest);
    return { result: `Plugin B shared: ${input}`, plugin: 'B' };
  }

  private extractArgs(request: CallToolRequest): any {
    return request.params?.arguments || {};
  }
}

/**
 * Mock plugin service C (for dependency testing)
 */
@Injectable()
class PluginServiceC {
  constructor(
    private readonly serviceA?: PluginServiceA // Optional dependency on A
  ) {}

  @McpTool({
    name: 'plugin-c-tool',
    description: 'Tool from plugin C that depends on A'
  })
  async toolC(
    @Input({ schema: z.string(), description: 'Input for tool C' }) _input: string
  ) {
    const { input } = this.extractArgs(arguments[0] as CallToolRequest);
    
    let result = `Plugin C processed: ${input}`;
    
    if (this.serviceA) {
      // Use service A if available
      result += ' (with dependency on A)';
    }
    
    return { result, plugin: 'C', hasDependency: !!this.serviceA };
  }

  private extractArgs(request: CallToolRequest): any {
    return request.params?.arguments || {};
  }
}

/**
 * Helper function to create test plugins
 */
function createTestPlugin(
  name: string, 
  version: string, 
  services: any[], 
  options: Partial<IEnhancedPlugin> = {}
): IEnhancedPlugin {
  return {
    name,
    version,
    description: `Test plugin ${name}`,
    author: 'test-author',
    dependencies: [],
    services,
    providers: services.map(service => ({ provide: service, useClass: service })),
    trustLevel: 'trusted',
    isolationConfig: {
      isolationLevel: IsolationLevel.SERVICE,
      permissions: {
        parentServices: false,
        globalRegistration: false,
        crossPluginAccess: false,
        coreSystemAccess: false
      }
    },
    hooks: {
      onLoad: async () => console.log(`Plugin ${name} loaded`),
      onUnload: async () => console.log(`Plugin ${name} unloaded`)
    },
    ...options
  };
}

describe('Plugin System Integration Tests', () => {
  let featureInjector: FeatureInjector;
  let conflictDetector: PluginConflictDetector;
  let mockParentInjector: any;

  beforeEach(() => {
    mockParentInjector = {
      get: (token: any) => {
        // Mock parent injector responses
        if (token === PluginServiceA) return new PluginServiceA();
        if (token === 'CORE_SERVICE') return { name: 'core-service' };
        return null;
      }
    };

    featureInjector = new FeatureInjector(mockParentInjector);
    conflictDetector = new PluginConflictDetector(
      { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    );
  });

  afterEach(async () => {
    if (featureInjector) {
      await featureInjector.cleanup();
    }
    if (conflictDetector) {
      conflictDetector.clear();
    }
  });

  describe('Feature Injector - Plugin Isolation', () => {
    test('should create isolated plugin with SERVICE level isolation', async () => {
      const plugin = createTestPlugin('test-plugin', '1.0.0', [PluginServiceA]);
      
      const isolationOptions: PluginIsolationOptions = {
        isolationLevel: IsolationLevel.SERVICE,
        permissions: {
          parentServices: false,
          globalRegistration: false,
          crossPluginAccess: false,
          coreSystemAccess: false
        }
      };

      const isolatedInstance = await featureInjector.createIsolatedPlugin(plugin, isolationOptions);

      expect(isolatedInstance).toBeDefined();
      expect(isolatedInstance.plugin.name).toBe('test-plugin');
      expect(isolatedInstance.isolationLevel).toBe(IsolationLevel.SERVICE);
      expect(isolatedInstance.hasPermission('parentServices')).toBe(false);
      expect(isolatedInstance.hasPermission('globalRegistration')).toBe(false);

      await isolatedInstance.destroy();
    });

    test('should create isolated plugin with FULL isolation', async () => {
      const plugin = createTestPlugin('full-isolation-plugin', '1.0.0', [PluginServiceA]);
      
      const isolationOptions: PluginIsolationOptions = {
        isolationLevel: IsolationLevel.FULL
      };

      const isolatedInstance = await featureInjector.createIsolatedPlugin(plugin, isolationOptions);

      expect(isolatedInstance.isolationLevel).toBe(IsolationLevel.FULL);
      expect(isolatedInstance.hasPermission('parentServices')).toBe(false);

      await isolatedInstance.destroy();
    });

    test('should create isolated plugin with NONE isolation (trusted)', async () => {
      const plugin = createTestPlugin('trusted-plugin', '1.0.0', [PluginServiceA], {
        trustLevel: 'system'
      });
      
      const isolationOptions: PluginIsolationOptions = {
        isolationLevel: IsolationLevel.NONE,
        permissions: PluginIsolationUtils.createPermissions('system')
      };

      const isolatedInstance = await featureInjector.createIsolatedPlugin(plugin, isolationOptions);

      expect(isolatedInstance.isolationLevel).toBe(IsolationLevel.NONE);
      expect(isolatedInstance.hasPermission('parentServices')).toBe(true);
      expect(isolatedInstance.hasPermission('coreSystemAccess')).toBe(true);

      await isolatedInstance.destroy();
    });

    test('should prevent creating duplicate isolated plugins', async () => {
      const plugin = createTestPlugin('duplicate-test', '1.0.0', [PluginServiceA]);
      
      const isolatedInstance1 = await featureInjector.createIsolatedPlugin(plugin);
      
      await expect(
        featureInjector.createIsolatedPlugin(plugin)
      ).rejects.toThrow('Plugin duplicate-test@1.0.0 is already isolated');

      await isolatedInstance1.destroy();
    });

    test('should retrieve isolated plugin by name and version', async () => {
      const plugin = createTestPlugin('retrievable-plugin', '1.5.0', [PluginServiceA]);
      
      const isolatedInstance = await featureInjector.createIsolatedPlugin(plugin);
      
      const retrieved = featureInjector.getIsolatedPlugin('retrievable-plugin', '1.5.0');
      expect(retrieved).toBe(isolatedInstance);
      
      const retrievedByName = featureInjector.getIsolatedPlugin('retrievable-plugin');
      expect(retrievedByName).toBe(isolatedInstance);

      await isolatedInstance.destroy();
    });

    test('should list all isolated plugins', async () => {
      const plugin1 = createTestPlugin('list-plugin-1', '1.0.0', [PluginServiceA]);
      const plugin2 = createTestPlugin('list-plugin-2', '1.0.0', [PluginServiceB]);
      
      const instance1 = await featureInjector.createIsolatedPlugin(plugin1);
      const instance2 = await featureInjector.createIsolatedPlugin(plugin2);
      
      const allPlugins = featureInjector.listIsolatedPlugins();
      expect(allPlugins).toHaveLength(2);
      expect(allPlugins).toContain(instance1);
      expect(allPlugins).toContain(instance2);

      await instance1.destroy();
      await instance2.destroy();
    });

    test('should remove isolated plugin', async () => {
      const plugin = createTestPlugin('removable-plugin', '1.0.0', [PluginServiceA]);
      
      const isolatedInstance = await featureInjector.createIsolatedPlugin(plugin);
      expect(featureInjector.getIsolatedPlugin('removable-plugin')).toBe(isolatedInstance);
      
      const removed = await featureInjector.removeIsolatedPlugin('removable-plugin', '1.0.0');
      expect(removed).toBe(true);
      
      expect(featureInjector.getIsolatedPlugin('removable-plugin')).toBeNull();
    });

    test('should provide isolation statistics', async () => {
      const plugin1 = createTestPlugin('stats-plugin-1', '1.0.0', [PluginServiceA]);
      const plugin2 = createTestPlugin('stats-plugin-2', '1.0.0', [PluginServiceB]);
      
      const instance1 = await featureInjector.createIsolatedPlugin(plugin1, {
        isolationLevel: IsolationLevel.SERVICE
      });
      const instance2 = await featureInjector.createIsolatedPlugin(plugin2, {
        isolationLevel: IsolationLevel.FULL
      });
      
      const stats = featureInjector.getIsolationStats();
      expect(stats.totalIsolatedPlugins).toBe(2);
      expect(stats.isolationLevels[IsolationLevel.SERVICE]).toBe(1);
      expect(stats.isolationLevels[IsolationLevel.FULL]).toBe(1);
      expect(stats.isolationLevels[IsolationLevel.NONE]).toBe(0);

      await instance1.destroy();
      await instance2.destroy();
    });
  });

  describe('Plugin Communication Bridge', () => {
    test('should allow communication with parent container when permitted', async () => {
      const plugin = createTestPlugin('bridge-test-plugin', '1.0.0', [PluginServiceC]);
      
      const isolationOptions: PluginIsolationOptions = {
        isolationLevel: IsolationLevel.SERVICE,
        permissions: {
          parentServices: true,
          globalRegistration: false,
          crossPluginAccess: false,
          coreSystemAccess: false
        }
      };

      const isolatedInstance = await featureInjector.createIsolatedPlugin(plugin, isolationOptions);
      
      // Test communication bridge
      const coreService = await isolatedInstance.bridge.requestFromParent('CORE_SERVICE');
      expect(coreService).toBeDefined();

      await isolatedInstance.destroy();
    });

    test('should block communication when not permitted', async () => {
      const plugin = createTestPlugin('blocked-bridge-plugin', '1.0.0', [PluginServiceC]);
      
      const isolationOptions: PluginIsolationOptions = {
        isolationLevel: IsolationLevel.SERVICE,
        permissions: {
          parentServices: false,
          globalRegistration: false,
          crossPluginAccess: false,
          coreSystemAccess: false
        }
      };

      const isolatedInstance = await featureInjector.createIsolatedPlugin(plugin, isolationOptions);
      
      // Should throw permission error
      await expect(
        isolatedInstance.bridge.requestFromParent('CORE_SERVICE')
      ).rejects.toThrow('does not have permission to access parent services');

      await isolatedInstance.destroy();
    });
  });

  describe('Conflict Detection', () => {
    test('should detect tool name conflicts', async () => {
      const plugin1 = createTestPlugin('conflict-plugin-1', '1.0.0', [PluginServiceA]);
      const plugin2 = createTestPlugin('conflict-plugin-2', '1.0.0', [PluginServiceB]);
      
      const conflicts = conflictDetector.detectConflicts([plugin1, plugin2]);
      
      // Should detect shared-tool conflict
      const toolConflicts = conflicts.filter(c => c.type === ConflictType.TOOL_NAME);
      expect(toolConflicts.length).toBeGreaterThan(0);
      
      const sharedToolConflict = toolConflicts.find(c => 
        c.resource.identifier.includes('shared-tool')
      );
      expect(sharedToolConflict).toBeDefined();
      expect(sharedToolConflict?.plugins).toHaveLength(2);
    });

    test('should detect version conflicts', async () => {
      const plugin1 = createTestPlugin('same-plugin', '1.0.0', [PluginServiceA]);
      const plugin2 = createTestPlugin('same-plugin', '2.0.0', [PluginServiceA]);
      
      const conflicts = conflictDetector.detectConflicts([plugin1, plugin2]);
      
      const versionConflicts = conflicts.filter(c => c.type === ConflictType.VERSION);
      expect(versionConflicts.length).toBeGreaterThan(0);
      
      const versionConflict = versionConflicts[0];
      expect(versionConflict.resource.identifier).toBe('same-plugin');
      expect(versionConflict.plugins).toHaveLength(2);
    });

    test('should detect service class conflicts', async () => {
      const plugin1 = createTestPlugin('service-conflict-1', '1.0.0', [PluginServiceA]);
      const plugin2 = createTestPlugin('service-conflict-2', '1.0.0', [PluginServiceA]);
      
      const conflicts = conflictDetector.detectConflicts([plugin1, plugin2]);
      
      const serviceConflicts = conflicts.filter(c => c.type === ConflictType.SERVICE_CLASS);
      expect(serviceConflicts.length).toBeGreaterThan(0);
      
      const serviceConflict = serviceConflicts[0];
      expect(serviceConflict.resource.identifier).toBe('PluginServiceA');
    });

    test('should resolve conflicts using different strategies', async () => {
      const plugin1 = createTestPlugin('resolve-plugin-1', '1.0.0', [PluginServiceA]);
      const plugin2 = createTestPlugin('resolve-plugin-2', '1.0.0', [PluginServiceB]);
      
      const conflicts = conflictDetector.detectConflicts([plugin1, plugin2]);
      
      if (conflicts.length > 0) {
        const conflict = conflicts[0];
        
        // Test FIRST_WINS strategy
        const resolution1 = await conflictDetector.resolveConflict(
          conflict.id,
          ResolutionStrategy.FIRST_WINS
        );
        expect(resolution1.success).toBe(true);
        expect(resolution1.strategy).toBe(ResolutionStrategy.FIRST_WINS);
        expect(resolution1.action).toContain('first plugin');

        // Reset conflict for next test
        conflictDetector.clear();
        const freshConflicts = conflictDetector.detectConflicts([plugin1, plugin2]);
        if (freshConflicts.length > 0) {
          const freshConflict = freshConflicts[0];
          
          // Test LAST_WINS strategy
          const resolution2 = await conflictDetector.resolveConflict(
            freshConflict.id,
            ResolutionStrategy.LAST_WINS
          );
          expect(resolution2.success).toBe(true);
          expect(resolution2.strategy).toBe(ResolutionStrategy.LAST_WINS);
          expect(resolution2.action).toContain('last plugin');
        }
      }
    });

    test('should use plugin priorities for resolution', async () => {
      const plugin1 = createTestPlugin('priority-plugin-1', '1.0.0', [PluginServiceA]);
      const plugin2 = createTestPlugin('priority-plugin-2', '1.0.0', [PluginServiceB]);
      
      // Configure priorities
      conflictDetector.configure({
        enabled: true,
        strategies: [ConflictType.TOOL_NAME, ConflictType.SERVICE_CLASS],
        defaultResolution: ResolutionStrategy.PRIORITY,
        pluginPriorities: [
          { pluginName: 'priority-plugin-2', priority: 10, reason: 'Higher priority' },
          { pluginName: 'priority-plugin-1', priority: 5, reason: 'Lower priority' }
        ]
      });
      
      const conflicts = conflictDetector.detectConflicts([plugin1, plugin2]);
      
      if (conflicts.length > 0) {
        const conflict = conflicts[0];
        const resolution = await conflictDetector.resolveConflict(
          conflict.id,
          ResolutionStrategy.PRIORITY
        );
        
        expect(resolution.success).toBe(true);
        expect(resolution.action).toContain('priority-plugin-2');
      }
    });

    test('should register and execute custom conflict rules', async () => {
      const customRule = {
        name: 'test-custom-rule',
        description: 'Test custom conflict rule',
        detect: (plugins: IPlugin[]) => {
          // Custom rule: flag if more than 3 plugins
          if (plugins.length > 3) {
            return [{
              id: `custom-${Date.now()}`,
              type: ConflictType.CONFIGURATION,
              severity: ConflictSeverity.WARNING,
              plugins,
              resource: {
                identifier: 'plugin-count',
                type: 'configuration' as const
              },
              recommendedStrategy: ResolutionStrategy.MANUAL,
              possibleStrategies: [ResolutionStrategy.MANUAL],
              description: `Too many plugins: ${plugins.length}`,
              detectedAt: new Date()
            }];
          }
          return [];
        }
      };

      conflictDetector.configure({
        enabled: true,
        strategies: [ConflictType.CONFIGURATION],
        defaultResolution: ResolutionStrategy.MANUAL,
        pluginPriorities: [],
        customRules: [customRule]
      });

      // Create 5 plugins to trigger custom rule
      const plugins = Array(5).fill(null).map((_, i) => 
        createTestPlugin(`custom-rule-plugin-${i}`, '1.0.0', [PluginServiceA])
      );

      const conflicts = conflictDetector.detectConflicts(plugins);
      
      const customConflicts = conflicts.filter(c => c.type === ConflictType.CONFIGURATION);
      expect(customConflicts.length).toBe(1);
      expect(customConflicts[0].description).toContain('Too many plugins: 5');
    });
  });

  describe('Plugin Isolation Utils', () => {
    test('should create permissions for different trust levels', () => {
      const untrustedPermissions = PluginIsolationUtils.createPermissions('untrusted');
      expect(untrustedPermissions.parentServices).toBe(false);
      expect(untrustedPermissions.globalRegistration).toBe(false);
      expect(untrustedPermissions.crossPluginAccess).toBe(false);
      expect(untrustedPermissions.coreSystemAccess).toBe(false);

      const trustedPermissions = PluginIsolationUtils.createPermissions('trusted');
      expect(trustedPermissions.parentServices).toBe(true);
      expect(trustedPermissions.globalRegistration).toBe(false);
      expect(trustedPermissions.crossPluginAccess).toBe(false);
      expect(trustedPermissions.coreSystemAccess).toBe(false);

      const systemPermissions = PluginIsolationUtils.createPermissions('system');
      expect(systemPermissions.parentServices).toBe(true);
      expect(systemPermissions.globalRegistration).toBe(true);
      expect(systemPermissions.crossPluginAccess).toBe(true);
      expect(systemPermissions.coreSystemAccess).toBe(true);
    });

    test('should validate isolation options', () => {
      const validOptions: PluginIsolationOptions = {
        isolationLevel: IsolationLevel.SERVICE,
        permissions: {
          parentServices: true,
          globalRegistration: false,
          crossPluginAccess: false,
          coreSystemAccess: false
        }
      };

      const errors = PluginIsolationUtils.validateIsolationOptions(validOptions);
      expect(errors).toHaveLength(0);

      const invalidOptions = {
        isolationLevel: 'invalid' as any,
        permissions: {
          invalidPermission: true
        } as any
      };

      const invalidErrors = PluginIsolationUtils.validateIsolationOptions(invalidOptions);
      expect(invalidErrors.length).toBeGreaterThan(0);
      expect(invalidErrors.some(e => e.includes('Invalid isolation level'))).toBe(true);
      expect(invalidErrors.some(e => e.includes('Invalid permission key'))).toBe(true);
    });
  });

  describe('Built-in Conflict Rules', () => {
    test('should create circular dependency rule', () => {
      const circularRule = BuiltinConflictRules.createCircularDependencyRule();
      
      expect(circularRule.name).toBe('circular_dependency');
      expect(circularRule.description).toContain('circular dependencies');
      expect(typeof circularRule.detect).toBe('function');
      
      // Test rule execution (currently returns empty array)
      const conflicts = circularRule.detect([]);
      expect(Array.isArray(conflicts)).toBe(true);
    });

    test('should create incompatible version rule', () => {
      const versionRule = BuiltinConflictRules.createIncompatibleVersionRule();
      
      expect(versionRule.name).toBe('incompatible_version');
      expect(versionRule.description).toContain('incompatible plugin versions');
      expect(typeof versionRule.detect).toBe('function');
      
      // Test rule execution (currently returns empty array)
      const conflicts = versionRule.detect([]);
      expect(Array.isArray(conflicts)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle plugin destruction errors gracefully', async () => {
      const plugin = createTestPlugin('error-destruction-plugin', '1.0.0', [PluginServiceA]);
      
      const isolatedInstance = await featureInjector.createIsolatedPlugin(plugin);
      
      // Mock a destruction error
      jest.spyOn(isolatedInstance, 'destroy').mockRejectedValue(new Error('Destruction failed'));
      
      // Should not throw when cleaning up
      await expect(featureInjector.cleanup()).resolves.not.toThrow();
    });

    test('should handle invalid conflict resolution gracefully', async () => {
      const plugin1 = createTestPlugin('invalid-resolution-1', '1.0.0', [PluginServiceA]);
      const plugin2 = createTestPlugin('invalid-resolution-2', '1.0.0', [PluginServiceB]);
      
      const conflicts = conflictDetector.detectConflicts([plugin1, plugin2]);
      
      if (conflicts.length > 0) {
        const conflict = conflicts[0];
        
        // Try to resolve with invalid strategy
        const resolution = await conflictDetector.resolveConflict(
          conflict.id,
          'invalid-strategy' as any
        );
        
        expect(resolution.success).toBe(false);
        expect(resolution.error).toBeDefined();
      }
    });

    test('should handle non-existent conflict resolution', async () => {
      await expect(
        conflictDetector.resolveConflict('non-existent-conflict', ResolutionStrategy.FIRST_WINS)
      ).rejects.toThrow('Conflict non-existent-conflict not found');
    });
  });
});