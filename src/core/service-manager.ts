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
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { HttpServerTransport, type HttpTransportConfig } from './transports/http-server-transport.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  type CallToolRequest,
  type ReadResourceRequest,
  type GetPromptRequest,
  type ListResourceTemplatesRequest
} from '@modelcontextprotocol/sdk/types.js';

import {
  MCP_SERVER_CONFIG,
  MCP_TOOLS,
  MCP_RESOURCES,
  MCP_PROMPTS,
  LOGGER
} from '@sker/mcp';
import type {
  IMcpTool,
  IMcpResource,
  IMcpResourceTemplate,
  IMcpPrompt,
  IMcpServerConfig
} from '@sker/mcp';
import { ServicePreBindingManager } from './service-prebinding.js';
import type {
  PreBoundTool,
  PreBoundResource,
  PreBoundPrompt,
  PreBindingOptions
} from './service-prebinding.js';
import type { IsolatedPluginInstance } from './plugins/index.js';

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
@Injectable({ providedIn: 'auto' })
export class ServiceManager {
  private mcpServer: McpServer;
  private transport: Transport | null = null;
  private status: ServiceManagerStatus = ServiceManagerStatus.STOPPED;
  private registeredTools = new Map<string, IMcpTool>();
  private registeredResources = new Map<string, IMcpResource>();
  private registeredResourceTemplates = new Map<string, IMcpResourceTemplate>();
  private registeredPrompts = new Map<string, IMcpPrompt>();
  private preBoundTools = new Map<string, PreBoundTool>();
  private preBoundResources = new Map<string, PreBoundResource>();
  private preBoundPrompts = new Map<string, PreBoundPrompt>();
  private preBindingManager: ServicePreBindingManager;

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

    // Initialize service pre-binding manager
    this.preBindingManager = new ServicePreBindingManager(this.logger);

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

      // Register with MCP server (removed individual handler registration)
      // Individual tool handlers will be managed by the central tool dispatch handler

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

