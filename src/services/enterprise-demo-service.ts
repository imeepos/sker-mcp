/**
 * Enterprise Demo Service
 * 
 * This service demonstrates the usage of all enterprise-grade middleware
 * in various combinations and configurations.
 */

import { Injectable } from '@sker/di';
import { z } from 'zod';
import { McpTool, Input, UseMiddleware } from '../core/decorators/index.js';
import {
  LoggingMiddleware,
  ValidationMiddleware, 
  CacheMiddleware,
  AuthenticationMiddleware,
  PerformanceMiddleware,
  ErrorHandlingMiddleware,
  BuiltinMiddlewareFactory,
  VerboseLoggingMiddleware,
  StrictValidationMiddleware,
  LongTermCacheMiddleware,
  StrictAuthenticationMiddleware,
  DetailedPerformanceMiddleware,
  ResilientErrorHandlingMiddleware
} from '../core/middleware/index.js';

/**
 * Enterprise demo service showcasing middleware usage
 */
@Injectable()
export class EnterpriseDemoService {
  
  /**
   * Basic tool with standard middleware stack
   */
  @McpTool({
    name: 'enterprise-basic-operation',
    description: 'A basic operation with standard enterprise middleware stack'
  })
  @UseMiddleware(...BuiltinMiddlewareFactory.createEnterpriseStack())
  async basicOperation(
    @Input(z.object({
      message: z.string().min(1).max(100),
      priority: z.enum(['low', 'medium', 'high']).default('medium')
    })) params: {
      message: string;
      priority: 'low' | 'medium' | 'high';
    }
  ) {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      content: [
        {
          type: 'text',
          text: `Processed message: "${params.message}" with priority: ${params.priority}`
        }
      ],
      metadata: {
        processedAt: new Date().toISOString(),
        priority: params.priority
      }
    };
  }

  /**
   * Secure operation with strict middleware configuration
   */
  @McpTool({
    name: 'enterprise-secure-operation',
    description: 'A secure operation requiring authentication with strict validation'
  })
  @UseMiddleware(
    StrictAuthenticationMiddleware,
    StrictValidationMiddleware,
    VerboseLoggingMiddleware,
    DetailedPerformanceMiddleware,
    ResilientErrorHandlingMiddleware
  )
  async secureOperation(
    @Input(z.object({
      action: z.enum(['read', 'write', 'delete']),
      resourceId: z.string().uuid(),
      data: z.object({
        title: z.string().min(3).max(50),
        content: z.string().max(1000).optional(),
        tags: z.array(z.string()).max(10).optional()
      }).optional()
    })) params: {
      action: 'read' | 'write' | 'delete';
      resourceId: string;
      data?: {
        title: string;
        content?: string;
        tags?: string[];
      };
    }
  ) {
    // Simulate database operation
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return {
      content: [
        {
          type: 'text',
          text: `${params.action.toUpperCase()} operation completed on resource: ${params.resourceId}`
        }
      ],
      result: {
        action: params.action,
        resourceId: params.resourceId,
        timestamp: new Date().toISOString(),
        success: true
      }
    };
  }

  /**
   * Cached operation for expensive computations
   */
  @McpTool({
    name: 'enterprise-expensive-computation',
    description: 'An expensive computation that benefits from caching'
  })
  @UseMiddleware(
    ValidationMiddleware,
    LongTermCacheMiddleware,
    LoggingMiddleware,
    PerformanceMiddleware,
    ErrorHandlingMiddleware
  )
  async expensiveComputation(
    @Input(z.object({
      algorithm: z.enum(['fibonacci', 'prime', 'factorial']),
      input: z.number().min(1).max(100),
      precision: z.number().min(1).max(10).default(2)
    })) params: {
      algorithm: 'fibonacci' | 'prime' | 'factorial';
      input: number;
      precision: number;
    }
  ) {
    // Simulate expensive computation
    const computationTime = Math.random() * 2000 + 1000; // 1-3 seconds
    await new Promise(resolve => setTimeout(resolve, computationTime));
    
    let result: number;
    
    switch (params.algorithm) {
      case 'fibonacci':
        result = this.fibonacci(params.input);
        break;
      case 'prime':
        result = this.isPrime(params.input) ? 1 : 0;
        break;
      case 'factorial':
        result = this.factorial(params.input);
        break;
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `${params.algorithm}(${params.input}) = ${result.toFixed(params.precision)}`
        }
      ],
      computation: {
        algorithm: params.algorithm,
        input: params.input,
        result,
        computationTime: computationTime,
        precision: params.precision,
        cached: false // Will be true on subsequent calls due to caching
      }
    };
  }

  /**
   * Error-prone operation to demonstrate error handling
   */
  @McpTool({
    name: 'enterprise-error-prone-operation',
    description: 'An operation that may fail to demonstrate error handling and retry mechanisms'
  })
  @UseMiddleware(
    ValidationMiddleware,
    LoggingMiddleware,
    PerformanceMiddleware,
    ResilientErrorHandlingMiddleware // Includes retry and circuit breaker
  )
  async errorProneOperation(
    @Input(z.object({
      failureRate: z.number().min(0).max(1).default(0.3),
      errorType: z.enum(['validation', 'timeout', 'system', 'network']).default('system'),
      retryable: z.boolean().default(true)
    })) params: {
      failureRate: number;
      errorType: 'validation' | 'timeout' | 'system' | 'network';
      retryable: boolean;
    }
  ) {
    // Simulate potential failure
    if (Math.random() < params.failureRate) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work before failure
      
      switch (params.errorType) {
        case 'validation':
          throw new Error('Validation failed: Invalid data format');
        case 'timeout':
          throw new Error('Request timeout: Operation took too long');
        case 'network':
          throw new Error('Network error: Connection failed');
        case 'system':
        default:
          throw new Error('System error: Internal server error');
      }
    }
    
    // Simulate successful operation
    await new Promise(resolve => setTimeout(resolve, 150));
    
    return {
      content: [
        {
          type: 'text',
          text: `Operation completed successfully despite ${Math.round(params.failureRate * 100)}% failure rate`
        }
      ],
      result: {
        success: true,
        failureRate: params.failureRate,
        errorType: params.errorType,
        retryable: params.retryable,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Bulk operation with performance monitoring
   */
  @McpTool({
    name: 'enterprise-bulk-operation',
    description: 'A bulk operation that processes multiple items with performance monitoring'
  })
  @UseMiddleware(
    ValidationMiddleware,
    CacheMiddleware,
    LoggingMiddleware,
    DetailedPerformanceMiddleware,
    ErrorHandlingMiddleware
  )
  async bulkOperation(
    @Input(z.object({
      items: z.array(z.object({
        id: z.string(),
        data: z.string().min(1).max(1000)
      })).min(1).max(100),
      batchSize: z.number().min(1).max(50).default(10),
      delayMs: z.number().min(0).max(1000).default(50)
    })) params: {
      items: Array<{ id: string; data: string }>;
      batchSize: number;
      delayMs: number;
    }
  ) {
    const results = [];
    const totalItems = params.items.length;
    const batches = Math.ceil(totalItems / params.batchSize);
    
    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const start = batchIndex * params.batchSize;
      const end = Math.min(start + params.batchSize, totalItems);
      const batch = params.items.slice(start, end);
      
      // Process batch
      const batchResults = await Promise.all(
        batch.map(async (item) => {
          await new Promise(resolve => setTimeout(resolve, params.delayMs));
          return {
            id: item.id,
            processed: true,
            dataLength: item.data.length,
            processedAt: new Date().toISOString()
          };
        })
      );
      
      results.push(...batchResults);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `Bulk operation completed: processed ${totalItems} items in ${batches} batches`
        }
      ],
      summary: {
        totalItems,
        batches,
        batchSize: params.batchSize,
        results,
        completedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Development-friendly operation (minimal middleware)
   */
  @McpTool({
    name: 'enterprise-dev-operation',
    description: 'A development-friendly operation with minimal middleware for debugging'
  })
  @UseMiddleware(...BuiltinMiddlewareFactory.createDevelopmentStack())
  async developmentOperation(
    @Input(z.object({
      debug: z.boolean().default(true),
      verbose: z.boolean().default(true),
      data: z.any()
    })) params: {
      debug: boolean;
      verbose: boolean;
      data: any;
    }
  ) {
    const startTime = Date.now();
    
    // Simulate some processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const endTime = Date.now();
    
    const response: any = {
      content: [
        {
          type: 'text',
          text: 'Development operation completed with detailed debugging information'
        }
      ]
    };
    
    if (params.debug) {
      response.debug = {
        executionTime: endTime - startTime,
        inputData: params.data,
        verbose: params.verbose,
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage()
      };
    }
    
    return response;
  }

  // Helper methods for computations
  private fibonacci(n: number): number {
    if (n <= 1) return n;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }

  private isPrime(n: number): boolean {
    if (n < 2) return false;
    for (let i = 2; i <= Math.sqrt(n); i++) {
      if (n % i === 0) return false;
    }
    return true;
  }

  private factorial(n: number): number {
    if (n <= 1) return 1;
    return n * this.factorial(n - 1);
  }
}