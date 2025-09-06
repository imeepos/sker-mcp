/**
 * HTTP Server Transport Implementation
 * 
 * This module provides HTTP transport support for the MCP server using the
 * StreamableHTTPServerTransport from the MCP SDK. It wraps the transport
 * with Express.js server management and lifecycle handling.
 */

import express, { Express, Request, Response } from 'express';
import { Server as HttpServer } from 'http';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage, MessageExtraInfo } from '@modelcontextprotocol/sdk/types.js';

/**
 * Configuration options for HTTP transport
 */
export interface HttpTransportConfig {
  /** Server hostname */
  host: string;
  /** Server port */
  port: number;
  /** Enable CORS support */
  cors?: boolean;
  /** CORS origin whitelist */
  corsOrigins?: string[];
  /** Enable session management */
  enableSessions?: boolean;
  /** Enable JSON response mode (no SSE streaming) */
  enableJsonResponse?: boolean;
  /** Request timeout in milliseconds */
  requestTimeout?: number;
  /** Maximum request body size */
  maxBodySize?: string;
  /** Enable DNS rebinding protection */
  enableDnsRebindingProtection?: boolean;
  /** Allowed hosts for DNS rebinding protection */
  allowedHosts?: string[];
  /** Allowed origins for DNS rebinding protection */
  allowedOrigins?: string[];
}

/**
 * HTTP Server Transport Status
 */
export enum HttpTransportStatus {
  STOPPED = 'stopped',
  STARTING = 'starting', 
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error'
}

/**
 * HTTP Server Transport Implementation
 * 
 * This class wraps the MCP SDK's StreamableHTTPServerTransport with Express.js
 * server management, providing a complete HTTP transport solution for MCP servers.
 */
export class HttpServerTransport implements Transport {
  private app: Express;
  private server: HttpServer | null = null;
  private mcpTransport!: StreamableHTTPServerTransport;
  private status: HttpTransportStatus = HttpTransportStatus.STOPPED;
  private config: HttpTransportConfig;
  private logger?: any;

  // Transport interface properties
  public sessionId?: string;
  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;

  constructor(config: HttpTransportConfig, logger?: any) {
    this.config = {
      cors: true,
      corsOrigins: ['*'],
      enableSessions: true,
      enableJsonResponse: false,
      requestTimeout: 30000,
      maxBodySize: '10mb',
      enableDnsRebindingProtection: false,
      ...config
    };
    this.logger = logger;

    this.app = express();
    this.setupExpressMiddleware();
    this.setupMcpTransport();
    this.setupRoutes();
  }

  /**
   * Setup Express.js middleware
   */
  private setupExpressMiddleware(): void {
    // Enable CORS if configured (simple implementation)
    if (this.config.cors) {
      this.app.use((req: Request, res: Response, next) => {
        const origin = req.headers.origin;
        const allowedOrigins = this.config.corsOrigins || ['*'];
        
        if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
          res.header('Access-Control-Allow-Origin', origin || '*');
        }
        
        res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-MCP-Session-ID');
        res.header('Access-Control-Allow-Credentials', 'true');
        
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      });
    }

    // Body parsing middleware
    this.app.use(express.json({ limit: this.config.maxBodySize }));
    this.app.use(express.text({ limit: this.config.maxBodySize }));

    // Request timeout middleware
    if (this.config.requestTimeout) {
      this.app.use((req: Request, res: Response, next) => {
        req.setTimeout(this.config.requestTimeout!, () => {
          if (!res.headersSent) {
            res.status(408).json({ error: 'Request timeout' });
          }
        });
        next();
      });
    }

    // Request ID middleware
    this.app.use((req: Request, res: Response, next) => {
      const requestId = req.headers['x-request-id'] as string || randomUUID();
      req.headers['x-request-id'] = requestId;
      res.setHeader('X-Request-ID', requestId);
      next();
    });

