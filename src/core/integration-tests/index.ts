/**
 * Integration Tests Index
 * 
 * Entry point for all integration tests in the Sker Daemon MCP system.
 * These tests validate the complete system functionality including all
 * major components working together.
 */

// Import all integration test suites
import './system-integration.test.js';
import './plugin-system.test.js';

/**
 * Integration Test Utilities
 */
export class IntegrationTestUtils {
  /**
   * Setup test environment
   */
  static async setupTestEnvironment(): Promise<void> {
    // Common test environment setup
    process.env.NODE_ENV = 'testing';
    process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
  }

  /**
   * Cleanup test environment
   */
  static async cleanupTestEnvironment(): Promise<void> {
    // Common test environment cleanup
    delete process.env.NODE_ENV;
    delete process.env.LOG_LEVEL;
  }

  /**
   * Create mock MCP request
   */
  static createMockMcpRequest(
    method: string,
    toolName: string,
    args: Record<string, any>
  ): any {
    return {
      method,
      params: {
        name: toolName,
        arguments: args
      },
      id: Math.random().toString(36).substring(7)
    };
  }

  /**
   * Wait for async operations to complete
   */
  static async waitForAsyncOperations(ms: number = 100): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create test timeout wrapper
   */
  static withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(`Test timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }
}

/**
 * Integration Test Configuration
 */
export const IntegrationTestConfig = {
  defaultTimeout: 10000, // 10 seconds
  pluginLoadTimeout: 5000, // 5 seconds
  conflictDetectionTimeout: 2000, // 2 seconds
  maxPluginsForPerformanceTest: 50,
  maxConflictsForResolutionTest: 20
};