/**
 * Authentication Middleware
 * 
 * Enterprise-grade authentication and authorization middleware that provides
 * flexible authentication strategies, role-based access control, and session management.
 */

import { Injectable, Inject } from '@sker/di';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
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
 * User principal with authentication and authorization information
 */
export interface UserPrincipal {
  /**
   * Unique user identifier
   */
  id: string;
  
  /**
   * Username or email
   */
  username: string;
  
  /**
   * User roles
   */
  roles: string[];
  
  /**
   * User permissions
   */
  permissions: string[];
  
  /**
   * User groups
   */
  groups?: string[];
  
  /**
   * Additional user metadata
   */
  metadata?: Record<string, any>;
  
  /**
   * Authentication timestamp
   */
  authenticatedAt: number;
  
  /**
   * Token expiration timestamp
   */
  expiresAt?: number;
  
  /**
   * Authentication method used
   */
  authMethod: string;
}

/**
 * Authentication token information
 */
export interface AuthToken {
  /**
   * Token value
   */
  token: string;
  
  /**
   * Token type (Bearer, API Key, etc.)
   */
  type: string;
  
  /**
   * Token expiration
   */
  expiresAt?: number;
  
  /**
   * Token scopes
   */
  scopes?: string[];
}

/**
 * Authentication provider interface
 */
export interface IAuthProvider {
  /**
   * Authenticate a token and return user principal
   */
  authenticate(token: AuthToken): Promise<UserPrincipal | null>;
  
  /**
   * Validate if user has required permissions
   */
  authorize(user: UserPrincipal, requiredPermissions: string[]): Promise<boolean>;
  
  /**
   * Get provider name
   */
  getName(): string;
}

/**
 * Simple token-based authentication provider
 */
export class TokenAuthProvider implements IAuthProvider {
  private readonly tokens = new Map<string, UserPrincipal>();
  
  constructor(
    private readonly name: string = 'TokenAuthProvider'
  ) {}

  async authenticate(token: AuthToken): Promise<UserPrincipal | null> {
    const user = this.tokens.get(token.token);
    
    if (!user) {
      return null;
    }

    // Check token expiration
    if (user.expiresAt && Date.now() > user.expiresAt) {
      this.tokens.delete(token.token);
      return null;
    }

    return user;
  }

  async authorize(user: UserPrincipal, requiredPermissions: string[]): Promise<boolean> {
    // Check if user has all required permissions
    return requiredPermissions.every(permission => 
      user.permissions.includes(permission) ||
      user.roles.some(role => this.getRolePermissions(role).includes(permission))
    );
  }

  getName(): string {
    return this.name;
  }

  /**
   * Add a user token
   */
  addToken(token: string, user: Omit<UserPrincipal, 'authenticatedAt' | 'authMethod'>): void {
    this.tokens.set(token, {
      ...user,
      authenticatedAt: Date.now(),
      authMethod: this.name
    });
  }

  /**
   * Remove a token
   */
  removeToken(token: string): boolean {
    return this.tokens.delete(token);
  }

  /**
   * Get permissions for a role (override in subclasses)
   */
  protected getRolePermissions(role: string): string[] {
    const rolePermissions: Record<string, string[]> = {
      admin: ['read', 'write', 'delete', 'manage'],
      user: ['read', 'write'],
      readonly: ['read']
    };

    return rolePermissions[role] || [];
  }
}

/**
 * API Key authentication provider
 */
export class ApiKeyAuthProvider implements IAuthProvider {
  private readonly apiKeys = new Map<string, UserPrincipal>();
  
  constructor(
    private readonly name: string = 'ApiKeyAuthProvider'
  ) {}

  async authenticate(token: AuthToken): Promise<UserPrincipal | null> {
    if (token.type !== 'ApiKey') {
      return null;
    }

    return this.apiKeys.get(token.token) || null;
  }

  async authorize(user: UserPrincipal, requiredPermissions: string[]): Promise<boolean> {
    return requiredPermissions.every(permission => 
      user.permissions.includes(permission)
    );
  }

  getName(): string {
    return this.name;
  }

