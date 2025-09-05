/**
 * Performance Middleware
 * 
 * Enterprise-grade performance monitoring middleware that provides comprehensive
 * metrics collection, performance analysis, and monitoring capabilities.
 */

import { Injectable, Inject } from '@sker/di';
import { performance } from 'perf_hooks';
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
 * Performance metrics for a single operation
 */
export interface PerformanceMetrics {
  /**
   * Request ID for correlation
   */
  requestId: string;
  
  /**
   * Method name
   */
  methodName: string;
  
  /**
   * Request type (tool, resource, prompt)
   */
  requestType: string;
  
  /**
   * Start timestamp
   */
  startTime: number;
  
  /**
   * End timestamp
   */
  endTime: number;
  
  /**
   * Total execution time in milliseconds
   */
  duration: number;
  
  /**
   * CPU time used (if available)
   */
  cpuTime?: number;
  
  /**
   * Memory usage before operation
   */
  memoryBefore?: NodeJS.MemoryUsage;
  
  /**
   * Memory usage after operation
   */
  memoryAfter?: NodeJS.MemoryUsage;
  
  /**
   * Memory delta
   */
  memoryDelta?: Partial<NodeJS.MemoryUsage>;
  
  /**
   * Success status
   */
  success: boolean;
  
  /**
   * Error information if failed
   */
  error?: {
    name: string;
    message: string;
    code?: string;
  };
  
  /**
   * Custom metrics
   */
  customMetrics?: Record<string, number>;
  
  /**
   * Performance category based on duration
   */
  category: 'fast' | 'normal' | 'slow' | 'very_slow' | 'critical';
  
  /**
   * Percentile ranking within recent operations
   */
  percentile?: number;
}

/**
 * Aggregated performance statistics
 */
export interface PerformanceStats {
  /**
   * Total number of operations
   */
  totalOperations: number;
  
  /**
   * Successful operations count
   */
  successfulOperations: number;
  
  /**
   * Failed operations count
   */
  failedOperations: number;
  
  /**
   * Success rate (0-1)
   */
  successRate: number;
  
  /**
   * Average execution time
   */
  averageDuration: number;
  
  /**
   * Median execution time
   */
  medianDuration: number;
  
  /**
   * 95th percentile execution time
   */
  p95Duration: number;
  
  /**
   * 99th percentile execution time
   */
  p99Duration: number;
  
  /**
   * Minimum execution time
   */
  minDuration: number;
  
  /**
   * Maximum execution time
   */
  maxDuration: number;
  
  /**
   * Operations per second
   */
  operationsPerSecond: number;
  
  /**
   * Error rate (0-1)
   */
  errorRate: number;
  
  /**
   * Average memory usage delta
   */
  averageMemoryDelta: number;
  
  /**
   * Peak memory usage
   */
  peakMemoryUsage: number;
  
  /**
   * Statistics by method
   */
  byMethod: Record<string, Omit<PerformanceStats, 'byMethod'>>;
  
  /**
   * Last updated timestamp
   */
  lastUpdated: number;
}

/**
 * Performance alert configuration
 */
export interface PerformanceAlert {
  /**
   * Alert name
   */
  name: string;
  
  /**
   * Condition to trigger alert
   */
  condition: (metrics: PerformanceMetrics, stats: PerformanceStats) => boolean;
  
  /**
   * Alert severity
   */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /**
   * Alert message template
   */
  message: string;
  
  /**
   * Cooldown period in milliseconds
   */
  cooldown: number;
  
  /**
   * Last triggered timestamp
   */
  lastTriggered?: number;
}

/**
 * Performance middleware configuration options
 */
export interface PerformanceMiddlewareOptions {
  /**
   * Whether performance monitoring is enabled
   */
  enabled?: boolean;
  
  /**
   * Whether to collect memory usage metrics
   */
  collectMemoryMetrics?: boolean;
  
  /**
   * Whether to collect CPU time metrics
   */
  collectCpuMetrics?: boolean;
  
  /**
   * Maximum number of metrics to keep in memory
   */
  maxMetricsHistory?: number;
  
  /**
   * Sampling rate (0-1) for performance collection
   */
  samplingRate?: number;
  
  /**
   * Performance thresholds in milliseconds
   */
  thresholds?: {
    fast: number;
    normal: number;
    slow: number;
    critical: number;
  };
  
