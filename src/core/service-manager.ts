/**
 * Service Manager Implementation
 * 
 * This module provides the core service management functionality for the Sker Daemon MCP system.
 * It manages the lifecycle of the MCP server, handles tool/resource/prompt registration,
 * and manages transport layer communication.
 */

import { Injectable, Inject } from '@sker/di';
import { Server as McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  type CallToolRequest,
  type ReadResourceRequest,
  type GetPromptRequest
} from '@modelcontextprotocol/sdk/types.js';

import {
  MCP_SERVER_CONFIG,
  MCP_TOOLS,
  MCP_RESOURCES,
  MCP_PROMPTS,
  LOGGER
} from './tokens.js';
import type { 
  IMcpTool, 
  IMcpResource, 
  IMcpPrompt, 
  IMcpServerConfig 
} from './types.js';

/**
 * Service manager status enumeration
 */
export enum ServiceManagerStatus {
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

/**
 * Transport configuration interface
 */
export interface TransportConfig {
  type: 'stdio' | 'http';
  port?: number;
  host?: string;
}

/**
 * Service Manager Implementation
 * 
 * This class manages the MCP server instance, handles registration of tools, resources,
 * and prompts, and manages the transport layer for communication with MCP clients.
 */
@Injectable()
export class ServiceManager {
  private mcpServer: McpServer;
  private transport: StdioServerTransport | null = null;
  private status: ServiceManagerStatus = ServiceManagerStatus.STOPPED;
  private registeredTools = new Map<string, IMcpTool>();
  private registeredResources = new Map<string, IMcpResource>();
  private registeredPrompts = new Map<string, IMcpPrompt>();

  constructor(
    @Inject(MCP_TOOLS) private tools: IMcpTool[],
    @Inject(MCP_RESOURCES) private resources: IMcpResource[],
    @Inject(MCP_PROMPTS) private prompts: IMcpPrompt[],
    @Inject(MCP_SERVER_CONFIG) private config: IMcpServerConfig,
    @Inject(LOGGER) private logger: any
  ) {
    this.logger?.info('ServiceManager initializing...', {
      toolsCount: this.tools.length,
      resourcesCount: this.resources.length,
      promptsCount: this.prompts.length
    });

    // Initialize MCP Server
    this.mcpServer = new McpServer(
      {
        name: this.config.name,
        version: this.config.version
      },
      {
        capabilities: this.config.capabilities
      }
    );

    this.setupServerHandlers();
  }