  /**
   * Add an API key
   */
  addApiKey(key: string, user: Omit<UserPrincipal, 'authenticatedAt' | 'authMethod'>): void {
    this.apiKeys.set(key, {
      ...user,
      authenticatedAt: Date.now(),
      authMethod: this.name
    });
  }

  /**
   * Remove an API key
   */
  removeApiKey(key: string): boolean {
    return this.apiKeys.delete(key);
  }
}

/**
 * Authentication middleware configuration options
 */
export interface AuthenticationMiddlewareOptions {
  /**
   * Authentication providers
   */
  providers?: IAuthProvider[];
  
  /**
   * Whether authentication is required
   */
  required?: boolean;
  
  /**
   * Default required permissions
   */
  defaultPermissions?: string[];
  
  /**
   * Token extraction strategies
   */
  tokenExtractors?: TokenExtractor[];
  
  /**
   * Whether to skip authentication for certain methods
   */
  skipMethods?: string[];
  
  /**
   * Session timeout in milliseconds
   */
  sessionTimeout?: number;
  
  /**
   * Whether to log authentication attempts
   */
  logAttempts?: boolean;
  
  /**
   * Rate limiting for authentication attempts
   */
  rateLimiting?: {
    enabled: boolean;
    maxAttempts: number;
    windowMs: number;
  };
  
  /**
   * Custom error messages
   */
  errorMessages?: {
    missingToken?: string;
    invalidToken?: string;
    insufficientPermissions?: string;
    sessionExpired?: string;
  };
}

/**
 * Token extractor function
 */
export type TokenExtractor = (context: MiddlewareContext) => AuthToken | null;

/**
 * Default token extractors
 */
export class DefaultTokenExtractors {
  /**
   * Extract Bearer token from Authorization header
   */
  static bearerToken(context: MiddlewareContext): AuthToken | null {
    const request = context.request;
    if (!request || !('params' in request) || !request.params) {
      return null;
    }

    const authHeader = request.params.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return {
        token: authHeader.substring(7),
        type: 'Bearer'
      };
    }

    return null;
  }

  /**
   * Extract API key from headers
   */
  static apiKeyHeader(context: MiddlewareContext): AuthToken | null {
    const request = context.request;
    if (!request || !('params' in request) || !request.params) {
      return null;
    }

    const apiKey = request.params.apiKey || request.params['x-api-key'];
    if (typeof apiKey === 'string') {
      return {
        token: apiKey,
        type: 'ApiKey'
      };
    }

    return null;
  }

  /**
   * Extract token from query parameters
   */
  static queryToken(context: MiddlewareContext): AuthToken | null {
    const request = context.request;
    if (!request || !('params' in request) || !request.params) {
      return null;
    }

    const token = request.params.token;
    if (typeof token === 'string') {
      return {
        token,
        type: 'Query'
      };
    }

    return null;
  }
}

/**
 * Default authentication middleware configuration
 */
const DEFAULT_OPTIONS: Required<Omit<AuthenticationMiddlewareOptions, 'providers' | 'tokenExtractors' | 'skipMethods' | 'rateLimiting' | 'errorMessages'>> = {
  required: true,
  defaultPermissions: [],
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  logAttempts: true
};

/**
 * Enterprise-grade authentication middleware implementation
 */
@Injectable()
export class AuthenticationMiddleware implements IMiddleware {
  public readonly name = 'AuthenticationMiddleware';
  public readonly priority = 50; // Very high priority - execute first

  private readonly options: Required<Omit<AuthenticationMiddlewareOptions, 'providers' | 'tokenExtractors' | 'skipMethods' | 'rateLimiting' | 'errorMessages'>> &
    Pick<AuthenticationMiddlewareOptions, 'providers' | 'tokenExtractors' | 'skipMethods' | 'rateLimiting' | 'errorMessages'>;
  private readonly authAttempts = new Map<string, { count: number; lastAttempt: number }>();

  constructor(
    @Inject(LOGGER) private readonly logger: ILogger,
    options: AuthenticationMiddlewareOptions = {}
  ) {
    this.options = { 
      ...DEFAULT_OPTIONS, 
      ...options,
      providers: options.providers || [new TokenAuthProvider()],
      tokenExtractors: options.tokenExtractors || [
        DefaultTokenExtractors.bearerToken,
        DefaultTokenExtractors.apiKeyHeader,
        DefaultTokenExtractors.queryToken
      ]
    };
  }

