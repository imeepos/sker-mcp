/**
 * HTTP Server Transport Tests
 * 
 * Comprehensive test suite for the HTTP transport implementation.
 */

import { HttpServerTransport, HttpTransportStatus, type HttpTransportConfig } from './http-server-transport.js';
import type { JSONRPCMessage, MessageExtraInfo } from '@modelcontextprotocol/sdk/types.js';
import { Server as HttpServer } from 'http';
import express from 'express';

// Mock logger for testing
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('HttpServerTransport', () => {
  let transport: HttpServerTransport;
  let baseConfig: HttpTransportConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    baseConfig = {
      host: 'localhost',
      port: 0, // Use random port for testing
      cors: true,
      corsOrigins: ['*'],
      enableSessions: true,
      enableJsonResponse: false,
      requestTimeout: 5000,
      maxBodySize: '1MB',
      enableDnsRebindingProtection: false
    };
  });

  afterEach(async () => {
    if (transport && transport.getStatus() === HttpTransportStatus.RUNNING) {
      await transport.close();
    }
  });

  describe('Constructor', () => {
    it('should create transport with default configuration', () => {
      transport = new HttpServerTransport({
        host: 'localhost',
        port: 3000
      });

      expect(transport).toBeInstanceOf(HttpServerTransport);
      expect(transport.getStatus()).toBe(HttpTransportStatus.STOPPED);
    });

    it('should create transport with custom configuration', () => {
      transport = new HttpServerTransport(baseConfig, mockLogger);

      expect(transport).toBeInstanceOf(HttpServerTransport);
      expect(transport.getStatus()).toBe(HttpTransportStatus.STOPPED);
    });

    it('should merge configuration with defaults', () => {
      const config = {
        host: 'localhost',
        port: 3000,
        cors: false
      };

      transport = new HttpServerTransport(config);
      const serverInfo = transport.getServerInfo();

      expect(serverInfo.config.host).toBe('localhost');
      expect(serverInfo.config.port).toBe(3000);
      expect(serverInfo.config.cors).toBe(false);
      expect(serverInfo.config.enableSessions).toBe(true); // default
    });
  });

  describe('Lifecycle Management', () => {
    beforeEach(() => {
      transport = new HttpServerTransport(baseConfig, mockLogger);
    });

    it('should start and stop successfully', async () => {
      expect(transport.getStatus()).toBe(HttpTransportStatus.STOPPED);

      await transport.start();
      expect(transport.getStatus()).toBe(HttpTransportStatus.RUNNING);
      expect(mockLogger.info).toHaveBeenCalledWith('HTTP transport started successfully', expect.any(Object));

      await transport.close();
      expect(transport.getStatus()).toBe(HttpTransportStatus.STOPPED);
      expect(mockLogger.info).toHaveBeenCalledWith('HTTP transport stopped successfully');
    });

    it('should handle multiple start attempts gracefully', async () => {
      await transport.start();
      expect(transport.getStatus()).toBe(HttpTransportStatus.RUNNING);

      // Second start attempt should be ignored
      await transport.start();
      expect(transport.getStatus()).toBe(HttpTransportStatus.RUNNING);
      expect(mockLogger.warn).toHaveBeenCalledWith('HTTP transport already running');
    });

    it('should handle multiple stop attempts gracefully', async () => {
      await transport.start();
      await transport.close();
      expect(transport.getStatus()).toBe(HttpTransportStatus.STOPPED);

      // Second stop attempt should be ignored
      await transport.close();
      expect(transport.getStatus()).toBe(HttpTransportStatus.STOPPED);
      expect(mockLogger.warn).toHaveBeenCalledWith('HTTP transport already stopped');
    });

    it('should handle start failure gracefully', async () => {
      // Use an occupied port to force failure
      const server = express().listen(8888, 'localhost');
      
      // Wait for the server to actually start listening
      await new Promise<void>((resolve, reject) => {
        server.on('listening', resolve);
        server.on('error', reject);
        setTimeout(() => reject(new Error('Server start timeout')), 5000);
      });
      
      try {
        transport = new HttpServerTransport({
          ...baseConfig,
          host: 'localhost',
          port: 8888
        }, mockLogger);

        // Test that start should fail
        try {
          await transport.start();
          // If we reach this point, the test should fail because start() should have thrown
          fail('Expected transport.start() to throw, but it resolved');
        } catch (error) {
          // This is expected - start() should throw
          expect(transport.getStatus()).toBe(HttpTransportStatus.ERROR);
        }
      } finally {
        server.close();
      }
    });
  });

  describe('Server Information', () => {
    beforeEach(() => {
      transport = new HttpServerTransport(baseConfig, mockLogger);
    });

    it('should return server info when stopped', () => {
      const info = transport.getServerInfo();

      expect(info.status).toBe(HttpTransportStatus.STOPPED);
      expect(info.config).toEqual(expect.objectContaining(baseConfig));
      expect(info.sessionId).toBeUndefined();
      expect(info.serverAddress).toBeUndefined();
    });

    it('should return server info when running', async () => {
      await transport.start();
      const info = transport.getServerInfo();

      expect(info.status).toBe(HttpTransportStatus.RUNNING);
      expect(info.config).toEqual(expect.objectContaining(baseConfig));
      expect(info.serverAddress).toBeDefined();
      expect(['::','::1'].includes(info.serverAddress?.host || '')).toBe(true);
      expect(typeof info.serverAddress?.port).toBe('number');
    });
  });

  describe('Message Handling', () => {
    let onMessageCallback: jest.Mock;
    let onErrorCallback: jest.Mock;
    let onCloseCallback: jest.Mock;

    beforeEach(() => {
      transport = new HttpServerTransport(baseConfig, mockLogger);
      onMessageCallback = jest.fn();
      onErrorCallback = jest.fn();
      onCloseCallback = jest.fn();

      transport.onmessage = onMessageCallback;
      transport.onerror = onErrorCallback;
      transport.onclose = onCloseCallback;
    });

    it('should reject sending message when transport is stopped', async () => {
      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        method: 'test',
        params: {},
        id: 1
      };

      await expect(transport.send(message)).rejects.toThrow(
        'Cannot send message: HTTP transport is stopped'
      );
    });

    it('should send messages when transport is running', async () => {
      await transport.start();
      
      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        method: 'test',
        params: {},
        id: 1
      };

      // This should not throw - the MCP transport will handle the actual sending
      await expect(transport.send(message)).resolves.not.toThrow();
    });
  });

  describe('HTTP Server Endpoints', () => {
    beforeEach(async () => {
      transport = new HttpServerTransport(baseConfig, mockLogger);
      await transport.start();
    });

    it('should respond to health check endpoint', async () => {
      const info = transport.getServerInfo();
      const port = info.serverAddress?.port;
      expect(port).toBeDefined();

      const response = await fetch(`http://localhost:${port}/health`);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        transport: {
          status: HttpTransportStatus.RUNNING,
          sessionId: transport.sessionId,
          config: expect.objectContaining({
            host: baseConfig.host,
            port: expect.any(Number),
            enableSessions: baseConfig.enableSessions,
            enableJsonResponse: baseConfig.enableJsonResponse
          })
        }
      });
    });

    it('should return 404 for unknown routes', async () => {
      const info = transport.getServerInfo();
      const port = info.serverAddress?.port;
      expect(port).toBeDefined();

      const response = await fetch(`http://localhost:${port}/unknown`);
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body).toEqual({
        error: 'Not found',
        message: 'Route GET /unknown not found'
      });
    });

    it('should handle CORS preflight requests', async () => {
      const info = transport.getServerInfo();
      const port = info.serverAddress?.port;
      expect(port).toBeDefined();

      const response = await fetch(`http://localhost:${port}/mcp`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST'
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE, OPTIONS');
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle minimal configuration', () => {
      transport = new HttpServerTransport({
        host: 'localhost',
        port: 3000
      });

      const info = transport.getServerInfo();
      expect(info.config.cors).toBe(true); // default
      expect(info.config.corsOrigins).toEqual(['*']); // default
      expect(info.config.enableSessions).toBe(true); // default
    });

    it('should handle disabled CORS', () => {
      transport = new HttpServerTransport({
        ...baseConfig,
        cors: false
      });

      const info = transport.getServerInfo();
      expect(info.config.cors).toBe(false);
    });

    it('should handle JSON response mode', () => {
      transport = new HttpServerTransport({
        ...baseConfig,
        enableJsonResponse: true
      });

      const info = transport.getServerInfo();
      expect(info.config.enableJsonResponse).toBe(true);
    });

    it('should handle DNS rebinding protection', () => {
      transport = new HttpServerTransport({
        ...baseConfig,
        enableDnsRebindingProtection: true,
        allowedHosts: ['localhost', '127.0.0.1'],
        allowedOrigins: ['http://localhost:3000']
      });

      const info = transport.getServerInfo();
      expect(info.config.enableDnsRebindingProtection).toBe(true);
      expect(info.config.allowedHosts).toEqual(['localhost', '127.0.0.1']);
      expect(info.config.allowedOrigins).toEqual(['http://localhost:3000']);
    });
  });

  describe('Graceful Shutdown', () => {
    beforeEach(async () => {
      transport = new HttpServerTransport(baseConfig, mockLogger);
      await transport.start();
    });

    it('should perform graceful shutdown within timeout', async () => {
      await expect(transport.gracefulShutdown(5000)).resolves.not.toThrow();
      expect(transport.getStatus()).toBe(HttpTransportStatus.STOPPED);
      expect(mockLogger.info).toHaveBeenCalledWith('Graceful shutdown completed');
    });

    it('should handle graceful shutdown timeout', async () => {
      // Mock the close method to simulate slow shutdown
      const originalClose = transport.close.bind(transport);
      transport.close = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );

      await expect(transport.gracefulShutdown(1000)).rejects.toThrow(
        'Graceful shutdown timed out after 1000ms'
      );

      // Restore original close method and cleanup
      transport.close = originalClose;
      await transport.close();
    }, 10000);
  });

  describe('Protocol Version', () => {
    beforeEach(() => {
      transport = new HttpServerTransport(baseConfig, mockLogger);
    });

    it('should handle protocol version setting', () => {
      expect(() => transport.setProtocolVersion?.('1.0.0')).not.toThrow();
      expect(mockLogger.debug).toHaveBeenCalledWith('Protocol version set', { version: '1.0.0' });
    });
  });
});

describe('HttpServerTransport Integration', () => {
  it('should work with real HTTP requests', async () => {
    const transport = new HttpServerTransport({
      host: 'localhost',
      port: 0,
      cors: true,
      enableSessions: true
    }, mockLogger);

    try {
      await transport.start();
      const info = transport.getServerInfo();
      const port = info.serverAddress?.port;
      expect(port).toBeDefined();

      // Test health endpoint
      const healthResponse = await fetch(`http://localhost:${port}/health`);
      expect(healthResponse.status).toBe(200);

      // Test MCP endpoint with invalid JSON
      const mcpResponse = await fetch(`http://localhost:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json'
      });
      expect(mcpResponse.status).toBe(400);
    } finally {
      await transport.close();
    }
  }, 10000);
});