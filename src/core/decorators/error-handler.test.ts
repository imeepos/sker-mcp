import 'reflect-metadata';
import {
  ErrorHandler,
  ErrorHandlers,
  getMethodErrorHandlers,
  hasMethodErrorHandlers,
  BuiltinErrorHandlers,
  type ErrorHandlerMetadata,
  type ErrorHandlerOptions
} from './error-handler';
import type { ErrorHandlerFunction, ErrorContext } from '../errors/types';

describe('ErrorHandler Decorator', () => {
  let mockTarget: any;
  let mockPropertyKey: string;
  let mockDescriptor: PropertyDescriptor;
  let mockErrorContext: ErrorContext;

  beforeEach(() => {
    mockTarget = {};
    mockPropertyKey = 'testMethod';
    mockDescriptor = {
      value: jest.fn(),
      writable: true,
      enumerable: true,
      configurable: true
    };

    mockErrorContext = {
      request: { method: 'test', params: {} } as any,
      requestType: 'tool',
      target: mockTarget,
      methodName: mockPropertyKey,
      args: { test: 'value' },
      metadata: {},
      errorTime: Date.now(),
      requestId: 'test-request-id'
    };

    // Clear any existing metadata
    Reflect.deleteMetadata('mcp:error-handler', mockTarget, mockPropertyKey);
  });

  describe('Basic ErrorHandler Decorator', () => {
    it('should_apply_error_handler_to_method', () => {
      const mockHandler: ErrorHandlerFunction = jest.fn();
      const decorator = ErrorHandler(mockHandler);

      const result = decorator(mockTarget, mockPropertyKey, mockDescriptor);

      expect(result).toBe(mockDescriptor);
      expect(hasMethodErrorHandlers(mockTarget, mockPropertyKey)).toBe(true);
    });

    it('should_store_error_handler_metadata', () => {
      const mockHandler: ErrorHandlerFunction = jest.fn();
      const options: ErrorHandlerOptions = {
        id: 'custom-handler',
        priority: 100,
        metadata: { custom: 'data' },
        errorTypes: [Error, 'ValidationError']
      };

      const decorator = ErrorHandler(mockHandler, options);
      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const handlers = getMethodErrorHandlers(mockTarget, mockPropertyKey);
      expect(handlers).toHaveLength(1);
      expect(handlers[0]).toMatchObject({
        id: 'custom-handler',
        handler: mockHandler,
        priority: 100,
        metadata: { custom: 'data' },
        errorTypes: [Error, 'ValidationError']
      });
    });

    it('should_generate_default_id_when_not_provided', () => {
      const mockHandler: ErrorHandlerFunction = jest.fn().mockName('testHandler');

      const decorator = ErrorHandler(mockHandler);
      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const handlers = getMethodErrorHandlers(mockTarget, mockPropertyKey);
      expect(handlers[0].id).toContain('_errorHandler');
    });

    it('should_set_default_priority_when_not_provided', () => {
      const mockHandler: ErrorHandlerFunction = jest.fn();
      const decorator = ErrorHandler(mockHandler);
      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const handlers = getMethodErrorHandlers(mockTarget, mockPropertyKey);
      expect(handlers[0].priority).toBe(1000);
    });

    it('should_handle_multiple_error_handlers_on_same_method', () => {
      const handler1: ErrorHandlerFunction = jest.fn();
      const handler2: ErrorHandlerFunction = jest.fn();

      const decorator1 = ErrorHandler(handler1, { id: 'handler1', priority: 1 });
      const decorator2 = ErrorHandler(handler2, { id: 'handler2', priority: 2 });

      decorator1(mockTarget, mockPropertyKey, mockDescriptor);
      decorator2(mockTarget, mockPropertyKey, mockDescriptor);

      const handlers = getMethodErrorHandlers(mockTarget, mockPropertyKey);
      expect(handlers).toHaveLength(2);
      expect(handlers[0].id).toBe('handler1');
      expect(handlers[1].id).toBe('handler2');
    });
  });

  describe('ErrorHandlers Multiple Decorator', () => {
    it('should_apply_multiple_handlers_at_once', () => {
      const handler1: ErrorHandlerFunction = jest.fn();
      const handler2: ErrorHandlerFunction = jest.fn();
      const handler3: ErrorHandlerFunction = jest.fn();

      const decorator = ErrorHandlers([
        { handler: handler1, options: { id: 'first', priority: 1 } },
        { handler: handler2, options: { id: 'second', priority: 2 } },
        { handler: handler3, options: { id: 'third', priority: 3 } }
      ]);

      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const handlers = getMethodErrorHandlers(mockTarget, mockPropertyKey);
      expect(handlers).toHaveLength(3);
      expect(handlers.map(h => h.id)).toEqual(['first', 'second', 'third']);
      expect(handlers.map(h => h.priority)).toEqual([1, 2, 3]);
    });

    it('should_generate_default_ids_for_multiple_handlers', () => {
      const handler1: ErrorHandlerFunction = jest.fn().mockName('firstHandler');
      const handler2: ErrorHandlerFunction = jest.fn().mockName('secondHandler');

      const decorator = ErrorHandlers([
        { handler: handler1 },
        { handler: handler2 }
      ]);

      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const handlers = getMethodErrorHandlers(mockTarget, mockPropertyKey);
      expect(handlers[0].id).toContain('_errorHandler_0');
      expect(handlers[1].id).toContain('_errorHandler_1');
    });

    it('should_merge_with_existing_handlers', () => {
      const existingHandler: ErrorHandlerFunction = jest.fn();
      const newHandler1: ErrorHandlerFunction = jest.fn();
      const newHandler2: ErrorHandlerFunction = jest.fn();

      // Add existing handler first
      const existingDecorator = ErrorHandler(existingHandler, { id: 'existing' });
      existingDecorator(mockTarget, mockPropertyKey, mockDescriptor);

      // Add multiple new handlers
      const multipleDecorator = ErrorHandlers([
        { handler: newHandler1, options: { id: 'new1' } },
        { handler: newHandler2, options: { id: 'new2' } }
      ]);
      multipleDecorator(mockTarget, mockPropertyKey, mockDescriptor);

      const handlers = getMethodErrorHandlers(mockTarget, mockPropertyKey);
      expect(handlers).toHaveLength(3);
      expect(handlers.map(h => h.id)).toEqual(['existing', 'new1', 'new2']);
    });
  });

  describe('Metadata Utility Functions', () => {
    it('should_return_empty_array_when_no_handlers_exist', () => {
      const handlers = getMethodErrorHandlers(mockTarget, mockPropertyKey);
      expect(handlers).toEqual([]);
    });

    it('should_return_false_when_no_handlers_exist', () => {
      const hasHandlers = hasMethodErrorHandlers(mockTarget, mockPropertyKey);
      expect(hasHandlers).toBe(false);
    });

    it('should_return_true_when_handlers_exist', () => {
      const mockHandler: ErrorHandlerFunction = jest.fn();
      const decorator = ErrorHandler(mockHandler);
      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const hasHandlers = hasMethodErrorHandlers(mockTarget, mockPropertyKey);
      expect(hasHandlers).toBe(true);
    });

    it('should_handle_different_property_keys', () => {
      const handler1: ErrorHandlerFunction = jest.fn();
      const handler2: ErrorHandlerFunction = jest.fn();

      const decorator1 = ErrorHandler(handler1, { id: 'method1-handler' });
      const decorator2 = ErrorHandler(handler2, { id: 'method2-handler' });

      decorator1(mockTarget, 'method1', mockDescriptor);
      decorator2(mockTarget, 'method2', mockDescriptor);

      const handlers1 = getMethodErrorHandlers(mockTarget, 'method1');
      const handlers2 = getMethodErrorHandlers(mockTarget, 'method2');

      expect(handlers1).toHaveLength(1);
      expect(handlers2).toHaveLength(1);
      expect(handlers1[0].id).toBe('method1-handler');
      expect(handlers2[0].id).toBe('method2-handler');
    });
  });

  describe('Error Handler ID Generation', () => {
    it('should_generate_unique_ids_for_anonymous_functions', () => {
      const handler1 = () => {};
      const handler2 = () => {};

      const decorator1 = ErrorHandler(handler1);
      const decorator2 = ErrorHandler(handler2);

      decorator1(mockTarget, 'method1', mockDescriptor);
      decorator2(mockTarget, 'method2', mockDescriptor);

      const handlers1 = getMethodErrorHandlers(mockTarget, 'method1');
      const handlers2 = getMethodErrorHandlers(mockTarget, 'method2');

      expect(handlers1[0].id).toContain('_errorHandler');
      expect(handlers2[0].id).toContain('_errorHandler');
      expect(handlers1[0].id).not.toBe(handlers2[0].id);
    });

    it('should_use_function_name_in_generated_id', () => {
      function namedHandler() {}
      
      const decorator = ErrorHandler(namedHandler);
      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const handlers = getMethodErrorHandlers(mockTarget, mockPropertyKey);
      expect(handlers[0].id).toContain('namedHandler_errorHandler');
    });

    it('should_include_timestamp_in_generated_id', () => {
      const handler: ErrorHandlerFunction = jest.fn();
      const decorator = ErrorHandler(handler);
      
      const beforeTime = Date.now();
      decorator(mockTarget, mockPropertyKey, mockDescriptor);
      const afterTime = Date.now();

      const handlers = getMethodErrorHandlers(mockTarget, mockPropertyKey);
      const idParts = handlers[0].id.split('_');
      const timestamp = parseInt(idParts[idParts.length - 1]);
      
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Error Types Configuration', () => {
    it('should_store_error_types_configuration', () => {
      const mockHandler: ErrorHandlerFunction = jest.fn();
      const errorTypes = [Error, TypeError, 'ValidationError', 'NetworkError'];

      const decorator = ErrorHandler(mockHandler, { errorTypes });
      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const handlers = getMethodErrorHandlers(mockTarget, mockPropertyKey);
      expect(handlers[0].errorTypes).toEqual(errorTypes);
    });

    it('should_handle_undefined_error_types', () => {
      const mockHandler: ErrorHandlerFunction = jest.fn();
      const decorator = ErrorHandler(mockHandler);
      decorator(mockTarget, mockPropertyKey, mockDescriptor);

      const handlers = getMethodErrorHandlers(mockTarget, mockPropertyKey);
      expect(handlers[0].errorTypes).toBeUndefined();
    });
  });

  describe('BuiltinErrorHandlers', () => {
    let consoleErrorSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    describe('createLoggingErrorHandler', () => {
      it('should_create_logging_handler_with_default_prefix', () => {
        const handler = BuiltinErrorHandlers.createLoggingErrorHandler();
        const testError = new Error('Test error');

        expect(() => handler(testError, mockErrorContext)).toThrow('Test error');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[ERROR] Error in testMethod:',
          expect.objectContaining({
            message: 'Test error',
            stack: testError.stack,
            requestId: 'test-request-id'
          })
        );
      });

      it('should_create_logging_handler_with_custom_prefix', () => {
        const handler = BuiltinErrorHandlers.createLoggingErrorHandler({ prefix: 'CUSTOM' });
        const testError = new Error('Test error');

        expect(() => handler(testError, mockErrorContext)).toThrow('Test error');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[CUSTOM] Error in testMethod:',
          expect.any(Object)
        );
      });

      it('should_rethrow_original_error', () => {
        const handler = BuiltinErrorHandlers.createLoggingErrorHandler();
        const testError = new Error('Test error');

        expect(() => handler(testError, mockErrorContext)).toThrow(testError);
      });
    });

    describe('createGracefulDegradationHandler', () => {
      it('should_return_fallback_value_on_error', () => {
        const fallbackValue = { fallback: true };
        const handler = BuiltinErrorHandlers.createGracefulDegradationHandler(fallbackValue);
        const testError = new Error('Test error');

        const result = handler(testError, mockErrorContext);

        expect(result).toEqual({
          result: fallbackValue,
          error: true,
          message: 'Operation completed with degraded functionality',
          originalError: 'Test error',
          requestId: 'test-request-id'
        });
      });

      it('should_use_null_as_default_fallback', () => {
        const handler = BuiltinErrorHandlers.createGracefulDegradationHandler();
        const testError = new Error('Test error');

        const result = handler(testError, mockErrorContext);

        expect(result.result).toBeNull();
      });

      it('should_log_graceful_degradation_warning', () => {
        const handler = BuiltinErrorHandlers.createGracefulDegradationHandler();
        const testError = new Error('Test error');

        handler(testError, mockErrorContext);

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          '[GRACEFUL] Graceful degradation for testMethod:',
          'Test error'
        );
      });
    });

    describe('createRetryHandler', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should_throw_immediately_for_non_retryable_errors', async () => {
        const handler = BuiltinErrorHandlers.createRetryHandler(3, 1000);
        const testError = new Error('Non-retryable error');

        await expect(handler(testError, mockErrorContext)).rejects.toThrow('Non-retryable error');
      });

      it('should_attempt_retry_for_retryable_errors', async () => {
        const handler = BuiltinErrorHandlers.createRetryHandler(3, 1000);
        const testError = new Error('NETWORK_ERROR occurred');

        const retryPromise = handler(testError, mockErrorContext);

        // Fast-forward time
        jest.advanceTimersByTime(1000);

        await expect(retryPromise).rejects.toThrow('NETWORK_ERROR occurred');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[RETRY] Retrying testMethod (attempt 1/3) after 1000ms')
        );
      });

      it('should_handle_timeout_errors_as_retryable', async () => {
        const handler = BuiltinErrorHandlers.createRetryHandler(2, 500);
        const testError = new Error('TIMEOUT occurred');

        const retryPromise = handler(testError, mockErrorContext);
        jest.advanceTimersByTime(500);

        await expect(retryPromise).rejects.toThrow('TIMEOUT occurred');
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[RETRY] Retrying testMethod (attempt 1/2) after 500ms')
        );
      });

      it('should_handle_service_unavailable_errors_as_retryable', async () => {
        const handler = BuiltinErrorHandlers.createRetryHandler(1, 100);
        const testError = new Error('SERVICE_UNAVAILABLE');

        const retryPromise = handler(testError, mockErrorContext);
        jest.advanceTimersByTime(100);

        await expect(retryPromise).rejects.toThrow('SERVICE_UNAVAILABLE');
      });
    });

    describe('createSanitizingHandler', () => {
      it('should_remove_sensitive_keys_from_context', () => {
        const handler = BuiltinErrorHandlers.createSanitizingHandler(['password', 'token']);
        const testError = new Error('Test error');
        const sensitiveContext = {
          ...mockErrorContext,
          args: {
            username: 'user123',
            password: 'secret123',
            token: 'abc123',
            data: 'safe-data'
          }
        };

        const result = handler(testError, sensitiveContext);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[SANITIZED] Error occurred:',
          expect.objectContaining({
            message: 'Test error',
            context: expect.objectContaining({
              args: {
                username: 'user123',
                data: 'safe-data'
                // password and token should be removed
              }
            })
          })
        );

        expect(result).toEqual({
          error: true,
          message: 'An error occurred',
          code: 'INTERNAL_ERROR',
          requestId: 'test-request-id'
        });
      });

      it('should_handle_empty_sensitive_keys_array', () => {
        const handler = BuiltinErrorHandlers.createSanitizingHandler([]);
        const testError = new Error('Test error');

        const result = handler(testError, mockErrorContext);

        expect(result.error).toBe(true);
        expect(result.message).toBe('An error occurred');
      });

      it('should_handle_null_args_gracefully', () => {
        const handler = BuiltinErrorHandlers.createSanitizingHandler(['password']);
        const testError = new Error('Test error');
        const contextWithNullArgs = {
          ...mockErrorContext,
          args: null
        };

        expect(() => handler(testError, contextWithNullArgs)).not.toThrow();
      });
    });
  });
});
