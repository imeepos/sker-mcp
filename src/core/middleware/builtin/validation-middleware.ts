/**
 * Validation Middleware
 * 
 * Enterprise-grade validation middleware that provides automatic parameter validation
 * using Zod schemas with detailed error reporting and sanitization.
 */

import { Injectable, Inject } from '@sker/di';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { z, ZodSchema, ZodError } from 'zod';
import { LOGGER } from '../../tokens.js';
import type { IMiddleware, MiddlewareContext, NextFunction } from '../types.js';

/**
 * Logger interface for dependency injection
 */
interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Validation middleware configuration options
 */
export interface ValidationMiddlewareOptions {
  /**
   * Whether to strip unknown properties from validated objects
   */
  stripUnknown?: boolean;
  
  /**
   * Whether to coerce types during validation (e.g., string to number)
   */
  coerceTypes?: boolean;
  
  /**
   * Whether to validate request parameters
   */
  validateParams?: boolean;
  
  /**
   * Whether to validate response data
   */
  validateResponse?: boolean;
  
  /**
   * Whether to include detailed error paths in validation errors
   */
  includeErrorPaths?: boolean;
  
  /**
   * Whether to sanitize input data after validation
   */
  sanitizeInput?: boolean;
  
  /**
   * Custom error message for validation failures
   */
  customErrorMessage?: string;
  
  /**
   * Maximum depth for object validation
   */
  maxDepth?: number;
  
  /**
   * Whether to abort on first validation error or collect all errors
   */
  abortEarly?: boolean;
}

/**
 * Default validation middleware configuration
 */
const DEFAULT_OPTIONS: Required<ValidationMiddlewareOptions> = {
  stripUnknown: false,
  coerceTypes: true,
  validateParams: true,
  validateResponse: false,
  includeErrorPaths: true,
  sanitizeInput: true,
  customErrorMessage: '',
  maxDepth: 10,
  abortEarly: false
};

/**
 * Validation result with details
 */
export interface ValidationResult {
  isValid: boolean;
  data?: any;
  errors?: ValidationError[];
  warnings?: string[];
}

/**
 * Detailed validation error information
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  expected?: string;
  received?: any;
  path?: string[];
}

/**
 * Enterprise-grade validation middleware implementation
 */
@Injectable()
export class ValidationMiddleware implements IMiddleware {
  public readonly name = 'ValidationMiddleware';
  public readonly priority = 200; // Execute after logging but before business logic

  private readonly options: Required<ValidationMiddlewareOptions>;

