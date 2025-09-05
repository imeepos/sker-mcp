/**
 * Input Parameter Decorator
 * 
 * This decorator provides parameter-level schema validation for MCP tool methods.
 * It allows individual parameters to have their own validation schemas and 
 * integrates with the existing @McpTool decorator system.
 */

import 'reflect-metadata';
import { z } from 'zod';

/**
 * Metadata key for storing parameter schemas
 */
const PARAM_SCHEMAS_KEY = 'param:schemas';

/**
 * Metadata key for storing parameter names
 */
const PARAM_NAMES_KEY = 'param:names';

/**
 * Metadata key for storing parameter types
 */
const PARAM_TYPES_KEY = 'design:paramtypes';

/**
 * Parameter schema information
 */
export interface ParameterSchema {
  /**
   * Parameter index in the method signature
   */
  index: number;
  
  /**
   * Parameter name (if available)
   */
  name?: string | undefined;
  
  /**
   * Zod schema for validation
   */
  schema: z.ZodSchema<any>;
  
  /**
   * Optional description for the parameter
   */
  description?: string | undefined;
  
  /**
   * Whether the parameter is required
   */
  required?: boolean | undefined;
}

/**
 * Options for the @Input decorator
 */
export interface InputOptions {
  /**
   * Zod schema for parameter validation
   */
  schema: z.ZodSchema<any>;
  
  /**
   * Optional description for the parameter
   */
  description?: string | undefined;
  
  /**
   * Override parameter name (useful for complex parameter mapping)
   */
  name?: string | undefined;
  
  /**
   * Whether the parameter is required (defaults to true)
   */
  required?: boolean | undefined;
}

/**
 * @Input decorator for parameter-level schema validation
 * 
 * This decorator stores validation schemas for individual method parameters,
 * which can then be used by the @McpTool decorator to build comprehensive
 * input validation schemas.
 * 
 * @param options - Input validation options or Zod schema directly
 * @returns Parameter decorator
 * 
 * @example
 * ```typescript
 * class CalculatorService {
 *   @McpTool({
 *     name: 'calculate',
 *     description: 'Perform calculation'
 *   })
 *   calculate(
 *     @Input({ schema: z.number().min(0), description: 'First number' }) a: number,
 *     @Input({ schema: z.number().min(0), description: 'Second number' }) b: number,
 *     @Input({ schema: z.enum(['add', 'subtract']), required: false }) operation: string = 'add'
 *   ) {
 *     return operation === 'add' ? a + b : a - b;
 *   }
 * }
 * ```
 */
export function Input(options: InputOptions | z.ZodSchema<any>) {
  return function (target: any, propertyKey: string | symbol, parameterIndex: number) {
    // Normalize options
    const normalizedOptions: InputOptions = isZodSchema(options) 
      ? { schema: options }
      : options;
    
    // Get existing parameter schemas for this method
    const existingSchemas: ParameterSchema[] = Reflect.getMetadata(PARAM_SCHEMAS_KEY, target, propertyKey) || [];
    
    // Get parameter names if available (from TypeScript compilation or other sources)
    const paramNames: string[] = Reflect.getMetadata(PARAM_NAMES_KEY, target, propertyKey) || [];
    
    // Create parameter schema entry
    const paramSchema: ParameterSchema = {
      index: parameterIndex,
      name: normalizedOptions.name || paramNames[parameterIndex] || `param${parameterIndex}`,
      schema: normalizedOptions.schema,
      description: normalizedOptions.description,
      required: normalizedOptions.required !== false // Default to true unless explicitly false
    };
    
    // Store the schema at the correct index
    existingSchemas[parameterIndex] = paramSchema;
    
    // Store updated schemas
    Reflect.defineMetadata(PARAM_SCHEMAS_KEY, existingSchemas, target, propertyKey);
  };
}

/**
 * Utility function to check if an object is a Zod schema
 */
function isZodSchema(obj: any): obj is z.ZodSchema<any> {
  return obj && typeof obj === 'object' && typeof obj.parse === 'function';
}

/**
 * Utility function to get parameter schemas for a method
 * 
 * @param target - Class instance or constructor
 * @param propertyKey - Method name
 * @returns Array of parameter schemas
 */
export function getParameterSchemas(target: any, propertyKey: string | symbol): ParameterSchema[] {
  return Reflect.getMetadata(PARAM_SCHEMAS_KEY, target, propertyKey) || [];
}

/**
 * Builds a combined Zod object schema from parameter schemas
 * 
 * This function is used by the @McpTool decorator to create a comprehensive
 * input validation schema from individual parameter schemas.
 * 
 * @param paramSchemas - Array of parameter schemas
 * @returns Combined Zod object schema
 */
export function buildInputSchemaFromParams(paramSchemas: ParameterSchema[]): z.ZodObject<any> {
  const schemaObject: Record<string, z.ZodSchema<any>> = {};
  
  for (const paramSchema of paramSchemas) {
    if (paramSchema && paramSchema.name) {
      // Apply required/optional modifier
      const schema = paramSchema.required !== false 
        ? paramSchema.schema 
        : paramSchema.schema.optional();
      
      schemaObject[paramSchema.name] = schema;
    }
  }
  
  return z.object(schemaObject);
}

/**
 * Gets the parameter types from TypeScript reflection
 * 
 * @param target - Class instance or constructor
 * @param propertyKey - Method name
 * @returns Array of parameter constructor types
 */
export function getParameterTypes(target: any, propertyKey: string | symbol): any[] {
  return Reflect.getMetadata(PARAM_TYPES_KEY, target, propertyKey) || [];
}

/**
 * Validates input against parameter schemas
 * 
 * @param input - Input object to validate
 * @param paramSchemas - Parameter schemas for validation
 * @returns Validation result with parsed data or error
 */
export function validateInputWithParams(
  input: any, 
  paramSchemas: ParameterSchema[]
): { success: true; data: any } | { success: false; error: z.ZodError } {
  try {
    const schema = buildInputSchemaFromParams(paramSchemas);
    const result = schema.parse(input);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error };
    }
    throw error;
  }
}