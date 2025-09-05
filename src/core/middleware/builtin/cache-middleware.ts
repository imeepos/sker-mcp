/**
 * Cache Middleware
 * 
 * Enterprise-grade caching middleware that provides intelligent result caching
 * with configurable TTL, cache invalidation, and multiple storage backends.
 */

import { Injectable, Inject } from '@sker/di';
import crypto from 'crypto';
import { LOGGER } from '../../tokens.js';
import type { IMiddleware, MiddlewareContext, NextFunction } from '../types.js';

/**
 * Logger interface for dependency injection
 */
interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Cache entry with metadata
 */
export interface CacheEntry {
  /**
   * Cached data
   */
  data: any;
  
  /**
   * Timestamp when the entry was created
   */
  createdAt: number;
  
  /**
   * Timestamp when the entry expires
   */
  expiresAt: number;
  
  /**
   * Number of times this entry has been accessed
   */
  accessCount: number;
  
  /**
   * Last access timestamp
   */
  lastAccessedAt: number;
  
  /**
   * Tags for cache invalidation
   */
  tags?: string[];
  
  /**
   * Cache metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRatio: number;
  totalEntries: number;
  totalSize: number;
  averageAccessTime: number;
}

/**
 * Cache storage interface
 */
export interface ICacheStorage {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, entry: CacheEntry): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
  size(): Promise<number>;
}

/**
 * In-memory cache storage implementation
 */
export class MemoryCacheStorage implements ICacheStorage {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  async get(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();

    return entry;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      await this.evictLRU();
    }

    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async keys(pattern?: string): Promise<string[]> {
    const keys = Array.from(this.cache.keys());
    
    if (pattern) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return keys.filter(key => regex.test(key));
    }
    
    return keys;
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  /**
   * Evict least recently used entry
   */
  private async evictLRU(): Promise<void> {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

/**
 * Cache middleware configuration options
 */
export interface CacheMiddlewareOptions {
  /**
   * Default TTL in milliseconds
   */
  defaultTTL?: number;
  
  /**
   * Cache storage implementation
   */
  storage?: ICacheStorage;
  
  /**
   * Whether caching is enabled
   */
  enabled?: boolean;
  
  /**
   * Cache key prefix
   */
  keyPrefix?: string;
  
  /**
   * Whether to cache error responses
   */
  cacheErrors?: boolean;
  
  /**
   * Whether to use request arguments in cache key
   */
  includeArgsInKey?: boolean;
  
  /**
   * Custom cache key generator
   */
  keyGenerator?: (context: MiddlewareContext) => string;
  
  /**
   * Cache invalidation tags
   */
  tags?: string[];
  
  /**
   * Whether to compress cached data
   */
  compress?: boolean;
  
  /**
   * Maximum cache entry size (bytes)
   */
  maxEntrySize?: number;
  
  /**
   * Cache warming configuration
   */
  warmup?: {
    enabled: boolean;
    interval: number;
    keys: string[];
  };
  
  /**
   * Cache invalidation rules
   */
  invalidation?: {
    onUpdate?: boolean;
    onDelete?: boolean;
    patterns?: string[];
  };
}

/**
 * Default cache middleware configuration
 */
const DEFAULT_OPTIONS: Required<Omit<CacheMiddlewareOptions, 'storage' | 'keyGenerator' | 'warmup' | 'invalidation'>> = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  enabled: true,
  keyPrefix: 'mcp:cache:',
  cacheErrors: false,
  includeArgsInKey: true,
  tags: [],
  compress: false,
  maxEntrySize: 1024 * 1024 // 1MB
};

/**
 * Enterprise-grade cache middleware implementation
 */
@Injectable()
export class CacheMiddleware implements IMiddleware {
  public readonly name = 'CacheMiddleware';
  public readonly priority = 300; // Execute after validation but before business logic