    // Logging middleware
    this.app.use((req: Request, res: Response, next) => {
      this.logger?.debug('HTTP request received', {
        method: req.method,
        url: req.url,
        requestId: req.headers['x-request-id'],
        sessionId: req.headers['x-mcp-session-id'],
        userAgent: req.headers['user-agent'],
        contentType: req.headers['content-type']
      });
      next();
    });

    // Error handling middleware
    this.app.use((error: any, req: Request, res: Response, next: any) => {
      this.logger?.error('Express middleware error', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
        sessionId: req.headers['x-mcp-session-id'],
        userAgent: req.headers['user-agent']
      });

      // Handle specific error types
      let statusCode = 500;
      let errorMessage = 'Internal server error';

      if (error.type === 'entity.parse.failed') {
        statusCode = 400;
        errorMessage = 'Invalid JSON payload';
      } else if (error.type === 'entity.too.large') {
        statusCode = 413;
        errorMessage = 'Request entity too large';
      } else if (error.code === 'TIMEOUT') {
        statusCode = 408;
        errorMessage = 'Request timeout';
      } else if (error.status) {
        statusCode = error.status;
        errorMessage = error.message;
      }

      if (!res.headersSent) {
        res.status(statusCode).json({
          error: errorMessage,
          code: error.code,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }
    });
  }

