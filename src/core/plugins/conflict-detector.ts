/**
 * Plugin Conflict Detection System
 * 
 * This module provides comprehensive conflict detection and resolution
 * mechanisms for plugins in the Sker Daemon MCP system. It identifies
 * conflicts between plugins and provides strategies for resolution.
 */

import 'reflect-metadata';
import { Injectable, Inject } from '@sker/di';
import { LOGGER } from '../tokens.js';
import type {
  IPlugin,
  IEnhancedPlugin,
  IMcpTool,
  IMcpResource,
  IMcpPrompt,
  IsolatedPluginInstance
} from '../types.js';

/**
 * Types of conflicts that can occur between plugins
 */
export enum ConflictType {
  /** Tool name conflicts */
  TOOL_NAME = 'tool_name',
  /** Resource URI conflicts */
  RESOURCE_URI = 'resource_uri', 
  /** Prompt name conflicts */
  PROMPT_NAME = 'prompt_name',
  /** Service class conflicts */
  SERVICE_CLASS = 'service_class',
  /** Dependency conflicts */
  DEPENDENCY = 'dependency',
  /** Version conflicts */
  VERSION = 'version',
  /** Configuration conflicts */
  CONFIGURATION = 'configuration'
}

/**
 * Severity levels for conflicts
 */
export enum ConflictSeverity {
  /** Information only - no action needed */
  INFO = 'info',
  /** Warning - might cause issues */
  WARNING = 'warning',
  /** Error - will cause problems */
  ERROR = 'error',
  /** Critical - system will fail */
  CRITICAL = 'critical'
}

/**
 * Conflict resolution strategies
 */
export enum ResolutionStrategy {
  /** First plugin wins */
  FIRST_WINS = 'first_wins',
  /** Last plugin wins */
  LAST_WINS = 'last_wins',
  /** Use plugin priority */
  PRIORITY = 'priority',
  /** Manual resolution required */
  MANUAL = 'manual',
  /** Disable conflicting plugin */
  DISABLE = 'disable',
  /** Rename conflicting resource */
  RENAME = 'rename'
}

/**
 * Plugin conflict information
 */
export interface PluginConflict {
  /** Unique conflict ID */
  id: string;
  /** Type of conflict */
  type: ConflictType;
  /** Severity of the conflict */
  severity: ConflictSeverity;
  /** Conflicting plugins */
  plugins: IPlugin[];
  /** Conflicting resource details */
  resource: {
    /** Resource identifier (name, URI, etc.) */
    identifier: string;
    /** Resource type */
    type: 'tool' | 'resource' | 'prompt' | 'service' | 'dependency';
    /** Additional context */
    context?: any;
  };
  /** Recommended resolution strategy */
  recommendedStrategy: ResolutionStrategy;
  /** Possible resolution strategies */
  possibleStrategies: ResolutionStrategy[];
  /** Human-readable description */
  description: string;
  /** Detection timestamp */
  detectedAt: Date;
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  /** Conflict ID that was resolved */
  conflictId: string;
  /** Strategy used for resolution */
  strategy: ResolutionStrategy;
  /** Action taken */
  action: string;
  /** Success status */
  success: boolean;
  /** Error message if resolution failed */
  error?: string;
  /** Resolution timestamp */
  resolvedAt: Date;
}

/**
 * Plugin priority configuration
 */
export interface PluginPriority {
  /** Plugin name */
  pluginName: string;
  /** Priority level (higher numbers = higher priority) */
  priority: number;
  /** Reason for priority assignment */
  reason?: string;
}

/**
 * Conflict detection configuration
 */
export interface ConflictDetectionConfig {
  /** Enable automatic conflict detection */
  enabled: boolean;
  /** Detection strategies to use */
  strategies: ConflictType[];
  /** Default resolution strategy */
  defaultResolution: ResolutionStrategy;
  /** Plugin priorities */
  pluginPriorities: PluginPriority[];
  /** Custom conflict rules */
  customRules?: ConflictRule[];
}

/**
 * Custom conflict rule
 */