  /**
   * Whether to log performance metrics
   */
  logMetrics?: boolean;
  
  /**
   * Log level for performance metrics
   */
  logLevel?: 'debug' | 'info' | 'warn';
  
  /**
   * Whether to log slow operations
   */
  logSlowOperations?: boolean;
  
  /**
   * Threshold for logging slow operations
   */
  slowOperationThreshold?: number;
  
  /**
   * Performance alerts configuration
   */
  alerts?: PerformanceAlert[];
  
  /**
   * Whether to include custom metrics
   */
  includeCustomMetrics?: boolean;
  
  /**
   * Statistics calculation interval in milliseconds
   */
  statsInterval?: number;
  
  /**
   * Whether to automatically optimize performance
   */
  autoOptimize?: boolean;
  
  /**
   * Custom metrics collectors
   */
  customCollectors?: Array<(context: MiddlewareContext) => Record<string, number>>;
}

/**
 * Default performance middleware configuration
 */
const DEFAULT_OPTIONS: Required<Omit<PerformanceMiddlewareOptions, 'alerts' | 'customCollectors'>> = {
  enabled: true,
  collectMemoryMetrics: true,
  collectCpuMetrics: false,
  maxMetricsHistory: 10000,
  samplingRate: 1.0,
  thresholds: {
    fast: 100,
    normal: 500,
    slow: 1000,
    critical: 5000
  },
  logMetrics: false,
  logLevel: 'info',
  logSlowOperations: true,
  slowOperationThreshold: 1000,
  includeCustomMetrics: true,
  statsInterval: 60000, // 1 minute
  autoOptimize: false
};

/**
 * Enterprise-grade performance monitoring middleware implementation
 */
@Injectable()
export class PerformanceMiddleware implements IMiddleware {
  public readonly name = 'PerformanceMiddleware';
  public readonly priority = 900; // Low priority - execute last

  private readonly options: Required<Omit<PerformanceMiddlewareOptions, 'alerts' | 'customCollectors'>> &
    Pick<PerformanceMiddlewareOptions, 'alerts' | 'customCollectors'>;
  private readonly metrics: PerformanceMetrics[] = [];
  private stats: PerformanceStats;
  private readonly startTimes = new Map<string, number>();
  private statsTimer?: NodeJS.Timeout;

  constructor(
    @Inject(LOGGER) private readonly logger: ILogger,
    options: PerformanceMiddlewareOptions = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    
    // Initialize stats
    this.stats = this.createInitialStats();
    
    // Start periodic stats calculation
    if (this.options.statsInterval > 0) {
      this.startStatsCalculation();
    }
    
    // Setup default alerts if not provided
    if (!this.options.alerts) {
      this.options.alerts = this.createDefaultAlerts();
    }
  }

  async execute(context: MiddlewareContext, next: NextFunction): Promise<any> {
    if (!this.options.enabled) {
      return await next();
    }

    // Apply sampling
    if (Math.random() > this.options.samplingRate) {
      return await next();
    }

    const { requestId, methodName, requestType } = context;
    const startTime = performance.now();
    const startCpuTime = this.options.collectCpuMetrics ? process.cpuUsage() : undefined;
    const memoryBefore = this.options.collectMemoryMetrics ? process.memoryUsage() : undefined;

    // Store start time for this request
    this.startTimes.set(requestId, startTime);

    let success = true;
    let error: { name: string; message: string; code?: string } | undefined;
    let result: any;

    try {
      // Execute the next middleware or handler
      result = await next();
      return result;
    } catch (err) {
      success = false;
      const errorObj = err as any;
      error = {
        name: errorObj.name || 'Error',
        message: errorObj.message || 'Unknown error',
        code: errorObj.code
      };
      throw err;
    } finally {
      // Calculate performance metrics
      const endTime = performance.now();
      const duration = endTime - startTime;
      const endCpuTime = this.options.collectCpuMetrics ? process.cpuUsage(startCpuTime) : undefined;
      const memoryAfter = this.options.collectMemoryMetrics ? process.memoryUsage() : undefined;

      // Collect custom metrics
      let customMetrics: Record<string, number> | undefined;
      if (this.options.includeCustomMetrics && this.options.customCollectors) {
        customMetrics = {};
        for (const collector of this.options.customCollectors) {
          try {
            const metrics = collector(context);
            Object.assign(customMetrics, metrics);
          } catch (collectorError) {
            this.logger.warn('Custom metrics collector failed:', collectorError);
          }
        }
      }

      // Create performance metrics
      const metrics: PerformanceMetrics = {
        requestId,
        methodName,
        requestType,
        startTime,
        endTime,
        duration,
        cpuTime: endCpuTime ? (endCpuTime.user + endCpuTime.system) / 1000 : undefined,
        memoryBefore,
        memoryAfter,
        memoryDelta: memoryBefore && memoryAfter ? this.calculateMemoryDelta(memoryBefore, memoryAfter) : undefined,
        success,
        error,
        customMetrics,
        category: this.categorizePerformance(duration)
      };

      // Store metrics
      this.addMetrics(metrics);

      // Log metrics if configured
      if (this.options.logMetrics) {
        this.logPerformanceMetrics(metrics);
      }

      // Log slow operations
      if (this.options.logSlowOperations && duration > this.options.slowOperationThreshold) {
        this.logger.warn(
          `Slow operation detected: ${methodName} took ${duration.toFixed(2)}ms`,
          {
            requestId,
            duration,
            category: metrics.category,
            memoryDelta: metrics.memoryDelta
          }
        );
      }

      // Check performance alerts
      if (this.options.alerts) {
        this.checkAlerts(metrics);
      }

      // Clean up
      this.startTimes.delete(requestId);
    }
  }

