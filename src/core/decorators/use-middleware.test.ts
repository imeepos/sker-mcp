import 'reflect-metadata';
import {
  UseMiddleware,
  UseMiddlewares,
  getMethodMiddleware,
  hasMethodMiddleware,
  BuiltinMiddlewares,
  type MiddlewareEntry,
  type UseMiddlewareOptions
} from './use-middleware';
import type { MiddlewareFunction, MiddlewareContext } from '../middleware/types';

describe('UseMiddleware Decorator', () => {
  let mockTarget: any;
  let mockPropertyKey: string;
  let mockDescriptor: PropertyDescriptor;
  let mockContext: MiddlewareContext;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockTarget = {};
    mockPropertyKey = 'testMethod';
    mockDescriptor = {
      value: jest.fn(),
      writable: true,
      enumerable: true,
      configurable: true
    };

    mockNext = jest.fn().mockResolvedValue('next-result');
    mockContext = {
      request: { method: 'test', params: {} } as any,
      requestType: 'tool',
      target: mockTarget,
      methodName: mockPropertyKey,
      args: { test: 'value' },
      metadata: {},
      startTime: Date.now(),
      requestId: 'test-request-id'
    };

    // Clear any existing metadata
    Reflect.deleteMetadata('mcp:middleware', mockTarget, mockPropertyKey);
  });

  describe('Basic UseMiddleware Decorator', () => {
    it('should_apply_middleware_to_method', () => {
      const mockMiddleware: MiddlewareFunction = jest.fn();
      const decorator = UseMiddleware(mockMiddleware);

      const result = decorator(mockTarget, mockPropertyKey, mockDescriptor);

      expect(result).toBe(mockDescriptor);
      expect(hasMethodMiddleware(mockTarget, mockPropertyKey)).toBe(true);
    });

    it('should_store_middleware_metadata', () => {
      const mockMiddleware: MiddlewareFunction = jest.fn();
      const options: UseMiddlewareOptions = {
        id: 'custom-middleware',
        priority: 100,
        metadata: { custom: 'data' }
      };

      const decorator = UseMiddleware(mockMiddleware, options);
      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const middleware = getMethodMiddleware(mockTarget, mockPropertyKey);
      expect(middleware).toHaveLength(1);
      expect(middleware[0]).toMatchObject({
        id: 'custom-middleware',
        middleware: mockMiddleware,
        priority: 100,
        metadata: { custom: 'data' }
      });
    });

    it('should_generate_default_id_when_not_provided', () => {
      const mockMiddleware: MiddlewareFunction = jest.fn().mockName('testMiddleware');
      const decorator = UseMiddleware(mockMiddleware);
      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const middleware = getMethodMiddleware(mockTarget, mockPropertyKey);
      expect(middleware[0].id).toContain('_0_');
    });

    it('should_set_default_priority_when_not_provided', () => {
      const mockMiddleware: MiddlewareFunction = jest.fn();
      const decorator = UseMiddleware(mockMiddleware);
      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const middleware = getMethodMiddleware(mockTarget, mockPropertyKey);
      expect(middleware[0].priority).toBe(1000);
    });

    it('should_handle_multiple_middleware_functions', () => {
      const middleware1: MiddlewareFunction = jest.fn();
      const middleware2: MiddlewareFunction = jest.fn();
      const middleware3: MiddlewareFunction = jest.fn();

      const decorator = UseMiddleware(middleware1, middleware2, middleware3);
      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const middleware = getMethodMiddleware(mockTarget, mockPropertyKey);
      expect(middleware).toHaveLength(3);
      expect(middleware[0].middleware).toBe(middleware1);
      expect(middleware[1].middleware).toBe(middleware2);
      expect(middleware[2].middleware).toBe(middleware3);
    });

    it('should_handle_middleware_with_options', () => {
      const middleware1: MiddlewareFunction = jest.fn();
      const middleware2: MiddlewareFunction = jest.fn();
      const options: UseMiddlewareOptions = {
        priority: 50,
        metadata: { shared: 'data' }
      };

      const decorator = UseMiddleware(middleware1, middleware2, options);
      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const middleware = getMethodMiddleware(mockTarget, mockPropertyKey);
      expect(middleware).toHaveLength(2);
      expect(middleware[0].priority).toBe(50);
      expect(middleware[1].priority).toBe(51);
      expect(middleware[0].metadata).toEqual({ shared: 'data' });
      expect(middleware[1].metadata).toEqual({ shared: 'data' });
    });

    it('should_accumulate_middleware_from_multiple_decorators', () => {
      const middleware1: MiddlewareFunction = jest.fn();
      const middleware2: MiddlewareFunction = jest.fn();

      const decorator1 = UseMiddleware(middleware1, { id: 'first' });
      const decorator2 = UseMiddleware(middleware2, { id: 'second' });

      decorator1(mockTarget, mockPropertyKey, mockDescriptor);
      decorator2(mockTarget, mockPropertyKey, mockDescriptor);

      const middleware = getMethodMiddleware(mockTarget, mockPropertyKey);
      expect(middleware).toHaveLength(2);
      expect(middleware[0].id).toBe('first');
      expect(middleware[1].id).toBe('second');
    });
  });

  describe('UseMiddlewares Multiple Decorator', () => {
    it('should_apply_multiple_middleware_with_configurations', () => {
      const middleware1: MiddlewareFunction = jest.fn();
      const middleware2: MiddlewareFunction = jest.fn();
      const middleware3: MiddlewareFunction = jest.fn();

      const decorator = UseMiddlewares([
        { middleware: middleware1, options: { id: 'first', priority: 1 } },
        { middleware: middleware2, options: { id: 'second', priority: 2 } },
        { middleware: middleware3, options: { id: 'third', priority: 3 } }
      ]);

      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const middleware = getMethodMiddleware(mockTarget, mockPropertyKey);
      expect(middleware).toHaveLength(3);
      expect(middleware.map(m => m.id)).toEqual(['first', 'second', 'third']);
      expect(middleware.map(m => m.priority)).toEqual([1, 2, 3]);
    });

    it('should_generate_default_configurations_for_middleware', () => {
      const middleware1: MiddlewareFunction = jest.fn().mockName('firstMiddleware');
      const middleware2: MiddlewareFunction = jest.fn().mockName('secondMiddleware');

      const decorator = UseMiddlewares([
        { middleware: middleware1 },
        { middleware: middleware2 }
      ]);

      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const middleware = getMethodMiddleware(mockTarget, mockPropertyKey);
      expect(middleware).toHaveLength(2);
      expect(middleware[0].priority).toBe(1000);
      expect(middleware[1].priority).toBe(1001);
    });

    it('should_merge_with_existing_middleware', () => {
      const existingMiddleware: MiddlewareFunction = jest.fn();
      const newMiddleware1: MiddlewareFunction = jest.fn();
      const newMiddleware2: MiddlewareFunction = jest.fn();

      // Add existing middleware first
      const existingDecorator = UseMiddleware(existingMiddleware, { id: 'existing' });
      existingDecorator(mockTarget, mockPropertyKey, mockDescriptor);

      // Add multiple new middleware
      const multipleDecorator = UseMiddlewares([
        { middleware: newMiddleware1, options: { id: 'new1' } },
        { middleware: newMiddleware2, options: { id: 'new2' } }
      ]);
      multipleDecorator(mockTarget, mockPropertyKey, mockDescriptor);

      const middleware = getMethodMiddleware(mockTarget, mockPropertyKey);
      expect(middleware).toHaveLength(3);
      expect(middleware.map(m => m.id)).toEqual(['existing', 'new1', 'new2']);
    });
  });

  describe('Metadata Utility Functions', () => {
    it('should_return_empty_array_when_no_middleware_exists', () => {
      const middleware = getMethodMiddleware(mockTarget, mockPropertyKey);
      expect(middleware).toEqual([]);
    });

    it('should_return_false_when_no_middleware_exists', () => {
      const hasMiddleware = hasMethodMiddleware(mockTarget, mockPropertyKey);
      expect(hasMiddleware).toBe(false);
    });

    it('should_return_true_when_middleware_exists', () => {
      const mockMiddleware: MiddlewareFunction = jest.fn();
      const decorator = UseMiddleware(mockMiddleware);
      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const hasMiddleware = hasMethodMiddleware(mockTarget, mockPropertyKey);
      expect(hasMiddleware).toBe(true);
    });

    it('should_handle_different_property_keys', () => {
      const middleware1: MiddlewareFunction = jest.fn();
      const middleware2: MiddlewareFunction = jest.fn();

      const decorator1 = UseMiddleware(middleware1, { id: 'method1-middleware' });
      const decorator2 = UseMiddleware(middleware2, { id: 'method2-middleware' });

      decorator1(mockTarget, 'method1', mockDescriptor);
      decorator2(mockTarget, 'method2', mockDescriptor);

      const middleware1List = getMethodMiddleware(mockTarget, 'method1');
      const middleware2List = getMethodMiddleware(mockTarget, 'method2');

      expect(middleware1List).toHaveLength(1);
      expect(middleware2List).toHaveLength(1);
      expect(middleware1List[0].id).toBe('method1-middleware');
      expect(middleware2List[0].id).toBe('method2-middleware');
    });
  });

  describe('Middleware ID Generation', () => {
    it('should_generate_unique_ids_for_anonymous_functions', () => {
      const middleware1 = async () => {};
      const middleware2 = async () => {};

      const decorator1 = UseMiddleware(middleware1);
      const decorator2 = UseMiddleware(middleware2);

      decorator1(mockTarget, 'method1', mockDescriptor);
      decorator2(mockTarget, 'method2', mockDescriptor);

      const middleware1List = getMethodMiddleware(mockTarget, 'method1');
      const middleware2List = getMethodMiddleware(mockTarget, 'method2');

      expect(middleware1List[0].id).toContain('_0_');
      expect(middleware2List[0].id).toContain('_0_');
      expect(middleware1List[0].id).not.toBe(middleware2List[0].id);
    });

    it('should_use_function_name_in_generated_id', () => {
      async function namedMiddleware() {}

      const decorator = UseMiddleware(namedMiddleware);
      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const middleware = getMethodMiddleware(mockTarget, mockPropertyKey);
      expect(middleware[0].id).toContain('namedMiddleware_0_');
    });

    it('should_include_timestamp_in_generated_id', () => {
      const middleware: MiddlewareFunction = jest.fn();
      const decorator = UseMiddleware(middleware);
      
      const beforeTime = Date.now();
      decorator(mockTarget, mockPropertyKey, mockDescriptor);
      const afterTime = Date.now();

      const middlewareList = getMethodMiddleware(mockTarget, mockPropertyKey);
      const idParts = middlewareList[0].id.split('_');
      const timestamp = parseInt(idParts[idParts.length - 1]);
      
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Priority Handling', () => {
    it('should_handle_priority_increments_for_multiple_middleware', () => {
      const middleware1: MiddlewareFunction = jest.fn();
      const middleware2: MiddlewareFunction = jest.fn();
      const middleware3: MiddlewareFunction = jest.fn();

      const decorator = UseMiddleware(
        middleware1,
        middleware2,
        middleware3,
        { priority: 100 }
      );
      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const middleware = getMethodMiddleware(mockTarget, mockPropertyKey);
      expect(middleware[0].priority).toBe(100);
      expect(middleware[1].priority).toBe(101);
      expect(middleware[2].priority).toBe(102);
    });

    it('should_handle_existing_middleware_count_in_priority', () => {
      const existingMiddleware: MiddlewareFunction = jest.fn();
      const newMiddleware: MiddlewareFunction = jest.fn();

      // Add existing middleware
      const existingDecorator = UseMiddleware(existingMiddleware);
      existingDecorator(mockTarget, mockPropertyKey, mockDescriptor);

      // Add new middleware without explicit priority
      const newDecorator = UseMiddleware(newMiddleware);
      newDecorator(mockTarget, mockPropertyKey, mockDescriptor);

      const middleware = getMethodMiddleware(mockTarget, mockPropertyKey);
      expect(middleware[0].priority).toBe(1000); // First middleware
      expect(middleware[1].priority).toBe(1001); // Second middleware
    });
  });

  describe('BuiltinMiddlewares', () => {
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    describe('createLoggingMiddleware', () => {
      it('should_log_start_and_completion_messages', async () => {
        const middleware = BuiltinMiddlewares.createLoggingMiddleware();

        await middleware(mockContext, mockNext);

        expect(consoleLogSpy).toHaveBeenCalledWith('[MCP] Starting tool testMethod');
        expect(consoleLogSpy).toHaveBeenCalledWith('[MCP] Completed tool testMethod');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should_use_custom_prefix', async () => {
        const middleware = BuiltinMiddlewares.createLoggingMiddleware({ prefix: 'CUSTOM' });

        await middleware(mockContext, mockNext);

        expect(consoleLogSpy).toHaveBeenCalledWith('[CUSTOM] Starting tool testMethod');
        expect(consoleLogSpy).toHaveBeenCalledWith('[CUSTOM] Completed tool testMethod');
      });

      it('should_log_errors_and_rethrow', async () => {
        const error = new Error('Test error');
        mockNext.mockRejectedValue(error);

        const middleware = BuiltinMiddlewares.createLoggingMiddleware();

        await expect(middleware(mockContext, mockNext)).rejects.toThrow('Test error');

        expect(consoleLogSpy).toHaveBeenCalledWith('[MCP] Starting tool testMethod');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[MCP] Failed tool testMethod:', error);
      });

      it('should_return_result_from_next', async () => {
        const expectedResult = { success: true };
        mockNext.mockResolvedValue(expectedResult);

        const middleware = BuiltinMiddlewares.createLoggingMiddleware();
        const result = await middleware(mockContext, mockNext);

        expect(result).toBe(expectedResult);
      });
    });

    describe('createTimingMiddleware', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should_measure_execution_time_on_success', async () => {
        const middleware = BuiltinMiddlewares.createTimingMiddleware();

        const middlewarePromise = middleware(mockContext, mockNext);

        // Advance time by 100ms
        jest.advanceTimersByTime(100);

        await middlewarePromise;

        expect(consoleLogSpy).toHaveBeenCalledWith('[TIMING] testMethod executed in 100ms');
      });

      it('should_measure_execution_time_on_failure', async () => {
        const error = new Error('Test error');
        mockNext.mockRejectedValue(error);

        const middleware = BuiltinMiddlewares.createTimingMiddleware();

        const middlewarePromise = middleware(mockContext, mockNext);

        // Advance time by 50ms
        jest.advanceTimersByTime(50);

        await expect(middlewarePromise).rejects.toThrow('Test error');

        expect(consoleLogSpy).toHaveBeenCalledWith('[TIMING] testMethod failed after 50ms');
      });
    });

    describe('createValidationMiddleware', () => {
      it('should_pass_through_valid_requests', async () => {
        const middleware = BuiltinMiddlewares.createValidationMiddleware();

        await middleware(mockContext, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should_throw_error_for_missing_request', async () => {
        const invalidContext = { ...mockContext, request: null };
        const middleware = BuiltinMiddlewares.createValidationMiddleware();

        await expect(middleware(invalidContext as any, mockNext)).rejects.toThrow('Invalid request: missing parameters');
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should_throw_error_for_missing_params', async () => {
        const invalidContext = { ...mockContext, request: { method: 'test' } };
        const middleware = BuiltinMiddlewares.createValidationMiddleware();

        await expect(middleware(invalidContext as any, mockNext)).rejects.toThrow('Invalid request: missing parameters');
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });
});