export interface ConflictRule {
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Function to detect conflicts */
  detect: (plugins: IPlugin[]) => PluginConflict[];
  /** Function to resolve conflicts */
  resolve?: (conflict: PluginConflict) => Promise<ConflictResolution>;
}

/**
 * Plugin Conflict Detector Implementation
 */
@Injectable()
export class PluginConflictDetector {
  private conflicts = new Map<string, PluginConflict>();
  private resolutions = new Map<string, ConflictResolution>();
  private config: ConflictDetectionConfig;
  private customRules = new Map<string, ConflictRule>();

  constructor(
    @Inject(LOGGER) private readonly logger: any
  ) {
    this.config = {
      enabled: true,
      strategies: Object.values(ConflictType),
      defaultResolution: ResolutionStrategy.MANUAL,
      pluginPriorities: []
    };
  }

  /**
   * Configure conflict detection
   */
  configure(config: Partial<ConflictDetectionConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Register custom rules
    if (config.customRules) {
      for (const rule of config.customRules) {
        this.customRules.set(rule.name, rule);
      }
    }

    this.logger?.info('Conflict detector configured', { config: this.config });
  }

  /**
   * Detect conflicts between plugins
   */
  detectConflicts(plugins: IPlugin[]): PluginConflict[] {
    if (!this.config.enabled) {
      return [];
    }

    const conflicts: PluginConflict[] = [];
    
    // Clear previous conflicts
    this.conflicts.clear();

    // Run detection strategies
    for (const strategy of this.config.strategies) {
      switch (strategy) {
        case ConflictType.TOOL_NAME:
          conflicts.push(...this.detectToolNameConflicts(plugins));
          break;
        case ConflictType.RESOURCE_URI:
          conflicts.push(...this.detectResourceUriConflicts(plugins));
          break;
        case ConflictType.PROMPT_NAME:
          conflicts.push(...this.detectPromptNameConflicts(plugins));
          break;
        case ConflictType.SERVICE_CLASS:
          conflicts.push(...this.detectServiceClassConflicts(plugins));
          break;
        case ConflictType.DEPENDENCY:
          conflicts.push(...this.detectDependencyConflicts(plugins));
          break;
        case ConflictType.VERSION:
          conflicts.push(...this.detectVersionConflicts(plugins));
          break;
        case ConflictType.CONFIGURATION:
          conflicts.push(...this.detectConfigurationConflicts(plugins));
          break;
      }
    }

    // Run custom rules
    for (const rule of this.customRules.values()) {
      try {
        const customConflicts = rule.detect(plugins);
        conflicts.push(...customConflicts);
      } catch (error) {
        this.logger?.error(`Custom rule ${rule.name} failed:`, error);
      }
    }

    // Store conflicts
    for (const conflict of conflicts) {
      this.conflicts.set(conflict.id, conflict);
    }

    this.logger?.info(`Detected ${conflicts.length} conflicts`, {
      conflicts: conflicts.map(c => ({ id: c.id, type: c.type, severity: c.severity }))
    });

    return conflicts;
  }

