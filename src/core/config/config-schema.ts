/**
 * Configuration Schema Definitions
 * 
 * This module provides Zod schema definitions for configuration validation.
 * It defines comprehensive schemas for all configuration aspects including
 * server settings, logging, plugins, and environment-specific configurations.
 */

import { z } from 'zod';

/**
 * Server configuration schema
 */
export const ServerConfigSchema = z.object({
  /** Server name */
  name: z.string().default('sker-daemon-mcp'),

  /** Server version */
  version: z.string().default('1.0.0'),

  /** Transport configuration */
  transport: z.object({
    /** Transport type */
    type: z.enum(['stdio', 'http']).default('stdio'),

    /** HTTP server host (optional for stdio) */
    host: z.string().optional(),

    /** HTTP server port (optional for stdio) */
    port: z.number().int().min(1000).max(65535).optional(),

    /** HTTP transport specific settings */
    http: z.object({
      /** HTTP server port */
      port: z.number().int().min(1000).max(65535).optional(),

      /** HTTP server host */
      host: z.string().optional(),

      /** Enable CORS */
      cors: z.boolean().default(true),

      /** CORS origin whitelist */
      corsOrigins: z.array(z.string()).default(['*']),

      /** Enable session management */
      enableSessions: z.boolean().default(true),

      /** Enable JSON response mode (disable SSE streaming) */
      enableJsonResponse: z.boolean().default(false),

      /** Request timeout in milliseconds */
      requestTimeout: z.number().int().min(1000).max(300000).default(30000),

      /** Maximum request body size */
      maxBodySize: z.string().regex(/^\d+[KMGT]?B$/i).default('10MB'),

      /** Enable DNS rebinding protection */
      enableDnsRebindingProtection: z.boolean().default(false),

      /** Allowed hosts for DNS rebinding protection */
      allowedHosts: z.array(z.string()).default([]),

      /** Allowed origins for DNS rebinding protection */
      allowedOrigins: z.array(z.string()).default([])
    }).optional()
  }).default({ type: 'stdio' }),

  /** Server capabilities */
  capabilities: z.object({
    /** Enable logging */
    logging: z.boolean().default(true),

    /** Enable sampling */
    sampling: z.boolean().default(false),

    /** Enable experimental features */
    experimental: z.boolean().default(false)
  }).default({ logging: true, sampling: false, experimental: false }),

  /** Resource limits */
  limits: z.object({
    /** Maximum number of concurrent requests */
    maxConcurrentRequests: z.number().int().min(1).max(1000).default(100),

    /** Request timeout in milliseconds */
    requestTimeout: z.number().int().min(1000).max(300000).default(30000),

    /** Maximum request body size in bytes */
    maxRequestSize: z.number().int().min(1024).max(10485760).default(1048576), // 1MB

    /** Maximum response size in bytes */
    maxResponseSize: z.number().int().min(1024).max(10485760).default(5242880) // 5MB
  }).default({} as any)
});

/**
 * Logging configuration schema
 */
export const LoggingConfigSchema = z.object({
  /** Global logging level */
  level: z.enum(['error', 'warn', 'info', 'debug', 'verbose', 'silly']).default('info'),

  /** Logging format */
  format: z.enum(['json', 'simple', 'dev']).default('simple'),

  /** Enable colorized output */
  colorize: z.boolean().default(true),

  /** Enable timestamp */
  timestamp: z.boolean().default(true),

  /** Layer-specific configurations */
  layers: z.object({
    /** Platform layer logging */
    platform: z.object({
      /** Log level */
      level: z.enum(['error', 'warn', 'info', 'debug', 'verbose', 'silly']).default('warn'),

      /** Enable console output */
      console: z.boolean().default(true),

      /** Enable file output */
      file: z.boolean().default(true)
    }).default({} as any),

    /** Application layer logging */
    application: z.object({
      /** Log level */
      level: z.enum(['error', 'warn', 'info', 'debug', 'verbose', 'silly']).default('info'),

      /** Enable console output */
      console: z.boolean().default(true),

      /** Enable file output */
      file: z.boolean().default(true)
    }).default({} as any),

    /** Plugin layer logging */
    plugin: z.object({
      /** Log level */
      level: z.enum(['error', 'warn', 'info', 'debug', 'verbose', 'silly']).default('debug'),

      /** Enable console output */
      console: z.boolean().default(false),

      /** Enable file output */
      file: z.boolean().default(true)
    }).default({} as any)
  }).default({} as any),

  /** File rotation settings */
  rotation: z.object({
    /** Maximum file size (e.g., '20MB') */
    maxSize: z.string().regex(/^\d+[KMGT]?B$/i).default('20MB'),

    /** Maximum number of files to keep */
    maxFiles: z.union([z.number().int().min(1), z.string()]).default(14),

    /** Date pattern for rotation */
    datePattern: z.string().default('YYYY-MM-DD'),

    /** Enable compression */
    compress: z.boolean().default(true)
  }).default({} as any)
});

