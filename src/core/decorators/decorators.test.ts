import 'reflect-metadata';
import { z } from 'zod';

describe('Core Decorators', () => {
  describe('@McpTool Decorator', () => {
    it('should_define_McpTool_decorator', async () => {
      const { McpTool } = await import('./mcp-tool');

      expect(typeof McpTool).toBe('function');
    });

    it('should_add_metadata_to_method_with_McpTool_decorator', async () => {
      const { McpTool } = await import('./mcp-tool');

      class TestService {
        @McpTool({
          name: 'test-tool',
          description: 'Test tool description',
          inputSchema: z.object({
            input: z.string()
          })
        })
        testMethod() {
          return 'test result';
        }
      }

      const metadata = Reflect.getMetadata('mcp:tool', TestService.prototype, 'testMethod');
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('test-tool');
      expect(metadata.description).toBe('Test tool description');
    });

    it('should_support_optional_middleware_in_McpTool', async () => {
      const { McpTool } = await import('./mcp-tool');

      class TestService {
        @McpTool({
          name: 'middleware-tool',
          description: 'Tool with middleware',
          inputSchema: z.object({}),
          middleware: ['auth', 'logging']
        })
        middlewareMethod() {
          return 'result';
        }
      }

      const metadata = Reflect.getMetadata('mcp:tool', TestService.prototype, 'middlewareMethod');
      expect(metadata.middleware).toEqual(['auth', 'logging']);
    });

    it('should_support_error_handler_in_McpTool', async () => {
      const { McpTool } = await import('./mcp-tool');

      class TestService {
        @McpTool({
          name: 'error-tool',
          description: 'Tool with error handler',
          inputSchema: z.object({}),
          errorHandler: 'handleToolError'
        })
        errorMethod() {
          return 'result';
        }
      }

      const metadata = Reflect.getMetadata('mcp:tool', TestService.prototype, 'errorMethod');
      expect(metadata.errorHandler).toBe('handleToolError');
    });
  });

  describe('@McpResource Decorator', () => {
    it('should_define_McpResource_decorator', async () => {
      const { McpResource } = await import('./mcp-resource');

      expect(typeof McpResource).toBe('function');
    });

    it('should_add_metadata_to_method_with_McpResource_decorator', async () => {
      const { McpResource } = await import('./mcp-resource');

      class TestService {
        @McpResource({
          uri: 'test://resource/{id}',
          name: 'test-resource',
          description: 'Test resource description'
        })
        getResource() {
          return { data: 'test' };
        }
      }

      const metadata = Reflect.getMetadata('mcp:resource', TestService.prototype, 'getResource');
      expect(metadata).toBeDefined();
      expect(metadata.uri).toBe('test://resource/{id}');
      expect(metadata.name).toBe('test-resource');
      expect(metadata.description).toBe('Test resource description');
    });

    it('should_support_optional_mimeType_in_McpResource', async () => {
      const { McpResource } = await import('./mcp-resource');

      class TestService {
        @McpResource({
          uri: 'file://data/{path}',
          name: 'file-resource',
          description: 'File resource',
          mimeType: 'application/json'
        })
        getFileResource() {
          return { content: 'data' };
        }
      }

      const metadata = Reflect.getMetadata('mcp:resource', TestService.prototype, 'getFileResource');
      expect(metadata.mimeType).toBe('application/json');
    });
  });

  describe('@McpPrompt Decorator', () => {
    it('should_define_McpPrompt_decorator', async () => {
      const { McpPrompt } = await import('./mcp-prompt');

      expect(typeof McpPrompt).toBe('function');
    });

    it('should_add_metadata_to_method_with_McpPrompt_decorator', async () => {
      const { McpPrompt } = await import('./mcp-prompt');

      class TestService {
        @McpPrompt({
          name: 'test-prompt',
          description: 'Test prompt description'
        })
        generatePrompt() {
          return { messages: ['Hello'] };
        }
      }

      const metadata = Reflect.getMetadata('mcp:prompt', TestService.prototype, 'generatePrompt');
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('test-prompt');
      expect(metadata.description).toBe('Test prompt description');
    });

    it('should_support_optional_arguments_schema_in_McpPrompt', async () => {
      const { McpPrompt } = await import('./mcp-prompt');

      class TestService {
        @McpPrompt({
          name: 'parameterized-prompt',
          description: 'Prompt with arguments',
          arguments: z.object({
            topic: z.string(),
            length: z.number().optional()
          })
        })
        generateParameterizedPrompt() {
          return { messages: ['Generated'] };
        }
      }

      const metadata = Reflect.getMetadata('mcp:prompt', TestService.prototype, 'generateParameterizedPrompt');
      expect(metadata.arguments).toBeDefined();
    });
  });

  describe('Decorator Integration', () => {
    it('should_allow_multiple_decorators_on_same_class', async () => {
      const { McpTool } = await import('./mcp-tool');
      const { McpResource } = await import('./mcp-resource');
      const { McpPrompt } = await import('./mcp-prompt');

      class MultiService {
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
      }

      const toolMetadata = Reflect.getMetadata('mcp:tool', MultiService.prototype, 'toolMethod');
      const resourceMetadata = Reflect.getMetadata('mcp:resource', MultiService.prototype, 'resourceMethod');
      const promptMetadata = Reflect.getMetadata('mcp:prompt', MultiService.prototype, 'promptMethod');

      expect(toolMetadata).toBeDefined();
      expect(resourceMetadata).toBeDefined();
      expect(promptMetadata).toBeDefined();
    });

    it('should_handle_inheritance_correctly', async () => {
      const { McpTool } = await import('./mcp-tool');

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

      const baseMetadata = Reflect.getMetadata('mcp:tool', ExtendedService.prototype, 'baseTool');
      const extendedMetadata = Reflect.getMetadata('mcp:tool', ExtendedService.prototype, 'extendedTool');

      expect(baseMetadata).toBeDefined();
      expect(extendedMetadata).toBeDefined();
      expect(baseMetadata.name).toBe('base-tool');
      expect(extendedMetadata.name).toBe('extended-tool');
    });
  });
});