  constructor(
    @Inject(LOGGER) private readonly logger: ILogger,
    options: ValidationMiddlewareOptions = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async execute(context: MiddlewareContext, next: NextFunction): Promise<any> {
    const { requestId, requestType, methodName } = context;

    try {
      // Validate request parameters if configured
      if (this.options.validateParams) {
        const validatedContext = await this.validateRequest(context);
        context = validatedContext;
      }

      // Execute the next middleware or handler
      const result = await next();

      // Validate response if configured
      if (this.options.validateResponse) {
        return await this.validateResponse(result, context);
      }

      return result;
    } catch (error) {
      if (this.isValidationError(error)) {
        // Convert validation errors to MCP errors
        const mcpError = this.createMcpValidationError(error, context);
        this.logger.warn(`[${requestId}] Validation failed for ${methodName}:`, mcpError);
        throw mcpError;
      }
      
      // Re-throw non-validation errors
      throw error;
    }
  }

  /**
   * Validate request parameters
   */
  private async validateRequest(context: MiddlewareContext): Promise<MiddlewareContext> {
    const { request, requestType, methodName } = context;
    
    if (!request || !('params' in request)) {
      return context;
    }

    // Get validation schema from metadata
    const schema = this.getValidationSchema(context);
    if (!schema) {
      return context;
    }

    try {
      // Validate parameters
      const validationResult = await this.validateWithSchema(
        request.params,
        schema,
        `${requestType}.${methodName}.params`
      );

      if (!validationResult.isValid) {
        const error = new Error('Parameter validation failed');
        (error as any).errors = validationResult.errors || [];
        throw error;
      }

      // Update context with validated data
      const updatedRequest = {
        ...request,
        params: validationResult.data
      };

      return {
        ...context,
        request: updatedRequest
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      const validationError = new Error(`Validation failed for ${requestType} ${methodName}`);
      (validationError as any).errors = [{ field: 'params', message: (error as any).message, code: 'VALIDATION_ERROR' }];
      throw validationError;
    }
  }

  /**
   * Validate response data
   */
  private async validateResponse(result: any, context: MiddlewareContext): Promise<any> {
    const { requestType, methodName } = context;
    
    // Get response schema from metadata
    const responseSchema = this.getResponseSchema(context);
    if (!responseSchema) {
      return result;
    }

    try {
      const validationResult = await this.validateWithSchema(
        result,
        responseSchema,
        `${requestType}.${methodName}.response`
      );

      if (!validationResult.isValid) {
        this.logger.error(
          `Response validation failed for ${methodName}:`,
          validationResult.errors
        );
        
        // Don't throw on response validation failure in production
        // Instead, log the error and return the original result
        return result;
      }

      return validationResult.data;
    } catch (error) {
      this.logger.error(`Response validation error for ${methodName}:`, error);
      return result;
    }
  }

  /**
   * Validate data with a Zod schema
   */
  private async validateWithSchema(
    data: any,
    schema: ZodSchema,
    path: string
  ): Promise<ValidationResult> {
    try {
      // Configure Zod parsing options
      const parseOptions: any = {
        errorMap: this.createCustomErrorMap(path)
      };

      if (!this.options.abortEarly) {
        parseOptions.async = true;
      }

      // Parse data with schema
      let parsedData;
      if (this.options.coerceTypes) {
        parsedData = await schema.parseAsync(data);
      } else {
        parsedData = schema.parse(data);
      }

      // Sanitize data if configured
      if (this.options.sanitizeInput) {
        parsedData = this.sanitizeData(parsedData);
      }

      return {
        isValid: true,
        data: parsedData
      };
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = this.convertZodErrors(error, path);
        return {
          isValid: false,
          errors: validationErrors
        };
      }

      throw error;
    }
  }

  /**
   * Get validation schema from context metadata
   */
  private getValidationSchema(context: MiddlewareContext): ZodSchema | null {
    if (!context.metadata) {
      return null;
    }

    // Look for inputSchema in metadata
    const inputSchema = context.metadata.inputSchema;
    if (inputSchema && this.isZodSchema(inputSchema)) {
      return inputSchema;
    }

    // Fallback to building schema from parameter definitions
    if (context.metadata.parameters) {
      return this.buildSchemaFromParameters(context.metadata.parameters);
    }

    return null;
  }

  /**
   * Get response schema from context metadata
   */
  private getResponseSchema(context: MiddlewareContext): ZodSchema | null {
    if (!context.metadata || !context.metadata.outputSchema) {
      return null;
    }

    const outputSchema = context.metadata.outputSchema;
    if (this.isZodSchema(outputSchema)) {
      return outputSchema;
    }

    return null;
  }

  /**
   * Check if an object is a Zod schema
   */
  private isZodSchema(obj: any): obj is ZodSchema {
    return obj && typeof obj === 'object' && typeof obj.parse === 'function';
  }

  /**
   * Build a Zod schema from parameter definitions
   */
  private buildSchemaFromParameters(parameters: any): ZodSchema | null {
    if (!parameters || typeof parameters !== 'object') {
      return null;
    }

    try {
      const schemaObject: any = {};
      
      for (const [key, paramDef] of Object.entries(parameters)) {
        if (paramDef && typeof paramDef === 'object') {
          const paramSchema = this.createSchemaFromDefinition(paramDef as any);
          if (paramSchema) {
            schemaObject[key] = paramSchema;
          }
        }
      }

      return z.object(schemaObject);
    } catch (error) {
      this.logger.warn('Failed to build schema from parameters:', error);
      return null;
    }
  }

  /**
   * Create a Zod schema from parameter definition
   */
  private createSchemaFromDefinition(definition: any): ZodSchema | null {
    if (!definition.type) {
      return null;
    }

    let schema: ZodSchema;

    switch (definition.type) {
      case 'string':
        schema = z.string();
        if (definition.minLength) schema = (schema as any).min(definition.minLength);
        if (definition.maxLength) schema = (schema as any).max(definition.maxLength);
        if (definition.pattern) schema = (schema as any).regex(new RegExp(definition.pattern));
        break;
        
      case 'number':
        schema = z.number();
        if (definition.minimum !== undefined) schema = (schema as any).min(definition.minimum);
        if (definition.maximum !== undefined) schema = (schema as any).max(definition.maximum);
        break;
        
      case 'integer':
        schema = z.number().int();
        if (definition.minimum !== undefined) schema = (schema as any).min(definition.minimum);
        if (definition.maximum !== undefined) schema = (schema as any).max(definition.maximum);
        break;
        
      case 'boolean':
        schema = z.boolean();
        break;
        
      case 'array':
        const itemSchema = definition.items ? this.createSchemaFromDefinition(definition.items) : z.any();
        schema = z.array(itemSchema || z.any());
        if (definition.minItems) schema = (schema as any).min(definition.minItems);
        if (definition.maxItems) schema = (schema as any).max(definition.maxItems);
        break;
        
      default:
        return null;
    }

    // Handle required vs optional
    if (!definition.required) {
      schema = schema.optional();
    }

    return schema;
  }

  /**
   * Convert Zod errors to validation errors
   */
  private convertZodErrors(zodError: ZodError, basePath: string): any[] {
    return zodError.errors.map(error => ({
      field: error.path.join('.') || 'root',
      message: error.message,
      code: error.code,
      expected: 'expected' in error ? (error as any).expected : undefined,
      received: 'received' in error ? (error as any).received : undefined,
      path: this.options.includeErrorPaths ? [basePath, ...error.path.map(String)] : undefined
    }));
  }

  /**
   * Create custom error map for Zod
   */
  private createCustomErrorMap(path: string) {
    return (error: any, ctx: any) => {
      switch (error.code) {
        case z.ZodIssueCode.invalid_type:
          return { message: `Expected ${error.expected} at ${path}, received ${error.received}` };
        case z.ZodIssueCode.too_small:
          return { message: `Value too small at ${path}: minimum ${error.minimum}` };
        case z.ZodIssueCode.too_big:
          return { message: `Value too large at ${path}: maximum ${error.maximum}` };
        default:
          return { message: ctx.defaultError };
      }
    };
  }

  /**
   * Sanitize validated data
   */
  private sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      // Basic string sanitization
      return data.trim();
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeData(value);
      }
      