  /**
   * Add performance metrics to history
   */
  private addMetrics(metrics: PerformanceMetrics): void {
    // Add to metrics history
    this.metrics.push(metrics);

    // Trim history if too long
    if (this.metrics.length > this.options.maxMetricsHistory) {
      const removeCount = this.metrics.length - this.options.maxMetricsHistory;
      this.metrics.splice(0, removeCount);
    }

    // Calculate percentile
    metrics.percentile = this.calculatePercentile(metrics.duration);
  }

  /**
   * Categorize performance based on duration
   */
  private categorizePerformance(duration: number): 'fast' | 'normal' | 'slow' | 'very_slow' | 'critical' {
    const { thresholds } = this.options;
    
    if (duration < thresholds.fast) return 'fast';
    if (duration < thresholds.normal) return 'normal';
    if (duration < thresholds.slow) return 'slow';
    if (duration < thresholds.critical) return 'very_slow';
    return 'critical';
  }

  /**
   * Calculate memory usage delta
   */
  private calculateMemoryDelta(before: NodeJS.MemoryUsage, after: NodeJS.MemoryUsage): Partial<NodeJS.MemoryUsage> {
    return {
      rss: after.rss - before.rss,
      heapTotal: after.heapTotal - before.heapTotal,
      heapUsed: after.heapUsed - before.heapUsed,
      external: after.external - before.external,
      arrayBuffers: after.arrayBuffers - before.arrayBuffers
    };
  }

  /**
   * Calculate percentile ranking for duration
   */
  private calculatePercentile(duration: number): number {
    if (this.metrics.length === 0) return 0;

    const sortedDurations = this.metrics
      .map(m => m.duration)
      .sort((a, b) => a - b);

    const rank = sortedDurations.filter(d => d <= duration).length;
    return (rank / sortedDurations.length) * 100;
  }

  /**
   * Log performance metrics
   */
  private logPerformanceMetrics(metrics: PerformanceMetrics): void {
    const logData = {
      requestId: metrics.requestId,
      method: metrics.methodName,
      duration: `${metrics.duration.toFixed(2)}ms`,
      category: metrics.category,
      success: metrics.success,
      memoryDelta: metrics.memoryDelta?.heapUsed || 0
    };

    if (metrics.error) {
      (logData as any)['error'] = metrics.error.message;
    }

    if (metrics.customMetrics) {
      (logData as any)['customMetrics'] = metrics.customMetrics;
    }

    this.logger[this.options.logLevel](
      `Performance metrics for ${metrics.methodName}`,
      logData
    );
  }