  async execute(context: MiddlewareContext, next: NextFunction): Promise<any> {
    const { requestId, methodName } = context;

    // Check if authentication should be skipped for this method
    if (this.options.skipMethods?.includes(methodName)) {
      this.logger.debug(`[${requestId}] Authentication skipped for method: ${methodName}`);
      return await next();
    }

    try {
      // Extract authentication token
      const token = this.extractToken(context);
      
      if (!token && this.options.required) {
        throw this.createAuthError(
          'MISSING_TOKEN',
          this.options.errorMessages?.missingToken || 'Authentication token is required',
          context
        );
      }

      if (token) {
        // Check rate limiting
        if (this.options.rateLimiting?.enabled) {
          await this.checkRateLimit(token.token, context);
        }

        // Authenticate token
        const user = await this.authenticateToken(token, context);
        
        if (!user) {
          if (this.options.logAttempts) {
            this.logger.warn(`[${requestId}] Authentication failed for method: ${methodName}`, {
              tokenType: token.type
            });
          }
          
          throw this.createAuthError(
            'INVALID_TOKEN',
            this.options.errorMessages?.invalidToken || 'Invalid authentication token',
            context
          );
        }

        // Check session expiration
        if (user.expiresAt && Date.now() > user.expiresAt) {
          throw this.createAuthError(
            'SESSION_EXPIRED',
            this.options.errorMessages?.sessionExpired || 'Authentication session has expired',
            context
          );
        }

        // Get required permissions for this method
        const requiredPermissions = this.getRequiredPermissions(context);
        
        // Authorize user
        if (requiredPermissions.length > 0) {
          const authorized = await this.authorizeUser(user, requiredPermissions, context);
          
          if (!authorized) {
            this.logger.warn(`[${requestId}] Authorization failed for ${user.username}`, {
              requiredPermissions,
              userPermissions: user.permissions,
              userRoles: user.roles
            });
            
            throw this.createAuthError(
              'INSUFFICIENT_PERMISSIONS',
              this.options.errorMessages?.insufficientPermissions || 'Insufficient permissions for this operation',
              context
            );
          }
        }

        // Store user in context metadata
        context.metadata = {
          ...context.metadata,
          user,
          authenticated: true
        };

        if (this.options.logAttempts) {
          this.logger.info(`[${requestId}] User authenticated: ${user.username} (${user.authMethod})`);
        }
      }

      // Execute the next middleware or handler
      return await next();
    } catch (error) {
      // Log failed authentication attempts
      if (this.options.logAttempts && this.isAuthError(error)) {
        this.logger.warn(`[${requestId}] Authentication error for ${methodName}:`, (error as any).message);
      }
      
      throw error;
    }
  }

  /**
   * Extract authentication token from request
   */
  private extractToken(context: MiddlewareContext): AuthToken | null {
    for (const extractor of this.options.tokenExtractors || []) {
      const token = extractor(context);
      if (token) {
        return token;
      }
    }
    
    return null;
  }

  /**
   * Authenticate token using available providers
   */
  private async authenticateToken(token: AuthToken, context: MiddlewareContext): Promise<UserPrincipal | null> {
    for (const provider of this.options.providers || []) {
      try {
        const user = await provider.authenticate(token);
        if (user) {
          this.logger.debug(`Authentication successful using provider: ${provider.getName()}`);
          return user;
        }
      } catch (error) {
        this.logger.warn(`Authentication failed with provider ${provider.getName()}:`, error);
      }
    }
    
    return null;
  }

  /**
   * Authorize user with required permissions
   */
  private async authorizeUser(
    user: UserPrincipal, 
    requiredPermissions: string[],
    context: MiddlewareContext
  ): Promise<boolean> {
    for (const provider of this.options.providers || []) {
      try {
        const authorized = await provider.authorize(user, requiredPermissions);
        if (authorized) {
          return true;
        }
      } catch (error) {
        this.logger.warn(`Authorization failed with provider ${provider.getName()}:`, error);
      }
    }
    
    return false;
  }