      return sanitized;
    }

    return data;
  }

  /**
   * Check if an error is a validation error
   */
  private isValidationError(error: any): error is ValidationError {
    return error instanceof ValidationError || 
           (error && error.name === 'ValidationError');
  }

  /**
   * Create MCP error from validation error
   */
  private createMcpValidationError(error: any, context: MiddlewareContext): McpError {
    const message = this.options.customErrorMessage || 
                   `Validation failed for ${context.requestType} ${context.methodName}`;
    
    return new McpError(
      -32602,
      message,
      {
        validationErrors: error.errors,
        requestId: context.requestId,
        method: context.methodName
      }
    );
  }
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  public readonly name = 'ValidationError';
  
  constructor(
    message: string,
    public readonly errors: ValidationError[] = []
  ) {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

// /**
//  * Factory function to create validation middleware with custom options
//  */
// export function createValidationMiddleware(options: ValidationMiddlewareOptions = {}) {
//   class CustomValidationMiddleware extends ValidationMiddleware {
//     constructor(logger: ILogger) {
//       super(logger, options);
//     }
//   }
//   return CustomValidationMiddleware;
// }

/**
 * Predefined validation middleware variants
 */
@Injectable()
export class StrictValidationMiddleware extends ValidationMiddleware {
  constructor(@Inject(LOGGER) logger: ILogger) {
    super(logger, {
      stripUnknown: true,
      coerceTypes: false,
      validateParams: true,
      validateResponse: true,
      abortEarly: false
    });
  }
}

@Injectable()
export class LenientValidationMiddleware extends ValidationMiddleware {
  constructor(@Inject(LOGGER) logger: ILogger) {
    super(logger, {
      stripUnknown: false,
      coerceTypes: true,
      validateParams: true,
      validateResponse: false,
      abortEarly: true
    });
  }
}