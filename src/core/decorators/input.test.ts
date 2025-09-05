import 'reflect-metadata';
import { z } from 'zod';
import {
  Input,
  getParameterSchemas,
  buildInputSchemaFromParams,
  getParameterTypes,
  validateInputWithParams,
  type ParameterSchema,
  type InputOptions
} from './input';

describe('Input Decorator', () => {
  let mockTarget: any;
  let mockPropertyKey: string;

  beforeEach(() => {
    mockTarget = {};
    mockPropertyKey = 'testMethod';

    // Clear any existing metadata
    Reflect.deleteMetadata('param:schemas', mockTarget, mockPropertyKey);
    Reflect.deleteMetadata('param:names', mockTarget, mockPropertyKey);
  });

  describe('Basic Input Decorator', () => {
    it('should_apply_input_decorator_to_parameter', () => {
      const schema = z.string();
      const decorator = Input({ schema, description: 'Test parameter' });

      decorator(mockTarget, mockPropertyKey, 0);

      const schemas = getParameterSchemas(mockTarget, mockPropertyKey);
      expect(schemas).toHaveLength(1);
      expect(schemas[0]).toMatchObject({
        index: 0,
        name: 'param0',
        schema,
        description: 'Test parameter',
        required: true
      });
    });

    it('should_accept_zod_schema_directly', () => {
      const schema = z.number().min(0);
      const decorator = Input(schema);

      decorator(mockTarget, mockPropertyKey, 1);

      const schemas = getParameterSchemas(mockTarget, mockPropertyKey);
      expect(schemas[1]).toMatchObject({
        index: 1,
        schema,
        required: true
      });
    });

    it('should_handle_custom_parameter_name', () => {
      const schema = z.string();
      const decorator = Input({ 
        schema, 
        name: 'customName',
        description: 'Custom parameter'
      });

      decorator(mockTarget, mockPropertyKey, 0);

      const schemas = getParameterSchemas(mockTarget, mockPropertyKey);
      expect(schemas[0].name).toBe('customName');
    });

    it('should_handle_optional_parameters', () => {
      const schema = z.string();
      const decorator = Input({ 
        schema, 
        required: false,
        description: 'Optional parameter'
      });

      decorator(mockTarget, mockPropertyKey, 0);

      const schemas = getParameterSchemas(mockTarget, mockPropertyKey);
      expect(schemas[0].required).toBe(false);
    });

    it('should_default_to_required_parameters', () => {
      const schema = z.string();
      const decorator = Input({ schema });

      decorator(mockTarget, mockPropertyKey, 0);

      const schemas = getParameterSchemas(mockTarget, mockPropertyKey);
      expect(schemas[0].required).toBe(true);
    });

    it('should_handle_multiple_parameters', () => {
      const schema1 = z.string();
      const schema2 = z.number();
      const schema3 = z.boolean();

      const decorator1 = Input({ schema: schema1, name: 'param1' });
      const decorator2 = Input({ schema: schema2, name: 'param2' });
      const decorator3 = Input({ schema: schema3, name: 'param3', required: false });

      decorator1(mockTarget, mockPropertyKey, 0);
      decorator2(mockTarget, mockPropertyKey, 1);
      decorator3(mockTarget, mockPropertyKey, 2);

      const schemas = getParameterSchemas(mockTarget, mockPropertyKey);
      expect(schemas).toHaveLength(3);
      expect(schemas[0].name).toBe('param1');
      expect(schemas[1].name).toBe('param2');
      expect(schemas[2].name).toBe('param3');
      expect(schemas[2].required).toBe(false);
    });
  });

  describe('Parameter Schema Utilities', () => {
    beforeEach(() => {
      // Set up some test schemas
      const decorator1 = Input({ 
        schema: z.string().min(1), 
        name: 'name',
        description: 'User name'
      });
      const decorator2 = Input({ 
        schema: z.number().min(0), 
        name: 'age',
        description: 'User age'
      });
      const decorator3 = Input({ 
        schema: z.string(), 
        name: 'email',
        required: false,
        description: 'User email'
      });

      decorator1(mockTarget, mockPropertyKey, 0);
      decorator2(mockTarget, mockPropertyKey, 1);
      decorator3(mockTarget, mockPropertyKey, 2);
    });

    it('should_return_empty_array_for_no_schemas', () => {
      const schemas = getParameterSchemas({}, 'nonExistentMethod');
      expect(schemas).toEqual([]);
    });

    it('should_build_combined_zod_schema_from_parameters', () => {
      const schemas = getParameterSchemas(mockTarget, mockPropertyKey);
      const combinedSchema = buildInputSchemaFromParams(schemas);

      // Test valid input
      const validInput = {
        name: 'John',
        age: 25,
        email: 'john@example.com'
      };

      expect(() => combinedSchema.parse(validInput)).not.toThrow();

      // Test invalid input
      const invalidInput = {
        name: '', // Too short
        age: -1,  // Below minimum
        email: 'john@example.com'
      };

      expect(() => combinedSchema.parse(invalidInput)).toThrow();
    });

    it('should_handle_optional_parameters_in_schema_building', () => {
      const schemas = getParameterSchemas(mockTarget, mockPropertyKey);
      const combinedSchema = buildInputSchemaFromParams(schemas);

      // Test input without optional parameter
      const inputWithoutOptional = {
        name: 'John',
        age: 25
        // email is optional, so it's not required
      };

      expect(() => combinedSchema.parse(inputWithoutOptional)).not.toThrow();
    });

    it('should_validate_input_with_parameter_schemas', () => {
      const schemas = getParameterSchemas(mockTarget, mockPropertyKey);

      // Valid input
      const validInput = {
        name: 'John',
        age: 25,
        email: 'john@example.com'
      };

      const validResult = validateInputWithParams(validInput, schemas);
      expect(validResult.success).toBe(true);
      if (validResult.success) {
        expect(validResult.data).toEqual(validInput);
      }

      // Invalid input
      const invalidInput = {
        name: '', // Invalid
        age: 25
      };

      const invalidResult = validateInputWithParams(invalidInput, schemas);
      expect(invalidResult.success).toBe(false);
      if (!invalidResult.success) {
        expect(invalidResult.error).toBeInstanceOf(z.ZodError);
      }
    });
  });

  describe('Parameter Types Reflection', () => {
    it('should_return_empty_array_for_no_parameter_types', () => {
      const types = getParameterTypes(mockTarget, mockPropertyKey);
      expect(types).toEqual([]);
    });

    it('should_get_parameter_types_when_available', () => {
      // Mock parameter types metadata
      Reflect.defineMetadata('design:paramtypes', [String, Number, Boolean], mockTarget, mockPropertyKey);

      const types = getParameterTypes(mockTarget, mockPropertyKey);
      expect(types).toEqual([String, Number, Boolean]);
    });
  });

  describe('Schema Building Edge Cases', () => {
    it('should_handle_empty_parameter_schemas', () => {
      const schema = buildInputSchemaFromParams([]);
      expect(() => schema.parse({})).not.toThrow();
    });

    it('should_handle_sparse_parameter_arrays', () => {
      const schemas: ParameterSchema[] = [];
      schemas[0] = {
        index: 0,
        name: 'param0',
        schema: z.string(),
        required: true
      };
      schemas[2] = {
        index: 2,
        name: 'param2',
        schema: z.number(),
        required: false
      };
      // schemas[1] is undefined

      const combinedSchema = buildInputSchemaFromParams(schemas);
      
      const validInput = {
        param0: 'test',
        param2: 42
      };

      expect(() => combinedSchema.parse(validInput)).not.toThrow();
    });

    it('should_handle_parameters_without_names', () => {
      const schemas: ParameterSchema[] = [{
        index: 0,
        schema: z.string(),
        required: true
        // name is undefined
      }];

      const combinedSchema = buildInputSchemaFromParams(schemas);
      
      // Should not include parameters without names
      expect(() => combinedSchema.parse({})).not.toThrow();
    });
  });

  describe('Complex Schema Validation', () => {
    it('should_handle_complex_zod_schemas', () => {
      const complexSchema = z.object({
        nested: z.object({
          value: z.string()
        }),
        array: z.array(z.number()),
        union: z.union([z.string(), z.number()])
      });

      const decorator = Input({ 
        schema: complexSchema,
        name: 'complexParam',
        description: 'Complex parameter'
      });

      decorator(mockTarget, mockPropertyKey, 0);

      const schemas = getParameterSchemas(mockTarget, mockPropertyKey);
      expect(schemas[0].schema).toBe(complexSchema);

      const combinedSchema = buildInputSchemaFromParams(schemas);
      
      const validInput = {
        complexParam: {
          nested: { value: 'test' },
          array: [1, 2, 3],
          union: 'string value'
        }
      };

      expect(() => combinedSchema.parse(validInput)).not.toThrow();
    });

    it('should_handle_schema_transformations', () => {
      const transformSchema = z.string().transform(val => val.toUpperCase());
      
      const decorator = Input({ 
        schema: transformSchema,
        name: 'transformParam'
      });

      decorator(mockTarget, mockPropertyKey, 0);

      const schemas = getParameterSchemas(mockTarget, mockPropertyKey);
      const result = validateInputWithParams({ transformParam: 'hello' }, schemas);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transformParam).toBe('HELLO');
      }
    });
  });

  describe('Error Handling', () => {
    it('should_return_zod_error_for_validation_failures', () => {
      const schemas: ParameterSchema[] = [{
        index: 0,
        name: 'param0',
        schema: z.string().min(5),
        required: true
      }];

      const result = validateInputWithParams({ param0: 'abc' }, schemas);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(z.ZodError);
      }
    });

    it('should_handle_missing_required_parameters', () => {
      const schemas: ParameterSchema[] = [{
        index: 0,
        name: 'param0',
        schema: z.string(),
        required: true
      }];

      const result = validateInputWithParams({}, schemas);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(z.ZodError);
        expect(result.error.issues[0].code).toBe('invalid_type');
      }
    });
  });
});