  /**
   * Starts the service manager and MCP server
   */
  async start(): Promise<void> {
    if (this.status === ServiceManagerStatus.RUNNING) {
      this.logger?.warn('ServiceManager is already running');
      return;
    }

    try {
      this.setStatus(ServiceManagerStatus.STARTING);
      this.logger?.info('Starting ServiceManager...');

      // Register all initial tools, resources, and prompts
      await this.registerInitialComponents();

      // Set up transport layer
      await this.setupTransport();

      // Start the MCP server
      await this.startMcpServer();

      this.setStatus(ServiceManagerStatus.RUNNING);
      this.logger?.info('ServiceManager started successfully', {
        transport: this.config.transport,
        toolsCount: this.registeredTools.size,
        resourcesCount: this.registeredResources.size,
        promptsCount: this.registeredPrompts.size
      });

    } catch (error) {
      this.setStatus(ServiceManagerStatus.ERROR);
      this.logger?.error('Failed to start ServiceManager', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }

  /**
   * Stops the service manager and MCP server
   */
  async stop(): Promise<void> {
    if (this.status === ServiceManagerStatus.STOPPED) {
      this.logger?.warn('ServiceManager is already stopped');
      return;
    }

    try {
      this.setStatus(ServiceManagerStatus.STOPPING);
      this.logger?.info('Stopping ServiceManager...');

      // Close transport
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
        this.logger?.debug('Transport closed');
      }

      // Clear registrations
      this.registeredTools.clear();
      this.registeredResources.clear();
      this.registeredPrompts.clear();

      this.setStatus(ServiceManagerStatus.STOPPED);
      this.logger?.info('ServiceManager stopped successfully');

    } catch (error) {
      this.setStatus(ServiceManagerStatus.ERROR);
      this.logger?.error('Error stopping ServiceManager', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }

  /**
   * Registers a tool dynamically
   */
  async registerTool(tool: IMcpTool): Promise<void> {
    try {
      if (this.registeredTools.has(tool.name)) {
        throw new Error(`Tool '${tool.name}' is already registered`);
      }

      // Validate tool structure
      this.validateTool(tool);

      // Register with MCP server
      this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
        if (request.params.name === tool.name) {
          return await this.handleToolCall(tool, request);
        }
      });

      // Add to our registry
      this.registeredTools.set(tool.name, tool);

      this.logger?.debug('Tool registered', { toolName: tool.name });

    } catch (error) {
      this.logger?.error('Failed to register tool', {
        toolName: tool.name,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Registers a resource dynamically
   */
  async registerResource(resource: IMcpResource): Promise<void> {
    try {
      if (this.registeredResources.has(resource.uri)) {
        throw new Error(`Resource '${resource.uri}' is already registered`);
      }

      // Validate resource structure
      this.validateResource(resource);

      // Register with MCP server
      this.mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        if (this.matchesResourceUri(resource.uri, request.params.uri)) {
          return await this.handleResourceRead(resource, request);
        }
      });

      // Add to our registry
      this.registeredResources.set(resource.uri, resource);

      this.logger?.debug('Resource registered', { resourceUri: resource.uri });

    } catch (error) {
      this.logger?.error('Failed to register resource', {
        resourceUri: resource.uri,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Registers a prompt dynamically
   */
  async registerPrompt(prompt: IMcpPrompt): Promise<void> {
    try {
      if (this.registeredPrompts.has(prompt.name)) {
        throw new Error(`Prompt '${prompt.name}' is already registered`);
      }

      // Validate prompt structure
      this.validatePrompt(prompt);

      // Register with MCP server
      this.mcpServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
        if (request.params.name === prompt.name) {
          return await this.handlePromptGet(prompt, request);
        }
      });

      // Add to our registry
      this.registeredPrompts.set(prompt.name, prompt);

      this.logger?.debug('Prompt registered', { promptName: prompt.name });

    } catch (error) {
      this.logger?.error('Failed to register prompt', {
        promptName: prompt.name,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Gets the current service manager status
   */
  getStatus(): ServiceManagerStatus {
    return this.status;
  }

  /**
   * Gets information about registered components
   */
  getRegistrationInfo(): {
    tools: string[];
    resources: string[];
    prompts: string[];
    status: ServiceManagerStatus;
  } {
    return {
      tools: Array.from(this.registeredTools.keys()),
      resources: Array.from(this.registeredResources.keys()),
      prompts: Array.from(this.registeredPrompts.keys()),
      status: this.status
    };
  }

  /**
   * Sets up MCP server request handlers
   */
  private setupServerHandlers(): void {
    // Handle list tools requests
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.registeredTools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }));

      this.logger?.debug('Listed tools', { count: tools.length });
      return { tools };
    });

    // Handle list resources requests
    this.mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = Array.from(this.registeredResources.values()).map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType
      }));

      this.logger?.debug('Listed resources', { count: resources.length });
      return { resources };
    });

    // Handle list prompts requests
    this.mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => {
      const prompts = Array.from(this.registeredPrompts.values()).map(prompt => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments
      }));