  /**
   * Detect tool name conflicts
   */
  private detectToolNameConflicts(plugins: IPlugin[]): PluginConflict[] {
    const conflicts: PluginConflict[] = [];
    const toolMap = new Map<string, IPlugin[]>();

    // Group plugins by tool names
    for (const plugin of plugins) {
      if (plugin.services) {
        for (const serviceClass of plugin.services) {
          // Extract tool names from service (would need metadata collector integration)
          // For now, simulate tool extraction
          const mockTools = this.extractMockToolsFromService(serviceClass);
          for (const toolName of mockTools) {
            if (!toolMap.has(toolName)) {
              toolMap.set(toolName, []);
            }
            toolMap.get(toolName)!.push(plugin);
          }
        }
      }
    }

    // Find conflicts
    for (const [toolName, conflictingPlugins] of toolMap.entries()) {
      if (conflictingPlugins.length > 1) {
        const conflict: PluginConflict = {
          id: `tool_${toolName}_${Date.now()}`,
          type: ConflictType.TOOL_NAME,
          severity: ConflictSeverity.ERROR,
          plugins: conflictingPlugins,
          resource: {
            identifier: toolName,
            type: 'tool'
          },
          recommendedStrategy: this.getRecommendedStrategy(conflictingPlugins, ConflictType.TOOL_NAME),
          possibleStrategies: [
            ResolutionStrategy.FIRST_WINS,
            ResolutionStrategy.LAST_WINS,
            ResolutionStrategy.PRIORITY,
            ResolutionStrategy.DISABLE,
            ResolutionStrategy.RENAME
          ],
          description: `Multiple plugins define tool '${toolName}': ${conflictingPlugins.map(p => p.name).join(', ')}`,
          detectedAt: new Date()
        };

        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * Detect resource URI conflicts
   */
  private detectResourceUriConflicts(plugins: IPlugin[]): PluginConflict[] {
    const conflicts: PluginConflict[] = [];
    const uriMap = new Map<string, IPlugin[]>();

    // This would integrate with actual resource metadata
    // For now, simulate resource URI extraction

    for (const [uri, conflictingPlugins] of uriMap.entries()) {
      if (conflictingPlugins.length > 1) {
        const conflict: PluginConflict = {
          id: `resource_${uri.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
          type: ConflictType.RESOURCE_URI,
          severity: ConflictSeverity.ERROR,
          plugins: conflictingPlugins,
          resource: {
            identifier: uri,
            type: 'resource'
          },
          recommendedStrategy: ResolutionStrategy.RENAME,
          possibleStrategies: [ResolutionStrategy.RENAME, ResolutionStrategy.PRIORITY, ResolutionStrategy.DISABLE],
          description: `Multiple plugins define resource URI '${uri}': ${conflictingPlugins.map(p => p.name).join(', ')}`,
          detectedAt: new Date()
        };

        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * Detect prompt name conflicts
   */
  private detectPromptNameConflicts(plugins: IPlugin[]): PluginConflict[] {
    const conflicts: PluginConflict[] = [];
    // Similar implementation to tool name conflicts
    return conflicts;
  }

  /**
   * Detect service class conflicts
   */
  private detectServiceClassConflicts(plugins: IPlugin[]): PluginConflict[] {
    const conflicts: PluginConflict[] = [];
    const serviceMap = new Map<string, IPlugin[]>();

    // Group plugins by service class names
    for (const plugin of plugins) {
      if (plugin.services) {
        for (const serviceClass of plugin.services) {
          const serviceName = serviceClass.name;
          if (!serviceMap.has(serviceName)) {
            serviceMap.set(serviceName, []);
          }
          serviceMap.get(serviceName)!.push(plugin);
        }
      }
    }

    // Find conflicts
    for (const [serviceName, conflictingPlugins] of serviceMap.entries()) {
      if (conflictingPlugins.length > 1) {
        const conflict: PluginConflict = {
          id: `service_${serviceName}_${Date.now()}`,
          type: ConflictType.SERVICE_CLASS,
          severity: ConflictSeverity.WARNING,
          plugins: conflictingPlugins,
          resource: {
            identifier: serviceName,
            type: 'service'
          },
          recommendedStrategy: ResolutionStrategy.PRIORITY,
          possibleStrategies: [ResolutionStrategy.PRIORITY, ResolutionStrategy.DISABLE, ResolutionStrategy.MANUAL],
          description: `Multiple plugins define service class '${serviceName}': ${conflictingPlugins.map(p => p.name).join(', ')}`,
          detectedAt: new Date()
        };

        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * Detect dependency conflicts
   */
  private detectDependencyConflicts(plugins: IPlugin[]): PluginConflict[] {
    const conflicts: PluginConflict[] = [];
    const dependencyMap = new Map<string, { plugin: IPlugin; version: string }[]>();

    // Analyze dependency versions
    for (const plugin of plugins) {
      if (plugin.dependencies) {
        for (const dependency of plugin.dependencies) {
          const depName = dependency;
          const depVersion = '*'; // Default version for string dependencies
          
          if (!dependencyMap.has(depName)) {
            dependencyMap.set(depName, []);
          }
          dependencyMap.get(depName)!.push({ plugin, version: depVersion });
        }
      }
    }

    // Find version conflicts
    for (const [depName, dependencies] of dependencyMap.entries()) {
      if (dependencies.length > 1) {
        const versions = [...new Set(dependencies.map(d => d.version))];
        if (versions.length > 1 && !versions.includes('*')) {
          const conflict: PluginConflict = {
            id: `dependency_${depName}_${Date.now()}`,
            type: ConflictType.DEPENDENCY,
            severity: ConflictSeverity.WARNING,
            plugins: dependencies.map(d => d.plugin),
            resource: {
              identifier: depName,
              type: 'dependency',
              context: { versions }
            },
            recommendedStrategy: ResolutionStrategy.MANUAL,
            possibleStrategies: [ResolutionStrategy.MANUAL, ResolutionStrategy.DISABLE],
            description: `Dependency '${depName}' has conflicting versions: ${versions.join(', ')}`,
            detectedAt: new Date()
          };

          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect version conflicts
   */
  private detectVersionConflicts(plugins: IPlugin[]): PluginConflict[] {
    const conflicts: PluginConflict[] = [];
    const nameMap = new Map<string, IPlugin[]>();

    // Group plugins by name
    for (const plugin of plugins) {
      if (!nameMap.has(plugin.name)) {
        nameMap.set(plugin.name, []);
      }
      nameMap.get(plugin.name)!.push(plugin);
    }

    // Find plugins with same name but different versions
    for (const [pluginName, sameNamePlugins] of nameMap.entries()) {
      if (sameNamePlugins.length > 1) {
        const versions = [...new Set(sameNamePlugins.map(p => p.version))];
        if (versions.length > 1) {
          const conflict: PluginConflict = {
            id: `version_${pluginName}_${Date.now()}`,
            type: ConflictType.VERSION,
            severity: ConflictSeverity.ERROR,
            plugins: sameNamePlugins,
            resource: {
              identifier: pluginName,
              type: 'dependency',
              context: { versions }
            },
            recommendedStrategy: ResolutionStrategy.LAST_WINS,
            possibleStrategies: [ResolutionStrategy.LAST_WINS, ResolutionStrategy.FIRST_WINS, ResolutionStrategy.MANUAL],
            description: `Plugin '${pluginName}' has multiple versions: ${versions.join(', ')}`,
            detectedAt: new Date()
          };

          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect configuration conflicts
   */
  private detectConfigurationConflicts(plugins: IPlugin[]): PluginConflict[] {
    const conflicts: PluginConflict[] = [];
    // Implementation would check for conflicting configuration requirements
    return conflicts;
  }

  /**
   * Resolve conflict using specified strategy
   */
  async resolveConflict(conflictId: string, strategy: ResolutionStrategy): Promise<ConflictResolution> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    try {
      let action = '';
      let success = false;

      switch (strategy) {
        case ResolutionStrategy.FIRST_WINS:
          action = `Selected first plugin: ${conflict.plugins[0].name}`;
          success = true;
          break;

        case ResolutionStrategy.LAST_WINS:
          action = `Selected last plugin: ${conflict.plugins[conflict.plugins.length - 1].name}`;
          success = true;
          break;

        case ResolutionStrategy.PRIORITY:
          const priorityPlugin = this.selectByPriority(conflict.plugins);
          action = `Selected priority plugin: ${priorityPlugin.name}`;
          success = true;
          break;

        case ResolutionStrategy.DISABLE:
          action = `Disabled conflicting plugins: ${conflict.plugins.slice(1).map(p => p.name).join(', ')}`;
          success = true;
          break;

        case ResolutionStrategy.RENAME:
          action = 'Renamed conflicting resources';
          success = true;
          break;

        case ResolutionStrategy.MANUAL:
          action = 'Manual resolution required';
          success = false;
          break;

        default:
          throw new Error(`Unknown resolution strategy: ${strategy}`);
      }

      const resolution: ConflictResolution = {
        conflictId,
        strategy,
        action,
        success,
        resolvedAt: new Date()
      };

      this.resolutions.set(conflictId, resolution);
      
      if (success) {
        this.conflicts.delete(conflictId);
      }

      this.logger?.info(`Conflict resolved`, { conflictId, strategy, action });

      return resolution;

    } catch (error) {
      const resolution: ConflictResolution = {
        conflictId,
        strategy,
        action: 'Resolution failed',
        success: false,
        error: (error as Error).message,
        resolvedAt: new Date()
      };

      this.resolutions.set(conflictId, resolution);
      this.logger?.error(`Conflict resolution failed`, { conflictId, strategy, error });

      return resolution;
    }
  }

  /**
   * Get all current conflicts
   */
  getConflicts(): PluginConflict[] {
    return Array.from(this.conflicts.values());
  }

  /**
   * Get conflict by ID
   */
  getConflict(conflictId: string): PluginConflict | null {
    return this.conflicts.get(conflictId) || null;
  }

  /**
   * Get resolution history
   */
  getResolutions(): ConflictResolution[] {
    return Array.from(this.resolutions.values());
  }

  /**
   * Clear all conflicts and resolutions
   */
  clear(): void {
    this.conflicts.clear();
    this.resolutions.clear();
  }

  /**
   * Get recommended resolution strategy for conflict type
   */
  private getRecommendedStrategy(plugins: IPlugin[], conflictType: ConflictType): ResolutionStrategy {
    // Logic to determine best strategy based on plugin metadata and conflict type
    if (this.hasPriorityConfiguration(plugins)) {
      return ResolutionStrategy.PRIORITY;
    }

    switch (conflictType) {
      case ConflictType.TOOL_NAME:
      case ConflictType.PROMPT_NAME:
        return ResolutionStrategy.RENAME;
      case ConflictType.RESOURCE_URI:
        return ResolutionStrategy.RENAME;
      case ConflictType.VERSION:
        return ResolutionStrategy.LAST_WINS;
      case ConflictType.SERVICE_CLASS:
        return ResolutionStrategy.PRIORITY;
      default:
        return ResolutionStrategy.MANUAL;
    }
  }

  /**
   * Check if plugins have priority configuration
   */
  private hasPriorityConfiguration(plugins: IPlugin[]): boolean {
    return plugins.some(plugin => 
      this.config.pluginPriorities.some(p => p.pluginName === plugin.name)
    );
  }

  /**
   * Select plugin by priority
   */
  private selectByPriority(plugins: IPlugin[]): IPlugin {
    let highestPriority = -1;
    let selectedPlugin = plugins[0];

    for (const plugin of plugins) {
      const priorityConfig = this.config.pluginPriorities.find(p => p.pluginName === plugin.name);
      const priority = priorityConfig?.priority || 0;
      
      if (priority > highestPriority) {
        highestPriority = priority;
        selectedPlugin = plugin;
      }
    }

    return selectedPlugin;
  }

  /**
   * Extract actual tool names from service class using metadata collector
   */
  private extractMockToolsFromService(serviceClass: any): string[] {
    if (!serviceClass || !serviceClass.prototype) {
      return [];
    }

    const toolNames: string[] = [];
    const prototype = serviceClass.prototype;

    // Get all property names from the prototype
    const propertyNames = Object.getOwnPropertyNames(prototype);

    for (const propertyName of propertyNames) {
      if (typeof prototype[propertyName] === 'function' && propertyName !== 'constructor') {
        // Check if this method has MCP tool metadata
        const metadata = Reflect.getMetadata('mcp:tool', prototype, propertyName);
        if (metadata && metadata.name) {
          toolNames.push(metadata.name);
        }
      }
    }

    return toolNames;
  }
}

/**
 * Built-in conflict rules
 */
export class BuiltinConflictRules {
  /**
   * Create rule for detecting circular dependencies
   */
  static createCircularDependencyRule(): ConflictRule {
    return {
      name: 'circular_dependency',
      description: 'Detect circular dependencies between plugins',
      detect: (plugins: IPlugin[]) => {
        // Implementation would build dependency graph and detect cycles
        return [];
      }
    };
  }

  /**
   * Create rule for detecting incompatible plugin versions
   */
  static createIncompatibleVersionRule(): ConflictRule {
    return {
      name: 'incompatible_version',
      description: 'Detect incompatible plugin versions',
      detect: (plugins: IPlugin[]) => {
        // Implementation would check version compatibility
        return [];
      }
    };
  }
}