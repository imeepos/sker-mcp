import 'reflect-metadata';
import { z } from 'zod';

describe('MetadataCollector', () => {
  describe('Service Registration', () => {
    it('should_create_MetadataCollector_instance', async () => {
      const { MetadataCollector } = await import('../../src/core/metadata-collector');
      
      const collector = new MetadataCollector();
      expect(collector).toBeDefined();
    });

    it('should_register_service_classes', async () => {
      const { MetadataCollector } = await import('../../src/core/metadata-collector');
      
      class TestService {}
      
      const collector = new MetadataCollector();
      collector.registerService(TestService);
      
      const registeredServices = collector.getRegisteredServices();
      expect(registeredServices).toContain(TestService);
    });

    it('should_prevent_duplicate_service_registration', async () => {
      const { MetadataCollector } = await import('../../src/core/metadata-collector');
      
      class TestService {}
      
      const collector = new MetadataCollector();
      collector.registerService(TestService);
      collector.registerService(TestService);
      
      const registeredServices = collector.getRegisteredServices();
      expect(registeredServices.length).toBe(1);
    });
  });

  describe('Tool Metadata Collection', () => {
    it('should_collect_tool_metadata_from_decorated_methods', async () => {
      const { MetadataCollector } = await import('../../src/core/metadata-collector');
      const { McpTool } = await import('../../src/core/decorators/mcp-tool');
      
      class ToolService {
        @McpTool({
          name: 'test-tool',
          description: 'Test tool',
          inputSchema: z.object({ input: z.string() })
        })
        testTool() {
          return 'result';
        }

        @McpTool({
          name: 'another-tool',
          description: 'Another tool',
          inputSchema: z.object({}),
          middleware: ['auth'],
          errorHandler: 'handleError'
        })
        anotherTool() {
          return 'result2';
        }
      }
      
      const collector = new MetadataCollector();
      collector.registerService(ToolService);
      
      const toolMetadata = collector.collectToolMetadata();
      
      expect(toolMetadata).toHaveLength(2);
      
      const testTool = toolMetadata.find(tool => tool.name === 'test-tool');
      const anotherTool = toolMetadata.find(tool => tool.name === 'another-tool');
      
      expect(testTool).toBeDefined();
      expect(testTool?.description).toBe('Test tool');
      expect(testTool?.serviceClass).toBe(ToolService);
      expect(testTool?.methodName).toBe('testTool');
      expect(testTool?.middleware).toEqual([]);
      
      expect(anotherTool).toBeDefined();
      expect(anotherTool?.middleware).toEqual(['auth']);
      expect(anotherTool?.errorHandler).toBe('handleError');
    });

    it('should_handle_services_without_tools', async () => {
      const { MetadataCollector } = await import('../../src/core/metadata-collector');
      
      class EmptyService {
        regularMethod() {
          return 'not a tool';
        }
      }
      
      const collector = new MetadataCollector();
      collector.registerService(EmptyService);
      
      const toolMetadata = collector.collectToolMetadata();
      expect(toolMetadata).toHaveLength(0);
    });
  });

  describe('Resource Metadata Collection', () => {
    it('should_collect_resource_metadata_from_decorated_methods', async () => {
      const { MetadataCollector } = await import('../../src/core/metadata-collector');
      const { McpResource } = await import('../../src/core/decorators/mcp-resource');
      
      class ResourceService {
        @McpResource({
          uri: 'file:///{path}',
          name: 'file-resource',
          description: 'File resource'
        })
        getFile() {
          return 'file content';
        }

        @McpResource({
          uri: 'config:///{key}',
          name: 'config-resource',
          description: 'Config resource',
          mimeType: 'application/json',
          middleware: ['validate']
        })
        getConfig() {
          return { key: 'value' };
        }
      }
      
      const collector = new MetadataCollector();
      collector.registerService(ResourceService);
      
      const resourceMetadata = collector.collectResourceMetadata();
      
      expect(resourceMetadata).toHaveLength(2);
      
      const fileResource = resourceMetadata.find(res => res.name === 'file-resource');
      const configResource = resourceMetadata.find(res => res.name === 'config-resource');
      
      expect(fileResource).toBeDefined();
      expect(fileResource?.uri).toBe('file:///{path}');
      expect(fileResource?.serviceClass).toBe(ResourceService);
      expect(fileResource?.methodName).toBe('getFile');
      expect(fileResource?.mimeType).toBeUndefined();
      
      expect(configResource).toBeDefined();
      expect(configResource?.mimeType).toBe('application/json');
      expect(configResource?.middleware).toEqual(['validate']);
    });
  });

  describe('Prompt Metadata Collection', () => {
    it('should_collect_prompt_metadata_from_decorated_methods', async () => {
      const { MetadataCollector } = await import('../../src/core/metadata-collector');
      const { McpPrompt } = await import('../../src/core/decorators/mcp-prompt');
      
      class PromptService {
        @McpPrompt({
          name: 'simple-prompt',
          description: 'Simple prompt'
        })
        simplePrompt() {
          return { messages: ['Hello'] };
        }

        @McpPrompt({
          name: 'complex-prompt',
          description: 'Complex prompt',
          arguments: z.object({ topic: z.string() }),
          middleware: ['auth', 'logging']
        })
        complexPrompt() {
          return { messages: ['Complex'] };
        }
      }
      
      const collector = new MetadataCollector();
      collector.registerService(PromptService);
      
      const promptMetadata = collector.collectPromptMetadata();
      
      expect(promptMetadata).toHaveLength(2);
      
      const simplePrompt = promptMetadata.find(prompt => prompt.name === 'simple-prompt');
      const complexPrompt = promptMetadata.find(prompt => prompt.name === 'complex-prompt');
      
      expect(simplePrompt).toBeDefined();
      expect(simplePrompt?.serviceClass).toBe(PromptService);
      expect(simplePrompt?.methodName).toBe('simplePrompt');
      expect(simplePrompt?.middleware).toEqual([]);
      
      expect(complexPrompt).toBeDefined();
      expect(complexPrompt?.arguments).toBeDefined();
      expect(complexPrompt?.middleware).toEqual(['auth', 'logging']);
    });
  });

  describe('Complete Metadata Collection', () => {
    it('should_collect_all_metadata_types_together', async () => {
      const { MetadataCollector } = await import('../../src/core/metadata-collector');
      const { McpTool } = await import('../../src/core/decorators/mcp-tool');
      const { McpResource } = await import('../../src/core/decorators/mcp-resource');
      const { McpPrompt } = await import('../../src/core/decorators/mcp-prompt');
      
      class CompleteService {
        @McpTool({
          name: 'multi-tool',
          description: 'Multi tool',
          inputSchema: z.object({})
        })
        toolMethod() {
          return 'tool';
        }

        @McpResource({
          uri: 'multi://resource',
          name: 'multi-resource',
          description: 'Multi resource'
        })
        resourceMethod() {
          return 'resource';
        }

        @McpPrompt({
          name: 'multi-prompt',
          description: 'Multi prompt'
        })
        promptMethod() {
          return 'prompt';
        }

        regularMethod() {
          return 'not decorated';
        }
      }
      
      const collector = new MetadataCollector();
      collector.registerService(CompleteService);
      
      const allMetadata = collector.collectAllMetadata();
      
      expect(allMetadata.tools).toHaveLength(1);
      expect(allMetadata.resources).toHaveLength(1);
      expect(allMetadata.prompts).toHaveLength(1);
      
      expect(allMetadata.tools[0]?.name).toBe('multi-tool');
      expect(allMetadata.resources[0]?.name).toBe('multi-resource');
      expect(allMetadata.prompts[0]?.name).toBe('multi-prompt');
    });

    it('should_collect_from_multiple_services', async () => {
      const { MetadataCollector } = await import('../../src/core/metadata-collector');
      const { McpTool } = await import('../../src/core/decorators/mcp-tool');
      const { McpResource } = await import('../../src/core/decorators/mcp-resource');
      
      class ServiceA {
        @McpTool({
          name: 'tool-a',
          description: 'Tool A',
          inputSchema: z.object({})
        })
        toolA() {
          return 'a';
        }
      }

      class ServiceB {
        @McpResource({
          uri: 'service-b://resource',
          name: 'resource-b',
          description: 'Resource B'
        })
        resourceB() {
          return 'b';
        }
      }
      
      const collector = new MetadataCollector();
      collector.registerService(ServiceA);
      collector.registerService(ServiceB);
      
      const allMetadata = collector.collectAllMetadata();
      
      expect(allMetadata.tools).toHaveLength(1);
      expect(allMetadata.resources).toHaveLength(1);
      expect(allMetadata.prompts).toHaveLength(0);
      
      expect(allMetadata.tools[0]?.serviceClass).toBe(ServiceA);
      expect(allMetadata.resources[0]?.serviceClass).toBe(ServiceB);
    });
  });

  describe('Error Handling', () => {
    it('should_handle_inheritance_correctly', async () => {
      const { MetadataCollector } = await import('../../src/core/metadata-collector');
      const { McpTool } = await import('../../src/core/decorators/mcp-tool');
      
      class BaseService {
        @McpTool({
          name: 'base-tool',
          description: 'Base tool',
          inputSchema: z.object({})
        })
        baseTool() {
          return 'base';
        }
      }
      
      class ExtendedService extends BaseService {
        @McpTool({
          name: 'extended-tool',
          description: 'Extended tool',
          inputSchema: z.object({})
        })
        extendedTool() {
          return 'extended';
        }
      }
      
      const collector = new MetadataCollector();
      collector.registerService(ExtendedService);
      
      const toolMetadata = collector.collectToolMetadata();
      
      expect(toolMetadata).toHaveLength(2);
      
      const baseToolMeta = toolMetadata.find(tool => tool.name === 'base-tool');
      const extendedToolMeta = toolMetadata.find(tool => tool.name === 'extended-tool');
      
      expect(baseToolMeta).toBeDefined();
      expect(extendedToolMeta).toBeDefined();
      expect(baseToolMeta?.serviceClass).toBe(ExtendedService);
      expect(extendedToolMeta?.serviceClass).toBe(ExtendedService);
    });

    it('should_clear_registered_services', async () => {
      const { MetadataCollector } = await import('../../src/core/metadata-collector');
      
      class TestService {}
      
      const collector = new MetadataCollector();
      collector.registerService(TestService);
      
      expect(collector.getRegisteredServices()).toHaveLength(1);
      
      collector.clearServices();
      
      expect(collector.getRegisteredServices()).toHaveLength(0);
    });
  });
});