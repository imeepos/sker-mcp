/**
 * Calculator Service Example
 * 
 * Demonstrates the usage of @Input parameter decorators with @McpTool
 * for automatic schema generation and parameter validation.
 */

import { z } from 'zod';
import { Injectable } from '@sker/di';
import { McpTool, Input } from '../core/decorators/index.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

/**
 * Calculator service demonstrating @Input decorator usage
 */
@Injectable()
export class CalculatorService {
  
  /**
   * Basic arithmetic calculator with @Input decorators
   */
  @McpTool({
    name: 'calculate',
    description: 'Perform basic arithmetic operations with automatic parameter validation'
  })
  async calculate(
    @Input({ 
      schema: z.number().min(-1000000).max(1000000), 
      description: 'First number for calculation' 
    }) _a: number,
    @Input({ 
      schema: z.number().min(-1000000).max(1000000), 
      description: 'Second number for calculation' 
    }) _b: number,
    @Input({ 
      schema: z.enum(['add', 'subtract', 'multiply', 'divide']), 
      description: 'Operation to perform',
      required: false 
    }) _operation: string = 'add'
  ) {
    const { a: numA, b: numB, operation: op } = this.extractArgs(arguments[0] as CallToolRequest);
    
    switch (op || 'add') {
      case 'add':
        return { result: numA + numB, operation: 'addition' };
      case 'subtract':
        return { result: numA - numB, operation: 'subtraction' };
      case 'multiply':
        return { result: numA * numB, operation: 'multiplication' };
      case 'divide':
        if (numB === 0) {
          throw new Error('Division by zero is not allowed');
        }
        return { result: numA / numB, operation: 'division' };
      default:
        throw new Error(`Unsupported operation: ${op}`);
    }
  }

  /**
   * Advanced calculation with optional parameters
   */
  @McpTool({
    name: 'power-calculation',
    description: 'Calculate power with optional precision setting'
  })
  async powerCalculation(
    @Input({ 
      schema: z.number().min(-1000).max(1000), 
      description: 'Base number' 
    }) _base: number,
    @Input({ 
      schema: z.number().int().min(-10).max(10), 
      description: 'Exponent' 
    }) _exponent: number,
    @Input({ 
      schema: z.number().int().min(0).max(10), 
      description: 'Decimal precision for result',
      required: false 
    }) _precision?: number
  ) {
    const { base: b, exponent: exp, precision: prec } = this.extractArgs(arguments[0] as CallToolRequest);
    
    const result = Math.pow(b, exp);
    const finalResult = prec !== undefined ? parseFloat(result.toFixed(prec)) : result;
    
    return {
      base: b,
      exponent: exp,
      result: finalResult,
      precision: prec || 'default'
    };
  }

  /**
   * String manipulation example
   */
  @McpTool({
    name: 'text-transform',
    description: 'Transform text with various operations'
  })
  async textTransform(
    @Input({ 
      schema: z.string().min(1).max(1000), 
      description: 'Input text to transform' 
    }) _text: string,
    @Input({ 
      schema: z.enum(['uppercase', 'lowercase', 'reverse', 'length']), 
      description: 'Transformation to apply' 
    }) _transform: string,
    @Input({ 
      schema: z.boolean(), 
      description: 'Whether to trim whitespace',
      required: false 
    }) _trim?: boolean
  ) {
    const { text: inputText, transform: operation, trim: shouldTrim } = this.extractArgs(arguments[0] as CallToolRequest);
    
    let result = shouldTrim ? inputText.trim() : inputText;
    
    switch (operation) {
      case 'uppercase':
        result = result.toUpperCase();
        break;
      case 'lowercase':
        result = result.toLowerCase();
        break;
      case 'reverse':
        result = result.split('').reverse().join('');
        break;
      case 'length':
        return { originalText: inputText, length: result.length, trimmed: shouldTrim };
      default:
        throw new Error(`Unsupported transformation: ${operation}`);
    }
    
    return {
      originalText: inputText,
      transformedText: result,
      operation,
      trimmed: shouldTrim
    };
  }

  /**
   * Traditional @McpTool usage with explicit schema (for comparison)
   */
  @McpTool({
    name: 'traditional-calc',
    description: 'Traditional calculator with explicit schema definition',
    inputSchema: z.object({
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
      op: z.enum(['add', 'subtract']).optional()
    })
  })
  async traditionalCalculate(request: CallToolRequest) {
    const { x, y, op = 'add' } = this.extractArgs(request);
    
    return {
      result: op === 'add' ? x + y : x - y,
      operation: op,
      note: 'This uses traditional explicit schema definition'
    };
  }

  /**
   * Helper method to extract arguments from CallToolRequest
   */
  private extractArgs(request: CallToolRequest): any {
    return request.params?.arguments || {};
  }
}