  /**
   * Check performance alerts
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    if (!this.options.alerts) return;

    const now = Date.now();

    for (const alert of this.options.alerts) {
      // Check cooldown
      if (alert.lastTriggered && (now - alert.lastTriggered) < alert.cooldown) {
        continue;
      }

      // Check condition
      try {
        if (alert.condition(metrics, this.stats)) {
          // Trigger alert
          this.triggerAlert(alert, metrics);
          alert.lastTriggered = now;
        }
      } catch (error) {
        this.logger.warn(`Alert condition failed for ${alert.name}:`, error);
      }
    }
  }

  /**
   * Trigger a performance alert
   */
  private triggerAlert(alert: PerformanceAlert, metrics: PerformanceMetrics): void {
    const message = alert.message
      .replace('{method}', metrics.methodName)
      .replace('{duration}', metrics.duration.toFixed(2))
      .replace('{category}', metrics.category);

    const alertData = {
      alertName: alert.name,
      severity: alert.severity,
      method: metrics.methodName,
      duration: metrics.duration,
      category: metrics.category,
      requestId: metrics.requestId
    };

    switch (alert.severity) {
      case 'critical':
        this.logger.error(`[PERFORMANCE ALERT] ${message}`, alertData);
        break;
      case 'high':
        this.logger.error(`[PERFORMANCE ALERT] ${message}`, alertData);
        break;
      case 'medium':
        this.logger.warn(`[PERFORMANCE ALERT] ${message}`, alertData);
        break;
      default:
        this.logger.info(`[PERFORMANCE ALERT] ${message}`, alertData);
    }
  }

