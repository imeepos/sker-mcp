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
