/**
 * Middleware Demo Service
 * 
 * Demonstrates the usage of @UseMiddleware decorator with various middleware
 * configurations including built-in middleware and custom middleware.
 */

import { z } from 'zod';
import { Injectable } from '@sker/di';
import { McpTool, Input, UseMiddleware, UseMiddlewares } from '../core/decorators/index.js';
import { BuiltinMiddlewares } from '../core/decorators/use-middleware.js';
import type { 
  MiddlewareFunction, 
  IMiddleware, 
  MiddlewareContext, 
  NextFunction 
} from '../core/middleware/index.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

/**
 * Custom authentication middleware class
 */
class AuthenticationMiddleware implements IMiddleware {
  name = 'authentication';
  priority = 1;

  async execute(context: MiddlewareContext, next: NextFunction): Promise<any> {
    console.log('[AUTH] Checking authentication for', context.methodName);
    
    // Simple auth check (in real implementation, check tokens/headers)
    const args = context.args || {};
    if (args.apiKey !== 'demo-key') {
      throw new Error('Authentication failed: invalid API key');
    }
    
    console.log('[AUTH] Authentication successful');
    return await next();
  }
}

/**
 * Custom validation middleware function
 */
const ValidationMiddleware: MiddlewareFunction = async (context, next) => {
  console.log('[VALIDATION] Validating request for', context.methodName);
  
  const args = context.args || {};
  if (typeof args !== 'object' || args === null) {
    throw new Error('Validation failed: arguments must be an object');
  }
  
  console.log('[VALIDATION] Request validation passed');
  return await next();
};

/**
 * Caching middleware function
 */
const CachingMiddleware: MiddlewareFunction = async (context, next) => {
  const cacheKey = `${context.methodName}_${JSON.stringify(context.args)}`;
  console.log('[CACHE] Checking cache for', cacheKey);
  
  // In real implementation, check actual cache
  console.log('[CACHE] Cache miss, executing method');
  const result = await next();
  
  console.log('[CACHE] Caching result for', cacheKey);
  return result;
};

/**
 * Demo service showcasing middleware functionality
 */
@Injectable()
export class MiddlewareDemoService {
  
  /**
   * Simple operation with logging middleware
   */
  @McpTool({
    name: 'simple-operation',
    description: 'A simple operation with logging middleware'
  })
  @UseMiddleware(BuiltinMiddlewares.createLoggingMiddleware({ prefix: 'DEMO' }))
  async simpleOperation(
    @Input({ schema: z.string(), description: 'Input message' }) _message: string
  ) {
    const { message } = this.extractArgs(arguments[0] as CallToolRequest);
    return { result: `Processed: ${message}`, timestamp: new Date().toISOString() };
  }
  
  /**
   * Timed operation with timing middleware
   */
  @McpTool({
    name: 'timed-operation',
    description: 'Operation with timing middleware to measure performance'
  })
  @UseMiddleware(
    BuiltinMiddlewares.createTimingMiddleware(),
    { priority: 1 }
  )
  async timedOperation(
    @Input({ schema: z.number().min(100).max(5000), description: 'Delay in milliseconds' }) _delay: number
  ) {
    const { delay } = this.extractArgs(arguments[0] as CallToolRequest);
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return { 
      result: 'Operation completed', 
      processingTime: delay,
      message: 'This operation was timed by middleware'
    };
  }

  /**
   * Secure operation with authentication and validation
   */
  @McpTool({
    name: 'secure-operation',
    description: 'Secure operation requiring authentication and validation'
  })
  @UseMiddleware(AuthenticationMiddleware, ValidationMiddleware)
  async secureOperation(
    @Input({ schema: z.string(), description: 'API key for authentication' }) _apiKey: string,
    @Input({ schema: z.string().min(1), description: 'Data to process' }) _data: string
  ) {
    const { apiKey, data } = this.extractArgs(arguments[0] as CallToolRequest);
    
    return { 
      result: `Securely processed: ${data}`,
      authenticated: true,
      apiKey: apiKey.substring(0, 4) + '****'
    };
  }

  /**
   * Complex operation with multiple middleware using UseMiddlewares
   */
  @McpTool({
    name: 'complex-operation',
    description: 'Complex operation with multiple middleware in specific order'
  })
  @UseMiddlewares([
    { 
      middleware: BuiltinMiddlewares.createLoggingMiddleware({ prefix: 'COMPLEX' }), 
      options: { priority: 1 } 
    },
    { 
      middleware: AuthenticationMiddleware, 
      options: { priority: 2 } 
    },
    { 
      middleware: ValidationMiddleware, 
      options: { priority: 3 } 
    },
    { 
      middleware: CachingMiddleware, 
      options: { priority: 4 } 
    },
    { 
      middleware: BuiltinMiddlewares.createTimingMiddleware(), 
      options: { priority: 5 } 
    }
  ])
  async complexOperation(
    @Input({ schema: z.string(), description: 'API key for authentication' }) _apiKey: string,
    @Input({ 
      schema: z.object({
        operation: z.enum(['calculate', 'transform', 'analyze']),
        data: z.array(z.number()),
        options: z.object({
          precision: z.number().optional(),
          format: z.string().optional()
        }).optional()
      }), 
      description: 'Complex operation parameters' 
    }) _params: any
  ) {
    const { apiKey, params } = this.extractArgs(arguments[0] as CallToolRequest);
    
    // Simulate complex processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    let result: any;
    switch (params.operation) {
      case 'calculate':
        result = params.data.reduce((sum: number, val: number) => sum + val, 0);
        break;
      case 'transform':
        result = params.data.map((val: number) => val * 2);
        break;
      case 'analyze':
        result = {
          count: params.data.length,
          sum: params.data.reduce((sum: number, val: number) => sum + val, 0),
          average: params.data.length > 0 ? params.data.reduce((sum: number, val: number) => sum + val, 0) / params.data.length : 0
        };
        break;
      default:
        throw new Error(`Unsupported operation: ${params.operation}`);
    }
    
    return {
      operation: params.operation,
      result,
      processedData: params.data,
      options: params.options || {},
      authenticated: true,
      apiKey: apiKey.substring(0, 4) + '****',
      middleware: 'All middleware executed successfully'
    };
  }

  /**
   * Traditional operation without middleware (for comparison)
   */
  @McpTool({
    name: 'traditional-operation',
    description: 'Traditional operation without any middleware',
    inputSchema: z.object({
      message: z.string()
    })
  })
  async traditionalOperation(request: CallToolRequest) {
    const { message } = this.extractArgs(request);
    console.log('Traditional operation called directly without middleware');
    
    return { 
      result: `Traditionally processed: ${message}`,
      middleware: 'No middleware applied'
    };
  }

  /**
   * Helper method to extract arguments from CallToolRequest
   */
  private extractArgs(request: CallToolRequest): any {
    return request.params?.arguments || {};
  }
}