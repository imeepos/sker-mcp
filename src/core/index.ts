/**
 * Core Module Index
 * 
 * This module re-exports all core components of the Sker Daemon MCP system
 * for convenient importing by other modules and plugins.
 */

// Type definitions
export * from './types';

// Dependency injection tokens
export * from './tokens';

// Provider configuration
export * from './providers';

// Project management
export { ProjectManager } from './project-manager';

// Metadata collection
export { MetadataCollector } from './metadata-collector';
export type { AllMetadata } from './metadata-collector';

// Decorators
export * from './decorators';

// Configuration system
export * from './config';