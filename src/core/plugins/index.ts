/**
 * Plugins Module Index
 * 
 * Re-exports all plugin-related functionality including the Feature Injector
 * and conflict detection system for convenient importing.
 */

export * from './feature-injector.js';
export * from './conflict-detector.js';
export * from './plugin-discovery.js';
export * from './plugin-loader.js';

// Re-export commonly used types and classes
export {
  FeatureInjector,
  IsolationLevel,
  PluginIsolationUtils
} from './feature-injector.js';

export {
  PluginConflictDetector,
  ConflictType,
  ConflictSeverity,
  ResolutionStrategy,
  BuiltinConflictRules
} from './conflict-detector.js';

export {
  PluginDiscovery,
  PluginDiscoveryUtils,
  PluginPackageSchema
} from './plugin-discovery.js';

export {
  PluginLoader,
  PluginLoaderUtils
} from './plugin-loader.js';

// Re-export types
export type {
  PluginPermissions,
  PluginIsolationOptions,
  PluginContext,
  PluginCommunicationBridge,
  Container,
  IsolatedPluginInstance,
  IFeatureInjector,
  IEnhancedPlugin,
  PluginConflict,
  ConflictResolution,
  PluginPriority,
  ConflictDetectionConfig,
  ConflictRule
} from '../types.js';

export type {
  DiscoveredPlugin,
  PluginDiscoveryOptions,
  PluginPackageMetadata
} from './plugin-discovery.js';

export type {
  PluginLoadResult,
  PluginLoaderOptions,
  PluginExports
} from './plugin-loader.js';