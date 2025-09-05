/**
 * Error Handling Demo Service
 * 
 * Demonstrates the usage of @ErrorHandler decorator with various error
 * handling strategies including custom handlers and built-in handlers.
 */

import { z } from 'zod';
import { Injectable } from '@sker/di';
import { McpTool, Input, ErrorHandler, ErrorHandlers } from '../core/decorators/index.js';
import { BuiltinErrorHandlers } from '../core/decorators/error-handler.js';
import { 
  ValidationError, 
  AuthenticationError,
  NotFoundError,
  type ErrorHandlerFunction,
  type IErrorHandler,
  type ErrorContext
} from '../core/errors/index.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

/**
 * Custom validation error handler class
 */
class ValidationErrorHandler implements IErrorHandler {
  name = 'ValidationErrorHandler';
  priority = 1;
  
  canHandle(error: Error, _context: ErrorContext): boolean {
    return error instanceof ValidationError;
  }
  
  async handle(error: Error, context: ErrorContext): Promise<any> {
    console.log('[VALIDATION_HANDLER] Handling validation error:', error.message);
    
    return {
      error: true,
      type: 'validation_error',
      message: 'Input validation failed',
      details: error instanceof ValidationError ? error.details : undefined,
      suggestions: [
        'Please check your input parameters',
        'Ensure all required fields are provided',
        'Verify data types match the expected schema'
      ],
      requestId: context.requestId,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Custom network error handler class  
 */
class NetworkErrorHandler implements IErrorHandler {
  name = 'NetworkErrorHandler';
  priority = 2;
  
  canHandle(error: Error): boolean {
    return error.message.toLowerCase().includes('network') || 
           error.message.toLowerCase().includes('timeout') ||
           error.message.toLowerCase().includes('connection');
  }
  
  async handle(error: Error, context: ErrorContext): Promise<any> {
    console.log('[NETWORK_HANDLER] Handling network error:', error.message);
    
    return {
      error: true,
      type: 'network_error',
      message: 'Network operation failed',
      retryable: true,
      retryAfter: 5000,
      fallback: {
        result: 'cached_result_or_default',
        source: 'fallback'
      },
      requestId: context.requestId
    };
  }
}

/**
 * Custom authentication error handler function
 */
const AuthErrorHandler: ErrorHandlerFunction = (error, context) => {
  if (error instanceof AuthenticationError) {
    console.log('[AUTH_HANDLER] Handling authentication error');
    
    return {
      error: true,
      type: 'authentication_error',
      message: 'Authentication required',
      authUrl: '/auth/login',
      supportedMethods: ['apiKey', 'bearer', 'oauth'],
      requestId: context.requestId
    };
  }
  
  throw error; // Not handled by this handler
};

/**
 * Demo service showcasing error handling functionality
 */
@Injectable()  
export class ErrorDemoService {
  
  /**
   * Operation that always throws a validation error
   */
  @McpTool({
    name: 'validation-error-demo',
    description: 'Demonstrates validation error handling'
  })
  @ErrorHandler(ValidationErrorHandler)
  async validationErrorDemo(
    @Input({ schema: z.string().min(5), description: 'Input must be at least 5 characters' }) _input: string
  ) {
    const { input } = this.extractArgs(arguments[0] as CallToolRequest);
    
    // Simulate validation error
    if (input.length < 5) {
      throw new ValidationError('Input too short', {
        field: 'input',
        expected: 'minimum 5 characters',
        actual: `${input.length} characters`,
        value: input
      });
    }
    
    return { result: `Valid input: ${input}` };
  }
  
  /**
   * Operation with multiple error handlers
   */
  @McpTool({
    name: 'multi-error-demo',
    description: 'Operation with multiple error handlers'
  })
  @ErrorHandlers([
    { handler: ValidationErrorHandler, options: { priority: 1 } },
    { handler: NetworkErrorHandler, options: { priority: 2 } },
    { handler: AuthErrorHandler, options: { priority: 3 } }
  ])
  async multiErrorDemo(
    @Input({ schema: z.enum(['validation', 'network', 'auth', 'success']), description: 'Error type to simulate' }) _errorType: string
  ) {
    const { errorType } = this.extractArgs(arguments[0] as CallToolRequest);
    
    switch (errorType) {
      case 'validation':
        throw new ValidationError('Simulated validation error', { field: 'errorType' });
      case 'network':
        throw new Error('Network timeout occurred');
      case 'auth':
        throw new AuthenticationError('Invalid API key provided');
      case 'success':
        return { result: 'Operation completed successfully!', type: errorType };
      default:
        throw new Error(`Unknown error type: ${errorType}`);
    }
  }
  
  /**
   * Operation with built-in graceful degradation
   */
  @McpTool({
    name: 'graceful-degradation-demo',
    description: 'Demonstrates graceful error degradation'
  })
  @ErrorHandler(BuiltinErrorHandlers.createGracefulDegradationHandler({
    result: 'Fallback data used due to error',
    source: 'cache'
  }))
  async gracefulDegradationDemo(
    @Input({ schema: z.boolean(), description: 'Whether to simulate an error' }) _shouldFail: boolean
  ) {
    const { shouldFail } = this.extractArgs(arguments[0] as CallToolRequest);
    
    if (shouldFail) {
      throw new Error('Simulated service failure');
    }
    
    return { 
      result: 'Normal operation result',
      source: 'live'
    };
  }
  
  /**
   * Operation with sanitizing error handler
   */
  @McpTool({
    name: 'sensitive-operation',
    description: 'Operation with sensitive data that needs error sanitization'
  })
  @ErrorHandler(BuiltinErrorHandlers.createSanitizingHandler(['password', 'apiKey', 'secret']))
  async sensitiveOperation(
    @Input({ schema: z.string(), description: 'API key (will be sanitized in errors)' }) _apiKey: string,
    @Input({ schema: z.string(), description: 'Sensitive data' }) _sensitiveData: string
  ) {
    const { apiKey, sensitiveData } = this.extractArgs(arguments[0] as CallToolRequest);
    
    if (apiKey !== 'valid-key') {
      throw new Error(`Invalid API key provided: ${apiKey}`);
    }
    
    if (sensitiveData.includes('fail')) {
      throw new Error(`Processing failed for data: ${sensitiveData}`);
    }
    
    return { 
      result: 'Sensitive operation completed',
      dataHash: this.simpleHash(sensitiveData)
    };
  }
  
  /**
   * Operation with inline error handler
   */
  @McpTool({
    name: 'inline-error-handler',
    description: 'Operation with inline error handling function'
  })
  @ErrorHandler((error, context) => {
    console.log('[INLINE] Custom inline error handler:', error.message);
    
    return {
      error: true,
      type: 'inline_handled',
      message: `Inline handler processed: ${error.message}`,
      method: context.methodName,
      timestamp: Date.now(),
      requestId: context.requestId,
      customField: 'This came from inline handler'
    };
  })
  async inlineErrorHandler(
    @Input({ schema: z.string(), description: 'Message that will cause an error' }) _message: string
  ) {
    const { message } = this.extractArgs(arguments[0] as CallToolRequest);
    
    throw new Error(`Custom error: ${message}`);
  }
  
  /**
   * Operation that handles specific error types
   */
  @McpTool({
    name: 'specific-error-handling',
    description: 'Handles only specific types of errors'
  })
  @ErrorHandler(ValidationErrorHandler)
  @ErrorHandler((error, context) => {
    // This handler only processes NotFoundError
    if (error instanceof NotFoundError) {
      return {
        error: true,
        type: 'not_found',
        message: 'The requested resource was not found',
        suggestions: ['Check the resource identifier', 'Verify resource exists'],
        requestId: context.requestId
      };
    }
    
    // Let other handlers process other errors
    throw error;
  }, { errorTypes: [NotFoundError] })
  async specificErrorHandling(
    @Input({ schema: z.enum(['validation', 'notfound', 'generic', 'success']), description: 'Type of error to throw' }) _errorType: string
  ) {
    const { errorType } = this.extractArgs(arguments[0] as CallToolRequest);
    
    switch (errorType) {
      case 'validation':
        throw new ValidationError('Validation failed for specific error demo');
      case 'notfound':
        throw new NotFoundError('Resource xyz not found');
      case 'generic':
        throw new Error('This is a generic error that should not be handled');
      case 'success':
        return { result: 'Operation completed without errors' };
      default:
        throw new Error(`Unknown error type: ${errorType}`);
    }
  }
  
  /**
   * Traditional operation without error handling (for comparison)
   */
  @McpTool({
    name: 'traditional-error-handling',
    description: 'Traditional operation without @ErrorHandler decorators',
    inputSchema: z.object({
      shouldFail: z.boolean()
    })
  })
  async traditionalErrorHandling(request: CallToolRequest) {
    const { shouldFail } = this.extractArgs(request);
    
    if (shouldFail) {
      throw new Error('Traditional error - no custom handling');
    }
    
    return { 
      result: 'Traditional operation completed successfully',
      errorHandling: 'none'
    };
  }

  /**
   * Helper method to extract arguments from CallToolRequest
   */
  private extractArgs(request: CallToolRequest): any {
    return request.params?.arguments || {};
  }
  
  /**
   * Simple hash function for demonstration
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}