  /**
   * Get required permissions for the current method
   */
  private getRequiredPermissions(context: MiddlewareContext): string[] {
    // Check metadata for method-specific permissions
    if (context.metadata?.requiredPermissions) {
      return Array.isArray(context.metadata.requiredPermissions) 
        ? context.metadata.requiredPermissions 
        : [context.metadata.requiredPermissions];
    }
    
    // Return default permissions
    return this.options.defaultPermissions;
  }

  /**
   * Check rate limiting for authentication attempts
   */
  private async checkRateLimit(token: string, context: MiddlewareContext): Promise<void> {
    if (!this.options.rateLimiting) {
      return;
    }

    const { maxAttempts, windowMs } = this.options.rateLimiting;
    const now = Date.now();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const attempts = this.authAttempts.get(tokenHash);
    
    if (attempts) {
      // Reset counter if window has expired
      if (now - attempts.lastAttempt > windowMs) {
        this.authAttempts.set(tokenHash, { count: 1, lastAttempt: now });
      } else if (attempts.count >= maxAttempts) {
        const error = new Error('Too many authentication attempts. Please try again later.');
        (error as any).code = 'RATE_LIMITED';
        throw error;
      } else {
        attempts.count++;
        attempts.lastAttempt = now;
      }
    } else {
      this.authAttempts.set(tokenHash, { count: 1, lastAttempt: now });
    }
    
    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      this.cleanupRateLimit(windowMs);
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupRateLimit(windowMs: number): void {
    const now = Date.now();
    
    for (const [key, attempts] of this.authAttempts.entries()) {
      if (now - attempts.lastAttempt > windowMs) {
        this.authAttempts.delete(key);
      }
    }
  }

  /**
   * Create authentication error
   */
  private createAuthError(code: string, message: string, context: MiddlewareContext): McpError {
    return new McpError(
      -32002,
      message,
      {
        code,
        requestId: context.requestId,
        method: context.methodName
      }
    );
  }

  /**
   * Check if error is authentication related
   */
  private isAuthError(error: any): boolean {
    return error instanceof McpError && error.code === -32002;
  }

  /**
   * Add authentication provider
   */
  addProvider(provider: IAuthProvider): void {
    if (!this.options.providers) {
      this.options.providers = [];
    }
    this.options.providers.push(provider);
    this.logger.info(`Added authentication provider: ${provider.getName()}`);
  }

  /**
   * Remove authentication provider
   */
  removeProvider(providerName: string): boolean {
    if (!this.options.providers) {
      return false;
    }
    
    const index = this.options.providers.findIndex(p => p.getName() === providerName);
    if (index >= 0) {
      this.options.providers.splice(index, 1);
      this.logger.info(`Removed authentication provider: ${providerName}`);
      return true;
    }
    
    return false;
  }

  /**
   * Get authentication statistics
   */
  getStats(): {
    totalAttempts: number;
    activeTokens: number;
    providers: string[];
  } {
    return {
      totalAttempts: this.authAttempts.size,
      activeTokens: this.authAttempts.size,
      providers: this.options.providers?.map(p => p.getName()) || []
    };
  }
}

// /**
//  * Factory function to create authentication middleware with custom options
//  */
// export function createAuthenticationMiddleware(options: AuthenticationMiddlewareOptions = {}) {
//   class CustomAuthenticationMiddleware extends AuthenticationMiddleware {
//     constructor(logger: ILogger) {
//       super(logger, options);
//     }
//   }
//   return CustomAuthenticationMiddleware;
// }

/**
 * Predefined authentication middleware variants
 */
@Injectable()
export class OptionalAuthenticationMiddleware extends AuthenticationMiddleware {
  constructor(@Inject(LOGGER) logger: ILogger) {
    super(logger, {
      required: false,
      logAttempts: false
    });
  }
}

@Injectable()
export class StrictAuthenticationMiddleware extends AuthenticationMiddleware {
  constructor(@Inject(LOGGER) logger: ILogger) {
    super(logger, {
      required: true,
      sessionTimeout: 60 * 60 * 1000, // 1 hour
      rateLimiting: {
        enabled: true,
        maxAttempts: 5,
        windowMs: 15 * 60 * 1000 // 15 minutes
      }
    });
  }
}