  /**
   * Create initial stats structure
   */
  private createInitialStats(): PerformanceStats {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      successRate: 0,
      averageDuration: 0,
      medianDuration: 0,
      p95Duration: 0,
      p99Duration: 0,
      minDuration: 0,
      maxDuration: 0,
      operationsPerSecond: 0,
      errorRate: 0,
      averageMemoryDelta: 0,
      peakMemoryUsage: 0,
      byMethod: {},
      lastUpdated: Date.now()
    };
  }

  /**
   * Start periodic stats calculation
   */
  private startStatsCalculation(): void {
    this.statsTimer = setInterval(() => {
      this.calculateStats();
    }, this.options.statsInterval);
  }

  /**
   * Calculate performance statistics
   */
  private calculateStats(): void {
    if (this.metrics.length === 0) {
      return;
    }

    const now = Date.now();
    const windowStart = now - this.options.statsInterval;
    const recentMetrics = this.metrics.filter(m => m.startTime >= windowStart);

    if (recentMetrics.length === 0) {
      return;
    }

    const successfulOps = recentMetrics.filter(m => m.success);
    const failedOps = recentMetrics.filter(m => !m.success);
    const durations = recentMetrics.map(m => m.duration).sort((a, b) => a - b);

    this.stats = {
      totalOperations: recentMetrics.length,
      successfulOperations: successfulOps.length,
      failedOperations: failedOps.length,
      successRate: successfulOps.length / recentMetrics.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      medianDuration: durations[Math.floor(durations.length / 2)] || 0,
      p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
      p99Duration: durations[Math.floor(durations.length * 0.99)] || 0,
      minDuration: durations[0] || 0,
      maxDuration: durations[durations.length - 1] || 0,
      operationsPerSecond: recentMetrics.length / (this.options.statsInterval / 1000),
      errorRate: failedOps.length / recentMetrics.length,
      averageMemoryDelta: this.calculateAverageMemoryDelta(recentMetrics),
      peakMemoryUsage: this.calculatePeakMemoryUsage(recentMetrics),
      byMethod: this.calculateMethodStats(recentMetrics),
      lastUpdated: now
    };
  }

  /**
   * Calculate average memory delta
   */
  private calculateAverageMemoryDelta(metrics: PerformanceMetrics[]): number {
    const deltas = metrics
      .map(m => m.memoryDelta?.heapUsed || 0)
      .filter(d => d !== 0);

    if (deltas.length === 0) return 0;
    return deltas.reduce((a, b) => a + b, 0) / deltas.length;
  }

  /**
   * Calculate peak memory usage
   */
  private calculatePeakMemoryUsage(metrics: PerformanceMetrics[]): number {
    const usages = metrics
      .map(m => m.memoryAfter?.heapUsed || 0)
      .filter(u => u > 0);

    return usages.length > 0 ? Math.max(...usages) : 0;
  }

  /**
   * Calculate statistics by method
   */
  private calculateMethodStats(metrics: PerformanceMetrics[]): Record<string, Omit<PerformanceStats, 'byMethod'>> {
    const methodGroups = metrics.reduce((groups, metric) => {
      if (!groups[metric.methodName]) {
        groups[metric.methodName] = [];
      }
      groups[metric.methodName].push(metric);
      return groups;
    }, {} as Record<string, PerformanceMetrics[]>);

    const methodStats: Record<string, Omit<PerformanceStats, 'byMethod'>> = {};

    for (const [method, methodMetrics] of Object.entries(methodGroups)) {
      const successfulOps = methodMetrics.filter(m => m.success);
      const durations = methodMetrics.map(m => m.duration).sort((a, b) => a - b);

      methodStats[method] = {
        totalOperations: methodMetrics.length,
        successfulOperations: successfulOps.length,
        failedOperations: methodMetrics.length - successfulOps.length,
        successRate: successfulOps.length / methodMetrics.length,
        averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        medianDuration: durations[Math.floor(durations.length / 2)] || 0,
        p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
        p99Duration: durations[Math.floor(durations.length * 0.99)] || 0,
        minDuration: durations[0] || 0,
        maxDuration: durations[durations.length - 1] || 0,
        operationsPerSecond: methodMetrics.length / (this.options.statsInterval / 1000),
        errorRate: (methodMetrics.length - successfulOps.length) / methodMetrics.length,
        averageMemoryDelta: this.calculateAverageMemoryDelta(methodMetrics),
        peakMemoryUsage: this.calculatePeakMemoryUsage(methodMetrics),
        lastUpdated: Date.now()
      };
    }

    return methodStats;
  }

  /**
   * Create default performance alerts
   */
  private createDefaultAlerts(): PerformanceAlert[] {
    return [
      {
        name: 'CriticalPerformance',
        condition: (metrics) => metrics.category === 'critical',
        severity: 'critical',
        message: 'Critical performance issue detected in {method}: {duration}ms',
        cooldown: 60000 // 1 minute
      },
      {
        name: 'HighErrorRate',
        condition: (_, stats) => stats.errorRate > 0.1,
        severity: 'high',
        message: 'High error rate detected: {errorRate}%',
        cooldown: 300000 // 5 minutes
      },
      {
        name: 'SlowResponse',
        condition: (metrics) => metrics.duration > this.options.slowOperationThreshold,
        severity: 'medium',
        message: 'Slow response time detected in {method}: {duration}ms',
        cooldown: 120000 // 2 minutes
      }
    ];
  }

  /**
   * Get current performance statistics
   */
  getStats(): PerformanceStats {
    return { ...this.stats };
  }

  /**
   * Get recent performance metrics
   */
  getMetrics(count?: number): PerformanceMetrics[] {
    if (count) {
      return this.metrics.slice(-count);
    }
    return [...this.metrics];
  }

  /**
   * Clear performance metrics history
   */
  clearMetrics(): void {
    this.metrics.length = 0;
    this.stats = this.createInitialStats();
    this.logger.info('Performance metrics cleared');
  }

  /**
   * Stop the middleware and cleanup
   */
  stop(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = undefined;
    }
  }
}

// /**
//  * Factory function to create performance middleware with custom options
//  */
// export function createPerformanceMiddleware(options: PerformanceMiddlewareOptions = {}) {
//   class CustomPerformanceMiddleware extends PerformanceMiddleware {
//     constructor(logger: ILogger) {
//       super(logger, options);
//     }
//   }
//   return CustomPerformanceMiddleware;
// }

/**
 * Predefined performance middleware variants
 */
@Injectable()
export class LightweightPerformanceMiddleware extends PerformanceMiddleware {
  constructor(@Inject(LOGGER) logger: ILogger) {
    super(logger, {
      collectMemoryMetrics: false,
      collectCpuMetrics: false,
      logMetrics: false,
      maxMetricsHistory: 1000,
      samplingRate: 0.1 // 10% sampling
    });
  }
}

@Injectable()
export class DetailedPerformanceMiddleware extends PerformanceMiddleware {
  constructor(@Inject(LOGGER) logger: ILogger) {
    super(logger, {
      collectMemoryMetrics: true,
      collectCpuMetrics: true,
      logMetrics: true,
      logLevel: 'debug',
      maxMetricsHistory: 50000,
      samplingRate: 1.0,
      statsInterval: 30000 // 30 seconds
    });
  }
}