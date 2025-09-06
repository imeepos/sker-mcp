/**
 * Simple Console Logger Implementation
 * 
 * This is a basic console logger to replace the placeholder logger
 * until a full Winston-based logging system is implemented.
 */

import { Injectable } from '@sker/di';

export interface Logger {
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
  trace(message: string, meta?: any): void;
}

/**
 * Simple console logger implementation
 */
@Injectable({ providedIn: 'root' })
export class ConsoleLogger implements Logger {
  private readonly logLevel: string;
  private readonly levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4
  };

  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
  }

  private shouldLog(level: keyof typeof this.levels): boolean {
    const currentLevelNum = this.levels[this.logLevel as keyof typeof this.levels] ?? this.levels.info;
    const messageLevelNum = this.levels[level];
    return messageLevelNum <= currentLevelNum;
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  error(message: string, meta?: any): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog('info')) {
      console.error(this.formatMessage('info', message, meta));
    }
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog('debug')) {
      console.error(this.formatMessage('debug', message, meta));
    }
  }

  trace(message: string, meta?: any): void {
    if (this.shouldLog('trace')) {
      console.error(this.formatMessage('trace', message, meta));
    }
  }
}