/**
 * Plugin configuration schema
 */
export const PluginConfigSchema = z.object({
  /** Plugin discovery settings */
  discovery: z.object({
    /** Plugin directories to search */
    directories: z.array(z.string()).default(['plugins']),

    /** Maximum search depth */
    maxDepth: z.number().int().min(1).max(10).default(3),

    /** Watch for changes */
    watch: z.boolean().default(false),

    /** Include development plugins */
    includeDev: z.boolean().default(false)
  }).default({} as any),

  /** Plugin loading settings */
  loading: z.object({
    /** Enable parallel loading */
    parallel: z.boolean().default(true),

    /** Loading timeout in milliseconds */
    timeout: z.number().int().min(1000).max(60000).default(10000),

    /** Maximum concurrent loads */
    maxConcurrent: z.number().int().min(1).max(10).default(3)
  }).default({} as any),

  /** Plugin isolation settings */
  isolation: z.object({
    /** Default isolation level */
    default: z.enum(['none', 'service', 'full']).default('service'),

    /** Plugin-specific isolation levels */
    plugins: z.record(z.string(), z.enum(['none', 'service', 'full'])).default({} as any)
  }).default({} as any),

  /** Plugin-specific configurations */
  plugins: z.record(z.string(), z.any()).default({} as any)
});

/**
 * Security configuration schema
 */
export const SecurityConfigSchema = z.object({
  /** Enable authentication */
  authentication: z.boolean().default(false),

  /** Enable authorization */
  authorization: z.boolean().default(false),

  /** API key settings */
  apiKey: z.object({
    /** Enable API key authentication */
    enabled: z.boolean().default(false),

    /** API key header name */
    header: z.string().default('X-API-Key'),

    /** Valid API keys */
    keys: z.array(z.string()).default([])
  }).default({} as any),

  /** Rate limiting settings */
  rateLimit: z.object({
    /** Enable rate limiting */
    enabled: z.boolean().default(false),

    /** Maximum requests per window */
    maxRequests: z.number().int().min(1).max(10000).default(100),

    /** Time window in milliseconds */
    windowMs: z.number().int().min(1000).max(3600000).default(60000), // 1 minute

    /** Skip failed requests */
    skipFailedRequests: z.boolean().default(false)
  }).default({} as any)
});

/**
 * Performance configuration schema
 */
export const PerformanceConfigSchema = z.object({
  /** Enable performance monitoring */
  monitoring: z.boolean().default(false),

  /** Caching settings */
  cache: z.object({
    /** Enable caching */
    enabled: z.boolean().default(false),

    /** Cache size limit */
    maxSize: z.number().int().min(1).max(1000).default(100),

    /** Cache TTL in milliseconds */
    ttl: z.number().int().min(1000).max(3600000).default(300000), // 5 minutes

    /** Cache cleanup interval */
    cleanupInterval: z.number().int().min(10000).max(3600000).default(60000) // 1 minute
  }).default({} as any),

  /** Memory management */
  memory: z.object({
    /** Enable memory monitoring */
    monitoring: z.boolean().default(false),

    /** Memory usage warning threshold (percentage) */
    warningThreshold: z.number().min(0).max(100).default(80),

    /** Garbage collection hints */
    gcHints: z.boolean().default(false)
  }).default({} as any)
});