      // Register with MCP server (removed individual handler registration)
      // Individual resource handlers will be managed by the central resource dispatch handler

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
   * Registers a resource template with the MCP server
   */
  async registerResourceTemplate(template: IMcpResourceTemplate): Promise<void> {
    try {
      if (this.registeredResourceTemplates.has(template.name)) {
        throw new Error(`Resource template '${template.name}' is already registered`);
      }

      // Validate resource template structure
      this.validateResourceTemplate(template);

      // Add to our registry
      this.registeredResourceTemplates.set(template.name, template);

      this.logger?.debug('Resource template registered', { 
        templateName: template.name,
        uriTemplate: template.uriTemplate 
      });

    } catch (error) {
      this.logger?.error('Failed to register resource template', {
        templateName: template.name,
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

      // Register with MCP server (removed individual handler registration)
      // Individual prompt handlers will be managed by the central prompt dispatch handler

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
   * Gets enhanced information about registered components including pre-bound services
   */
  getRegistrationInfo(): {
    tools: string[];
    resources: string[];
    prompts: string[];
    preBoundTools: string[];
    preBoundResources: string[];
    preBoundPrompts: string[];
    status: ServiceManagerStatus;
    preBindingMetrics: any;
  } {
    return {
      tools: Array.from(this.registeredTools.keys()),
      resources: Array.from(this.registeredResources.keys()),
      prompts: Array.from(this.registeredPrompts.keys()),
      preBoundTools: Array.from(this.preBoundTools.keys()),
      preBoundResources: Array.from(this.preBoundResources.keys()),
      preBoundPrompts: Array.from(this.preBoundPrompts.keys()),
      status: this.status,
      preBindingMetrics: this.preBindingManager.getPerformanceMetrics()
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

    // Handle tool calls (central dispatcher)
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const tool = this.registeredTools.get(toolName);
      
      if (!tool) {
        throw new Error(`Tool '${toolName}' not found`);
      }

      // Check if this is a pre-bound tool
      if (this.preBoundTools.has(toolName)) {
        return await this.handlePreBoundToolCall(tool, request);
      } else {
        return await this.handleToolCall(tool, request);
      }
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

    // Handle resource reads (central dispatcher)
    this.mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const requestUri = request.params.uri;
      
      // Find matching resource
      for (const [uri, resource] of this.registeredResources.entries()) {
        if (this.matchesResourceUri(resource.uri, requestUri)) {
          // Check if this is a pre-bound resource
          if (this.preBoundResources.has(uri)) {
            return await this.handlePreBoundResourceRead(resource, request);
          } else {
            return await this.handleResourceRead(resource, request);
          }
        }
      }
      
      throw new Error(`Resource '${requestUri}' not found`);
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

    // Handle prompt gets (central dispatcher)
    this.mcpServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const promptName = request.params.name;
      const prompt = this.registeredPrompts.get(promptName);
      
      if (!prompt) {
        throw new Error(`Prompt '${promptName}' not found`);
      }

      // Check if this is a pre-bound prompt
      if (this.preBoundPrompts.has(promptName)) {
        return await this.handlePreBoundPromptGet(prompt, request);
      } else {
        return await this.handlePromptGet(prompt, request);
      }
    });

    // Handle list resource templates requests
    this.mcpServer.setRequestHandler(ListResourceTemplatesRequestSchema, async (request: ListResourceTemplatesRequest) => {
      const resourceTemplates = Array.from(this.registeredResourceTemplates.values()).map(template => ({
        uriTemplate: template.uriTemplate,
        name: template.name,
        title: template.title,
        description: template.description,
        mimeType: template.mimeType
      }));

      this.logger?.debug('Listed resource templates', { count: resourceTemplates.length });
      
      // Handle pagination if cursor is provided
      const { cursor } = request.params || {};
      let filteredTemplates = resourceTemplates;
      let nextCursor: string | undefined;
      
      if (cursor) {
        // Simple pagination based on template name
        const startIndex = resourceTemplates.findIndex(t => t.name === cursor);
        if (startIndex >= 0) {
          filteredTemplates = resourceTemplates.slice(startIndex + 1);
        }
      }
      
      // For now, we return all templates without pagination limit
      // In the future, this could be configurable
      
      return { 
        resourceTemplates: filteredTemplates,
        nextCursor 
      };
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

    // Register initial resources and templates
    for (const resource of this.resources) {
      if (resource.isTemplate) {
        // Convert to resource template and register
        const template: IMcpResourceTemplate = {
          uriTemplate: resource.uri,
          name: resource.name,
          title: (resource as any).title,
          description: resource.description,
          mimeType: resource.mimeType
        };
        await this.registerResourceTemplate(template);
      } else {
        // Register as regular resource
        await this.registerResource(resource);
      }
    }

    // Register initial prompts
    for (const prompt of this.prompts) {
      await this.registerPrompt(prompt);
    }

    this.logger?.info('Initial components registered', {
      tools: this.registeredTools.size,
      resources: this.registeredResources.size,
      resourceTemplates: this.registeredResourceTemplates.size,
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
        const httpSettings = transportConfig.http || {};
        const httpConfig: HttpTransportConfig = {
          host: transportConfig.host || 'localhost',
          port: transportConfig.port || 3000,
          cors: httpSettings.cors ?? true,
          corsOrigins: httpSettings.corsOrigins || ['*'],
          enableSessions: httpSettings.enableSessions ?? true,
          enableJsonResponse: httpSettings.enableJsonResponse ?? false,
          requestTimeout: httpSettings.requestTimeout || 30000,
          maxBodySize: httpSettings.maxBodySize || '10MB',
          enableDnsRebindingProtection: httpSettings.enableDnsRebindingProtection ?? false,
          allowedHosts: httpSettings.allowedHosts || [],
          allowedOrigins: httpSettings.allowedOrigins || []
        };
        
        this.transport = new HttpServerTransport(httpConfig, this.logger);
        this.logger?.debug('Set up HTTP transport', { 
          host: httpConfig.host, 
          port: httpConfig.port,
          cors: httpConfig.cors,
          enableSessions: httpConfig.enableSessions
        });
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
   * Validates resource template structure
   */
  private validateResourceTemplate(template: IMcpResourceTemplate): void {
    if (!template.uriTemplate || typeof template.uriTemplate !== 'string') {
      throw new Error('Resource template must have a valid URI template');
    }

    if (!template.name || typeof template.name !== 'string') {
      throw new Error('Resource template must have a valid name');
    }

    // Validate URI template format (basic check for RFC 6570)
    if (!template.uriTemplate.includes('{') || !template.uriTemplate.includes('}')) {
      throw new Error('Resource template URI must contain template variables (e.g., {variable})');
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
   * Register pre-bound services from an isolated plugin instance using MetadataCollector
   */
  async registerPluginPreBoundServices(
    isolatedInstance: IsolatedPluginInstance,
    options: PreBindingOptions = {}
  ): Promise<{
    tools: PreBoundTool[];
    resources: PreBoundResource[];
    prompts: PreBoundPrompt[];
  }> {
    try {
      this.logger?.info('Registering pre-bound services from plugin using MetadataCollector', {
        plugin: isolatedInstance.plugin.name,
        version: isolatedInstance.plugin.version
      });

      // Use MetadataCollector to create pre-bound services with proper metadata handling
      const { MetadataCollector } = await import('./metadata-collector.js');
      const preBoundServices = await MetadataCollector.createPreBoundServicesFromPlugin(
        isolatedInstance
      );

      // Register pre-bound tools (handlers managed by central dispatcher)
      for (const tool of preBoundServices.tools) {
        this.preBoundTools.set(tool.name, tool);
        this.registeredTools.set(tool.name, tool);
      }

      // Register pre-bound resources (handlers managed by central dispatcher)
      for (const resource of preBoundServices.resources) {
        this.preBoundResources.set(resource.uri, resource);
        this.registeredResources.set(resource.uri, resource);
      }

      // Register pre-bound prompts (handlers managed by central dispatcher)
      for (const prompt of preBoundServices.prompts) {
        this.preBoundPrompts.set(prompt.name, prompt);
        this.registeredPrompts.set(prompt.name, prompt);
      }

      this.logger?.info('Pre-bound services registered successfully', {
        plugin: isolatedInstance.plugin.name,
        tools: preBoundServices.tools.length,
        resources: preBoundServices.resources.length,
        prompts: preBoundServices.prompts.length
      });

      return preBoundServices;

    } catch (error) {
      this.logger?.error('Failed to register pre-bound services', {
        plugin: isolatedInstance.plugin.name,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Unregister pre-bound services for a plugin
   */
  async unregisterPluginPreBoundServices(pluginName: string): Promise<void> {
    try {
      this.logger?.debug('Unregistering pre-bound services for plugin', { pluginName });

      // Remove pre-bound tools
      const toolsToRemove: string[] = [];
      for (const [name, tool] of this.preBoundTools.entries()) {
        if (tool.boundService.pluginName === pluginName) {
          toolsToRemove.push(name);
        }
      }

      // Remove pre-bound resources
      const resourcesToRemove: string[] = [];
      for (const [uri, resource] of this.preBoundResources.entries()) {
        if (resource.boundService.pluginName === pluginName) {
          resourcesToRemove.push(uri);
        }
      }

      // Remove pre-bound prompts
      const promptsToRemove: string[] = [];
      for (const [name, prompt] of this.preBoundPrompts.entries()) {
        if (prompt.boundService.pluginName === pluginName) {
          promptsToRemove.push(name);
        }
      }

      // Clean up registrations
      for (const name of toolsToRemove) {
        this.preBoundTools.delete(name);
        this.registeredTools.delete(name);
      }

      for (const uri of resourcesToRemove) {
        this.preBoundResources.delete(uri);
        this.registeredResources.delete(uri);
      }

      for (const name of promptsToRemove) {
        this.preBoundPrompts.delete(name);
        this.registeredPrompts.delete(name);
      }

      // Clear from pre-binding manager
      await this.preBindingManager.clearPluginServices(pluginName);

      this.logger?.info('Pre-bound services unregistered', {
        plugin: pluginName,
        toolsRemoved: toolsToRemove.length,
        resourcesRemoved: resourcesToRemove.length,
        promptsRemoved: promptsToRemove.length
      });

    } catch (error) {
      this.logger?.error('Failed to unregister pre-bound services', {
        plugin: pluginName,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get pre-binding performance metrics
   */
  getPreBindingMetrics(): any {
    return this.preBindingManager.getPerformanceMetrics();
  }

  /**
   * Check if a service is pre-bound
   */
  isServicePreBound(type: 'tool' | 'resource' | 'prompt', identifier: string): boolean {
    switch (type) {
      case 'tool':
        return this.preBoundTools.has(identifier);
      case 'resource':
        return this.preBoundResources.has(identifier);
      case 'prompt':
        return this.preBoundPrompts.has(identifier);
      default:
        return false;
    }
  }

  /**
   * Handle pre-bound tool call with enhanced middleware and error handling
   */
  private async handlePreBoundToolCall(tool: any, request: CallToolRequest): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger?.debug('Handling pre-bound tool call', {
        toolName: tool.name,
        arguments: request.params.arguments,
        pluginName: tool.pluginMetadata?.pluginName
      });

      // Use the tool's built-in handler which already has middleware and error handling
      const result = await tool.handler(request);

      const duration = Date.now() - startTime;
      this.logger?.debug('Pre-bound tool call completed', {
        toolName: tool.name,
        duration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger?.error('Pre-bound tool call failed', {
        toolName: tool.name,
        error: (error as Error).message,
        duration
      });

      throw error;
    }
  }

  /**
   * Handle pre-bound resource read with enhanced middleware and error handling
   */
  private async handlePreBoundResourceRead(resource: any, request: ReadResourceRequest): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger?.debug('Handling pre-bound resource read', {
        resourceUri: resource.uri,
        requestUri: request.params.uri,
        pluginName: resource.pluginMetadata?.pluginName
      });

      // Use the resource's built-in handler which already has middleware and error handling
      const result = await resource.handler(request);

      const duration = Date.now() - startTime;
      this.logger?.debug('Pre-bound resource read completed', {
        resourceUri: resource.uri,
        duration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger?.error('Pre-bound resource read failed', {
        resourceUri: resource.uri,
        error: (error as Error).message,
        duration
      });

      throw error;
    }
  }

  /**
   * Handle pre-bound prompt get with enhanced middleware and error handling
   */
  private async handlePreBoundPromptGet(prompt: any, request: GetPromptRequest): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger?.debug('Handling pre-bound prompt get', {
        promptName: prompt.name,
        arguments: request.params.arguments,
        pluginName: prompt.pluginMetadata?.pluginName
      });

      // Use the prompt's built-in handler which already has middleware and error handling
      const result = await prompt.handler(request);

      const duration = Date.now() - startTime;
      this.logger?.debug('Pre-bound prompt get completed', {
        promptName: prompt.name,
        duration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger?.error('Pre-bound prompt get failed', {
        promptName: prompt.name,
        error: (error as Error).message,
        duration
      });

      throw error;
    }
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