      this.logger?.debug('Listed prompts', { count: prompts.length });
      return { prompts };
    });
  }

  /**
   * Registers all initial components
   */
  private async registerInitialComponents(): Promise<void> {
    // Register initial tools
    for (const tool of this.tools) {
      await this.registerTool(tool);
    }

    // Register initial resources
    for (const resource of this.resources) {
      await this.registerResource(resource);
    }

    // Register initial prompts
    for (const prompt of this.prompts) {
      await this.registerPrompt(prompt);
    }

    this.logger?.info('Initial components registered', {
      tools: this.registeredTools.size,
      resources: this.registeredResources.size,
      prompts: this.registeredPrompts.size
    });
  }

  /**
   * Sets up transport layer based on configuration
   */
  private async setupTransport(): Promise<void> {
    const transportConfig = this.config.transport;

    switch (transportConfig.type) {
      case 'stdio':
        this.transport = new StdioServerTransport();
        this.logger?.debug('Set up STDIO transport');
        break;

      case 'http':
        // HTTP transport would be implemented here
        // For now, fall back to stdio
        this.transport = new StdioServerTransport();
        this.logger?.warn('HTTP transport not yet implemented, using STDIO');
        break;

      default:
        throw new Error(`Unsupported transport type: ${(transportConfig as any).type}`);
    }
  }

  /**
   * Starts the MCP server with the configured transport
   */
  private async startMcpServer(): Promise<void> {
    if (!this.transport) {
      throw new Error('Transport not configured');
    }

    // Connect server to transport
    await this.mcpServer.connect(this.transport);
    this.logger?.debug('MCP server connected to transport');
  }

  /**
   * Handles tool call requests
   */
  private async handleToolCall(tool: IMcpTool, request: CallToolRequest): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logger?.debug('Handling tool call', {
        toolName: tool.name,
        arguments: request.params.arguments
      });

      // Apply middleware if present
      if (tool.middleware && tool.middleware.length > 0) {
        this.logger?.debug('Applying middleware', {
          toolName: tool.name,
          middlewareCount: tool.middleware.length
        });
      }

      // Call the tool handler
      const result = await tool.handler(request);

      const duration = Date.now() - startTime;
      this.logger?.debug('Tool call completed', {
        toolName: tool.name,
        duration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger?.error('Tool call failed', {
        toolName: tool.name,
        error: (error as Error).message,
        duration
      });

      // Use tool's error handler if available
      if (tool.errorHandler) {
        return await tool.errorHandler(error as Error, request);
      }

      throw error;
    }
  }

  /**
   * Handles resource read requests
   */
  private async handleResourceRead(resource: IMcpResource, request: ReadResourceRequest): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logger?.debug('Handling resource read', {
        resourceUri: resource.uri,
        requestUri: request.params.uri
      });

      // Apply middleware if present
      if (resource.middleware && resource.middleware.length > 0) {
        this.logger?.debug('Applying middleware', {
          resourceUri: resource.uri,
          middlewareCount: resource.middleware.length
        });
      }

      // Call the resource handler
      const result = await resource.handler(request);

      const duration = Date.now() - startTime;
      this.logger?.debug('Resource read completed', {
        resourceUri: resource.uri,
        duration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger?.error('Resource read failed', {
        resourceUri: resource.uri,
        error: (error as Error).message,
        duration
      });

      // Use resource's error handler if available
      if (resource.errorHandler) {
        return await resource.errorHandler(error as Error, request);
      }

      throw error;
    }
  }

  /**
   * Handles prompt get requests
   */
  private async handlePromptGet(prompt: IMcpPrompt, request: GetPromptRequest): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logger?.debug('Handling prompt get', {
        promptName: prompt.name,
        arguments: request.params.arguments
      });

      // Apply middleware if present
      if (prompt.middleware && prompt.middleware.length > 0) {
        this.logger?.debug('Applying middleware', {
          promptName: prompt.name,
          middlewareCount: prompt.middleware.length
        });
      }

      // Call the prompt handler
      const result = await prompt.handler(request);

      const duration = Date.now() - startTime;
      this.logger?.debug('Prompt get completed', {
        promptName: prompt.name,
        duration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger?.error('Prompt get failed', {
        promptName: prompt.name,
        error: (error as Error).message,
        duration
      });

      // Use prompt's error handler if available
      if (prompt.errorHandler) {
        return await prompt.errorHandler(error as Error, request);
      }

      throw error;
    }
  }

  /**
   * Validates tool structure
   */
  private validateTool(tool: IMcpTool): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid name');
    }

    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error('Tool must have a valid description');
    }

    if (typeof tool.handler !== 'function') {
      throw new Error('Tool must have a valid handler function');
    }
  }

  /**
   * Validates resource structure
   */
  private validateResource(resource: IMcpResource): void {
    if (!resource.uri || typeof resource.uri !== 'string') {
      throw new Error('Resource must have a valid URI');
    }

    if (!resource.name || typeof resource.name !== 'string') {
      throw new Error('Resource must have a valid name');
    }

    if (typeof resource.handler !== 'function') {
      throw new Error('Resource must have a valid handler function');
    }
  }

  /**
   * Validates prompt structure
   */
  private validatePrompt(prompt: IMcpPrompt): void {
    if (!prompt.name || typeof prompt.name !== 'string') {
      throw new Error('Prompt must have a valid name');
    }

    if (!prompt.description || typeof prompt.description !== 'string') {
      throw new Error('Prompt must have a valid description');
    }

    if (typeof prompt.handler !== 'function') {
      throw new Error('Prompt must have a valid handler function');
    }
  }

  /**
   * Checks if a request URI matches a resource URI pattern
   */
  private matchesResourceUri(resourceUri: string, requestUri: string): boolean {
    // Simple exact match for now
    // In the future, this could support URI templates with parameters
    return resourceUri === requestUri;
  }

  /**
   * Sets the service manager status
   */
  private setStatus(status: ServiceManagerStatus): void {
    const previousStatus = this.status;
    this.status = status;
    
    this.logger?.debug('ServiceManager status changed', {
      from: previousStatus,
      to: status
    });
  }
}