/**
 * Development configuration schema
 */
export const DevelopmentConfigSchema = z.object({
  /** Enable development mode */
  enabled: z.boolean().default(false),

  /** Enable hot reload */
  hotReload: z.boolean().default(false),

  /** Enable debug mode */
  debug: z.boolean().default(false),

  /** Enable verbose logging */
  verbose: z.boolean().default(false),

  /** Mock settings */
  mocks: z.object({
    /** Enable mock services */
    enabled: z.boolean().default(false),

    /** Mock configuration */
    config: z.record(z.string(), z.any()).default({})
  }).default({ enabled: false, config: {} })
});

/**
 * Environment-specific configuration schema
 */
export const EnvironmentConfigSchema = z.object({
  /** Environment name */
  environment: z.enum(['development', 'testing', 'production']).default('development'),

  /** Environment-specific settings */
  settings: z.object({
    /** Development settings */
    development: DevelopmentConfigSchema.optional(),

    /** Testing settings */
    testing: z.object({
      /** Enable test mode */
      enabled: z.boolean().default(false),

      /** Test timeout */
      timeout: z.number().int().min(1000).max(300000).default(30000),

      /** Mock external services */
      mockExternal: z.boolean().default(true)
    }).optional(),

    /** Production settings */
    production: z.object({
      /** Enable production optimizations */
      optimizations: z.boolean().default(true),

      /** Enable health checks */
      healthChecks: z.boolean().default(true),

      /** Monitoring endpoints */
      monitoring: z.boolean().default(true)
    }).optional()
  }).default({} as any)
});

/**
 * Main configuration schema
 */
export const ConfigSchema = z.object({
  /** Configuration version */
  version: z.string().default('1.0.0'),

  /** Server configuration */
  server: ServerConfigSchema.default({} as any),

  /** Logging configuration */
  logging: LoggingConfigSchema.default({} as any),

  /** Plugin configuration */
  plugins: PluginConfigSchema.default({} as any),

  /** Security configuration */
  security: SecurityConfigSchema.default({} as any),

  /** Performance configuration */
  performance: PerformanceConfigSchema.default({} as any),

  /** Environment configuration */
  environment: EnvironmentConfigSchema.default({} as any)
});

/**
 * Configuration types derived from schemas
 */
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type PluginConfig = z.infer<typeof PluginConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;
export type DevelopmentConfig = z.infer<typeof DevelopmentConfigSchema>;
export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Configuration validation utilities
 */
export class ConfigValidator {
  /**
   * Validate complete configuration
   */
  static validateConfig(data: unknown): Config {
    return ConfigSchema.parse(data);
  }

  /**
   * Safely validate configuration with error handling
   */
  static safeValidateConfig(data: unknown): { success: true; data: Config } | { success: false; error: z.ZodError } {
    const result = ConfigSchema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error };
    }
  }

  /**
   * Validate server configuration
   */
  static validateServerConfig(data: unknown): ServerConfig {
    return ServerConfigSchema.parse(data);
  }

  /**
   * Validate logging configuration
   */
  static validateLoggingConfig(data: unknown): LoggingConfig {
    return LoggingConfigSchema.parse(data);
  }

  /**
   * Validate plugin configuration
   */
  static validatePluginConfig(data: unknown): PluginConfig {
    return PluginConfigSchema.parse(data);
  }

  /**
   * Get configuration defaults
   */
  static getDefaults(): Config {
    return ConfigSchema.parse({
      version: '1.0.0',
      server: {},
      logging: {},
      plugins: {},
      security: {},
      performance: {},
      environment: {}
    });
  }

  /**
   * Get server configuration defaults
   */
  static getServerDefaults(): ServerConfig {
    return ServerConfigSchema.parse({});
  }

  /**
   * Get logging configuration defaults
   */
  static getLoggingDefaults(): LoggingConfig {
    return LoggingConfigSchema.parse({});
  }

  /**
   * Get plugin configuration defaults
   */
  static getPluginDefaults(): PluginConfig {
    return PluginConfigSchema.parse({});
  }
}