  private readonly options: Required<Omit<CacheMiddlewareOptions, 'storage' | 'keyGenerator' | 'warmup' | 'invalidation'>> & 
    Pick<CacheMiddlewareOptions, 'storage' | 'keyGenerator' | 'warmup' | 'invalidation'>;
  private readonly storage: ICacheStorage;
  private readonly stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRatio: 0,
    totalEntries: 0,
    totalSize: 0,
    averageAccessTime: 0
  };

  constructor(
    @Inject(LOGGER) private readonly logger: ILogger,
    options: CacheMiddlewareOptions = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.storage = options.storage || new MemoryCacheStorage();
    
    // Start cache warmup if configured
    if (this.options.warmup?.enabled) {
      this.startCacheWarmup();
    }
  }

  async execute(context: MiddlewareContext, next: NextFunction): Promise<any> {
    if (!this.options.enabled) {
      return await next();
    }

    const cacheKey = this.generateCacheKey(context);
    const startTime = Date.now();

    try {
      // Try to get from cache
      const cachedEntry = await this.storage.get(cacheKey);
      
      if (cachedEntry) {
        // Cache hit
        this.stats.hits++;
        this.updateStats();
        
        const accessTime = Date.now() - startTime;
        this.logger.debug(
          `[${context.requestId}] Cache HIT for ${context.methodName} (${accessTime}ms)`,
          { cacheKey, tags: cachedEntry.tags }
        );
        
        return cachedEntry.data;
      }

      // Cache miss - execute the handler
      this.stats.misses++;
      const result = await next();
      
      // Cache the result if it's cacheable
      if (await this.shouldCache(result, context)) {
        await this.cacheResult(cacheKey, result, context);
      }
      
      this.updateStats();
      
      const accessTime = Date.now() - startTime;
      this.logger.debug(
        `[${context.requestId}] Cache MISS for ${context.methodName} (${accessTime}ms)`,
        { cacheKey }
      );
      
      return result;
    } catch (error) {
      // Handle cache errors gracefully
      this.logger.warn(`Cache error for ${context.methodName}:`, error);
      
      // If caching errors is enabled, cache the error
      if (this.options.cacheErrors && this.isRetryableError(error)) {
        try {
          await this.cacheResult(cacheKey, { error: this.serializeError(error) }, context);
        } catch (cacheError) {
          this.logger.error('Failed to cache error:', cacheError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Generate cache key for the request
   */
  private generateCacheKey(context: MiddlewareContext): string {
    if (this.options.keyGenerator) {
      return this.options.keyPrefix + this.options.keyGenerator(context);
    }

    const { requestType, methodName } = context;
    let keyParts = [requestType, methodName];

    // Include arguments in key if configured
    if (this.options.includeArgsInKey && context.args) {
      const argsHash = this.hashObject(context.args);
      keyParts.push(argsHash);
    }

    // Include request params in key
    if (context.request && 'params' in context.request && context.request.params) {
      const paramsHash = this.hashObject(context.request.params);
      keyParts.push(paramsHash);
    }

    return this.options.keyPrefix + keyParts.join(':');
  }

  /**
   * Check if result should be cached
   */
  private async shouldCache(result: any, context: MiddlewareContext): Promise<boolean> {
    // Don't cache if result is null or undefined
    if (result == null) {
      return false;
    }

    // Don't cache if result is too large
    if (this.options.maxEntrySize) {
      const resultSize = this.calculateSize(result);
      if (resultSize > this.options.maxEntrySize) {
        this.logger.warn(
          `Result too large to cache: ${resultSize} bytes (max: ${this.options.maxEntrySize})`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Cache the result
   */
  private async cacheResult(key: string, result: any, context: MiddlewareContext): Promise<void> {
    const now = Date.now();
    const ttl = this.getTTL(context);
    
    const entry: CacheEntry = {
      data: this.options.compress ? this.compressData(result) : result,
      createdAt: now,
      expiresAt: now + ttl,
      accessCount: 0,
      lastAccessedAt: now,
      tags: [...(this.options.tags || []), context.requestType, context.methodName],
      metadata: {
        requestType: context.requestType,
        methodName: context.methodName,
        compressed: this.options.compress
      }
    };

    try {
      await this.storage.set(key, entry);
      this.logger.debug(
        `Cached result for ${context.methodName} (TTL: ${ttl}ms)`,
        { key, tags: entry.tags }
      );
    } catch (error) {
      this.logger.error('Failed to cache result:', error);
    }
  }

  /**
   * Get TTL for the request
   */
  private getTTL(context: MiddlewareContext): number {
    // Check metadata for custom TTL
    if (context.metadata?.cacheTTL) {
      return context.metadata.cacheTTL;
    }

    return this.options.defaultTTL;
  }

  /**
   * Hash object to create cache key component
   */
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
  }

  /**
   * Calculate size of data in bytes
   */
  private calculateSize(data: any): number {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  }

  /**
   * Compress data (simple JSON stringification for now)
   */
  private compressData(data: any): any {
    return JSON.stringify(data);
  }

  /**
   * Check if error is retryable and should be cached
   */
  private isRetryableError(error: any): boolean {
    // Don't cache validation errors or client errors
    if (error.code && error.code >= 400 && error.code < 500) {
      return false;
    }

    return true;
  }

  /**
   * Serialize error for caching
   */
  private serializeError(error: any): any {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    };
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRatio = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Start cache warmup process
   */
  private startCacheWarmup(): void {
    if (!this.options.warmup) return;

    const { interval, keys } = this.options.warmup;
    
    setInterval(async () => {
      for (const key of keys) {
        try {
          const entry = await this.storage.get(key);
          if (!entry || Date.now() > entry.expiresAt - interval) {
            // Pre-warm cache by refreshing soon-to-expire entries
            this.logger.debug(`Cache warmup triggered for key: ${key}`);
          }
        } catch (error) {
          this.logger.warn(`Cache warmup failed for key ${key}:`, error);
        }
      }
    }, interval);
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidate(pattern: string): Promise<number> {
    try {
      const keys = await this.storage.keys(pattern);
      let invalidated = 0;

      for (const key of keys) {
        const deleted = await this.storage.delete(key);
        if (deleted) {
          invalidated++;
        }
      }

      this.logger.info(`Invalidated ${invalidated} cache entries matching pattern: ${pattern}`);
      return invalidated;
    } catch (error) {
      this.logger.error(`Failed to invalidate cache pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      const keys = await this.storage.keys();
      let invalidated = 0;

      for (const key of keys) {
        const entry = await this.storage.get(key);
        if (entry && entry.tags && entry.tags.some(tag => tags.includes(tag))) {
          const deleted = await this.storage.delete(key);
          if (deleted) {
            invalidated++;
          }
        }
      }

      this.logger.info(`Invalidated ${invalidated} cache entries with tags: ${tags.join(', ')}`);
      return invalidated;
    } catch (error) {
      this.logger.error(`Failed to invalidate cache by tags:`, error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      await this.storage.clear();
      this.stats.hits = 0;
      this.stats.misses = 0;
      this.stats.hitRatio = 0;
      this.logger.info('Cache cleared successfully');
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
    }
  }
}

// /**
//  * Factory function to create cache middleware with custom options
//  */
// export function createCacheMiddleware(options: CacheMiddlewareOptions = {}) {
//   class CustomCacheMiddleware extends CacheMiddleware {
//     constructor(logger: ILogger) {
//       super(logger, options);
//     }
//   }
//   return CustomCacheMiddleware;
// }

/**
 * Predefined cache middleware variants
 */
@Injectable()
export class ShortTermCacheMiddleware extends CacheMiddleware {
  constructor(@Inject(LOGGER) logger: ILogger) {
    super(logger, {
      defaultTTL: 60 * 1000, // 1 minute
      cacheErrors: false
    });
  }
}

@Injectable()
export class LongTermCacheMiddleware extends CacheMiddleware {
  constructor(@Inject(LOGGER) logger: ILogger) {
    super(logger, {
      defaultTTL: 60 * 60 * 1000, // 1 hour
      cacheErrors: true
    });
  }
}