  /**
   * Setup MCP StreamableHTTPServerTransport
   */
  private setupMcpTransport(): void {
    this.mcpTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: this.config.enableSessions ? () => randomUUID() : undefined,
      enableJsonResponse: this.config.enableJsonResponse,
      enableDnsRebindingProtection: this.config.enableDnsRebindingProtection,
      allowedHosts: this.config.allowedHosts,
      allowedOrigins: this.config.allowedOrigins,
      
      onsessioninitialized: (sessionId: string) => {
        this.logger?.info('MCP session initialized', { sessionId });
        this.sessionId = sessionId;
      },
      
      onsessionclosed: (sessionId: string) => {
        this.logger?.info('MCP session closed', { sessionId });
        if (this.sessionId === sessionId) {
          this.sessionId = undefined;
        }
      }
    });

    // Forward MCP transport events
    this.mcpTransport.onmessage = (message, extra) => {
      this.logger?.debug('MCP message received', { 
        messageType: 'method' in message ? message.method : 'response',
        messageId: 'id' in message ? message.id : undefined,
        extra 
      });
      this.onmessage?.(message, extra);
    };

    this.mcpTransport.onerror = (error) => {
      this.logger?.error('MCP transport error', { 
        error: error.message,
        stack: error.stack 
      });
      this.onerror?.(error);
    };

    this.mcpTransport.onclose = () => {
      this.logger?.debug('MCP transport closed');
      this.onclose?.();
    };
  }

  /**
   * Setup Express routes for MCP
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        transport: {
          status: this.status,
          sessionId: this.sessionId,
          config: {
            host: this.config.host,
            port: this.config.port,
            enableSessions: this.config.enableSessions,
            enableJsonResponse: this.config.enableJsonResponse
          }
        }
      });
    });

    // MCP endpoint - handle all HTTP methods
    this.app.all('/mcp', async (req: Request, res: Response) => {
      try {
        await this.mcpTransport.handleRequest(req, res, req.body);
      } catch (error) {
        this.logger?.error('MCP request handling error', {
          error: (error as Error).message,
          stack: (error as Error).stack,
          method: req.method,
          url: req.url
        });

        if (!res.headersSent) {
          res.status(500).json({
            error: 'MCP request processing failed',
            message: (error as Error).message
          });
        }
      }
    });

    // Catch-all for unsupported routes
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.url} not found`
      });
    });
  }

  /**
   * Start the HTTP transport
   */
  async start(): Promise<void> {
    if (this.status === HttpTransportStatus.RUNNING) {
      this.logger?.warn('HTTP transport already running');
      return;
    }

    if (this.status === HttpTransportStatus.STARTING) {
      this.logger?.warn('HTTP transport already starting');
      return;
    }

    try {
      this.status = HttpTransportStatus.STARTING;
      this.logger?.info('Starting HTTP transport...', {
        host: this.config.host,
        port: this.config.port
      });

      // Start the MCP transport
      await this.mcpTransport.start();

      // Start the HTTP server
      await new Promise<void>((resolve, reject) => {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          this.status = HttpTransportStatus.RUNNING;
          this.logger?.info('HTTP transport started successfully', {
            host: this.config.host,
            port: this.config.port,
            pid: process.pid
          });
          resolve();
        });

        this.server.on('error', (error: Error) => {
          this.status = HttpTransportStatus.ERROR;
          this.logger?.error('HTTP server error', {
            error: error.message,
            stack: error.stack
          });
          reject(error);
        });
      });

    } catch (error) {
      this.status = HttpTransportStatus.ERROR;
      this.logger?.error('Failed to start HTTP transport', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }

  /**
   * Gracefully shutdown the HTTP transport
   */
  async gracefulShutdown(timeout: number = 10000): Promise<void> {
    this.logger?.info('Starting graceful shutdown...', { timeout });
    
    const shutdownPromise = this.close();
    const timeoutPromise = new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`Graceful shutdown timed out after ${timeout}ms`));
      }, timeout);
    });

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
      this.logger?.info('Graceful shutdown completed');
    } catch (error) {
      this.logger?.error('Graceful shutdown failed', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Stop the HTTP transport
   */
  async close(): Promise<void> {
    if (this.status === HttpTransportStatus.STOPPED) {
      this.logger?.warn('HTTP transport already stopped');
      return;
    }

    if (this.status === HttpTransportStatus.STOPPING) {
      this.logger?.warn('HTTP transport already stopping');
      return;
    }

    try {
      this.status = HttpTransportStatus.STOPPING;
      this.logger?.info('Stopping HTTP transport...');

      // Close the MCP transport first
      await this.mcpTransport.close();

      // Close the HTTP server
      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server!.close((error) => {
            if (error) {
              this.logger?.error('Error closing HTTP server', {
                error: error.message,
                stack: error.stack
              });
              reject(error);
            } else {
              resolve();
            }
          });
        });
        this.server = null;
      }

      this.status = HttpTransportStatus.STOPPED;
      this.sessionId = undefined;
      
      this.logger?.info('HTTP transport stopped successfully');

    } catch (error) {
      this.status = HttpTransportStatus.ERROR;
      this.logger?.error('Failed to stop HTTP transport', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }

  /**
   * Send a message through the MCP transport
   */
  async send(message: JSONRPCMessage, options?: { relatedRequestId?: string }): Promise<void> {
    if (this.status !== HttpTransportStatus.RUNNING) {
      throw new Error(`Cannot send message: HTTP transport is ${this.status}`);
    }

    try {
      await this.mcpTransport.send(message, options);
    } catch (error) {
      this.logger?.error('Failed to send message through HTTP transport', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        messageType: 'method' in message ? message.method : 'response',
        messageId: 'id' in message ? message.id : undefined
      });
      throw error;
    }
  }

  /**
   * Get transport status
   */
  getStatus(): HttpTransportStatus {
    return this.status;
  }

  /**
   * Get server information
   */
  getServerInfo(): {
    status: HttpTransportStatus;
    config: HttpTransportConfig;
    sessionId?: string;
    serverAddress?: { host: string; port: number };
  } {
    const serverAddress = this.server?.listening && this.server.address();
    
    return {
      status: this.status,
      config: this.config,
      sessionId: this.sessionId,
      serverAddress: serverAddress && typeof serverAddress === 'object' 
        ? { host: serverAddress.address, port: serverAddress.port }
        : undefined
    };
  }

  /**
   * Set protocol version (called by MCP server)
   */
  setProtocolVersion?(version: string): void {
    this.logger?.debug('Protocol version set', { version });
    // Note: StreamableHTTPServerTransport doesn't expose setProtocolVersion
    // The protocol version is handled internally by the MCP transport
  }
}