/**
 * Configuration merge utilities
 */
export class ConfigMerger {
  /**
   * Deep merge configuration objects
   */
  static mergeConfigs<T>(...configs: Partial<T>[]): T {
    const result = {} as T;

    for (const config of configs) {
      ConfigMerger.deepMerge(result, config);
    }

    return result;
  }

  /**
   * Deep merge two objects
   */
  private static deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        ConfigMerger.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
}

/**
 * Predefined configuration templates
 */
export const ConfigTemplates = {
  /**
   * Development configuration template
   */
  development: (): Partial<Config> => ({
    environment: {
      environment: 'development',
      settings: {
        development: {
          enabled: true,
          hotReload: true,
          debug: true,
          verbose: true,
          mocks: {
            enabled: false,
            config: {}
          }
        }
      }
    },
    logging: {
      level: 'debug',
      format: 'dev',
      colorize: true,
      timestamp: true,
      layers: {
        platform: { level: 'info', console: true, file: true },
        application: { level: 'debug', console: true, file: true },
        plugin: { level: 'debug', console: true, file: true }
      },
      rotation: {
        maxSize: '10MB',
        maxFiles: 7,
        datePattern: 'YYYY-MM-DD',
        compress: false
      }
    },
    plugins: {
      discovery: {
        directories: ['plugins'],
        maxDepth: 3,
        watch: true,
        includeDev: true
      },
      loading: {
        parallel: false, // Easier debugging
        timeout: 10000,
        maxConcurrent: 1
      },
      isolation: {
        default: 'service' as const,
        plugins: {} as Record<string, 'none' | 'service' | 'full'>
      },
      plugins: {}
    }
  }),

  /**
   * Production configuration template
   */
  production: (): Partial<Config> => ({
    environment: {
      environment: 'production',
      settings: {
        production: {
          optimizations: true,
          healthChecks: true,
          monitoring: true
        }
      }
    },
    logging: {
      level: 'warn',
      format: 'json',
      colorize: false,
      timestamp: true,
      layers: {
        platform: { level: 'error', console: false, file: true },
        application: { level: 'warn', console: false, file: true },
        plugin: { level: 'warn', console: false, file: true }
      },
      rotation: {
        maxSize: '50MB',
        maxFiles: 30,
        datePattern: 'YYYY-MM-DD',
        compress: true
      }
    },
    security: {
      authentication: true,
      authorization: true,
      apiKey: {
        enabled: false,
        header: 'X-API-Key',
        keys: []
      },
      rateLimit: {
        enabled: true,
        maxRequests: 1000,
        windowMs: 60000,
        skipFailedRequests: false
      }
    },
    performance: {
      monitoring: true,
      cache: {
        enabled: true,
        maxSize: 500,
        ttl: 600000,
        cleanupInterval: 60000
      },
      memory: {
        monitoring: true,
        warningThreshold: 85,
        gcHints: true
      }
    }
  }),

  /**
   * Testing configuration template
   */
  testing: (): Partial<Config> => ({
    environment: {
      environment: 'testing',
      settings: {
        testing: {
          enabled: true,
          timeout: 30000,
          mockExternal: true
        }
      }
    },
    logging: {
      level: 'error',
      format: 'simple',
      colorize: false,
      timestamp: true,
      layers: {
        platform: { level: 'error', console: false, file: false },
        application: { level: 'error', console: false, file: false },
        plugin: { level: 'error', console: false, file: false }
      },
      rotation: {
        maxSize: '10MB',
        maxFiles: 3,
        datePattern: 'YYYY-MM-DD',
        compress: true
      }
    },
    plugins: {
      discovery: {
        directories: ['plugins'],
        maxDepth: 3,
        watch: false,
        includeDev: false
      },
      loading: {
        parallel: true,
        timeout: 10000,
        maxConcurrent: 3
      },
      isolation: {
        default: 'service' as const,
        plugins: {} as Record<string, 'none' | 'service' | 'full'>
      },
      plugins: {}
    }
  })
};