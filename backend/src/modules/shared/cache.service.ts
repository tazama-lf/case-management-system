import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../shared/redis.service';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import * as jwt from 'jsonwebtoken';
import { UserGroupDetails } from '../../utils/types/UserList';

export interface UserDetails {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  fullName: string;
  roles?: string[];
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly CACHE_ROLES = ['CMS_INVESTIGATOR', 'CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER'];
  private readonly CACHE_KEY_PREFIX = 'cms:users:';
  private readonly TOKEN_CACHE_KEY_PREFIX = 'cms:tokens:';
  private readonly TOKEN_CACHE_KEY_PREFIX = 'cms:tokens:';
  private readonly CACHE_TTL_HOURS = 720; // 720 hours == 30 days TTL
  private readonly AuthBaseUrl: string;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.AuthBaseUrl = this.configService.get<string>('TAZAMA_AUTH_URL')!;
  }

  public async initializeUserCache(retryCount = 0, token: string): Promise<void> {
    const maxRetries = 3;
    this.logger.log(`InitializeUserCache called (attempt ${retryCount + 1}/${maxRetries + 1})`, CacheService.name);

    try {
      this.logger.log('Redis connection status:', CacheService.name);
      if (!this.redisService.isConnected()) {
        this.logger.log('Redis not connected', CacheService.name);

        if (retryCount < maxRetries) {
          setTimeout(() => {
            this.initializeUserCache(retryCount + 1, token).catch((error: unknown) => {
              this.logger.error('Retry failed:', error);
            });
          }, 3000);
          return;
        } else {
          this.logger.warn('Redis not connected after retries, skipping cache initialization', CacheService.name);
          return;
        }
      }

      const cacheData: Record<string, UserDetails> = {};
      let totalUsers = 0;
      const rolePromises = this.CACHE_ROLES.map(async (role) => {
        try {
          this.logger.log(`Fetching users with role: ${role}`, CacheService.name);

          const users = await this.getUsersByRole(token, role, this.configService.get<string>('KEYCLOAK_GROUP_NAME') ?? '');

          for (const user of users) {
            const userDetails: UserDetails = {
              id: user.id,
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              fullName: `${user.firstName} ${user.lastName}`.trim(),
              email: user.email,
            };

            cacheData[this.getCacheKey(user.id)] = userDetails;
            totalUsers += 1;
          }

          this.logger.log(`Cached ${users.length} users with role: ${role}`, CacheService.name);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.logger.error(`Failed to fetch users with role ${role}: ${err.message}`, CacheService.name);
        }
      });

      await Promise.all(rolePromises);

      this.logger.log(`User cache initialized in Redis with ${totalUsers} total users`, CacheService.name);
      if (Object.keys(cacheData).length > 0) {
        await this.redisService.mset(cacheData, this.CACHE_TTL_HOURS * 3600);
        this.logger.log(`User cache initialized in Redis with ${totalUsers} total users`, CacheService.name);
      } else {
        this.logger.warn('No users fetched for caching', CacheService.name);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to initialize user cache (will fall back to API): ${errorMessage}`, CacheService.name);
    }
  }
  async getUsersByRole(token: string, role: string, tenantName: string): Promise<UserGroupDetails[]> {
    // Validate role against allowlist
    if (!this.CACHE_ROLES.includes(role)) {
      throw new Error(`Invalid role: ${role} is not in the allowed roles list`);
    }

    this.logger.log(`Fetching users with role: ${role}`);
    try {
      const users = await axios.get<UserGroupDetails[]>(`${this.AuthBaseUrl}/user/${role}`, {
        params: {
          groupName: tenantName,
        },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      return users.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Auth service error fetching users by role: ${error.response?.status} ${error.response?.statusText ?? ''}`);

        throw new Error(`Failed to fetch users with role ${role}: upstream returned ${error.response?.status}`, {
          cause: error,
        });
      }
      throw error;
    }
  }

  private getCacheKey(userId: string): string {
    return `${this.CACHE_KEY_PREFIX}${userId}`;
  }

  async getUserFromCache(userId: string): Promise<UserDetails | null> {
    if (!this.redisService.isConnected()) {
      this.logger.debug('Redis not connected, cache unavailable', CacheService.name);
      return null;
    }

    try {
      const cachedUser = await this.redisService.get<UserDetails>(this.getCacheKey(userId), true);
      if (cachedUser) {
        this.logger.debug(`User ${userId} found in Redis cache`, CacheService.name);
        return cachedUser;
      }

      this.logger.debug(`User ${userId} not found in Redis cache`, CacheService.name);
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Error getting user ${userId} from cache: ${errorMessage}`, CacheService.name);
      throw error;
    }
  }

  async getUserEmailFromCache(userId: string): Promise<string | null> {
    const user = await this.getUserFromCache(userId);
    return user?.email ?? null;
  }

  /**
   * Store user JWT token in Redis cache with TTL matching the token's expiration
   * @param userId - The user ID
   * @param token - The JWT token
   */
  async setUserToken(userId: string, token: string): Promise<void> {
    if (!this.redisService.isConnected()) {
      this.logger.warn('Redis not connected, cannot cache user token', CacheService.name);
      return;
    }

    try {
      // Decode JWT to get expiration time (without verification since it's already verified)
      const decoded = jwt.decode(token) as { exp?: number } | null;

      if (!decoded?.exp) {
        this.logger.warn(`Token for user ${userId} has no expiration, using default 1 hour TTL`, CacheService.name);
        const defaultTtl = 3600; // 1 hour fallback
        const tokenKey = `${this.TOKEN_CACHE_KEY_PREFIX}${userId}`;
        await this.redisService.set(tokenKey, token, defaultTtl);
        return;
      }

      // Calculate remaining lifetime in seconds
      const now = Math.floor(Date.now() / 1000);
      const ttl = decoded.exp - now;

      if (ttl <= 0) {
        this.logger.warn(`Token for user ${userId} is already expired`, CacheService.name);
        return;
      }

      const tokenKey = `${this.TOKEN_CACHE_KEY_PREFIX}${userId}`;
      await this.redisService.set(tokenKey, token, ttl);
      this.logger.debug(
        `Token cached for user ${userId} with TTL ${ttl}s (expires at ${new Date(decoded.exp * 1000).toISOString()})`,
        CacheService.name,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error caching token for user ${userId}: ${errorMessage}`, CacheService.name);
    }
  }

  /**
   * Retrieve user JWT token from Redis cache
   * @param userId - The user ID
   * @returns The JWT token or null if not found
   */
  async getUserToken(userId: string): Promise<string | null> {
    if (!this.redisService.isConnected()) {
      this.logger.warn('Redis not connected, cannot retrieve user token', CacheService.name);
      return null;
    }

    try {
      const tokenKey = `${this.TOKEN_CACHE_KEY_PREFIX}${userId}`;
      const token = await this.redisService.get(tokenKey, false);

      if (token) {
        this.logger.debug(`Token retrieved for user ${userId}`, CacheService.name);
        return token;
      }

      this.logger.debug(`Token not found in cache for user ${userId}`, CacheService.name);
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error retrieving token for user ${userId}: ${errorMessage}`, CacheService.name);
      return null;
    }
  }

  /**
   * Delete user JWT token from Redis cache (called during logout)
   * @param userId - The user ID
   */
  async deleteUserToken(userId: string): Promise<void> {
    if (!this.redisService.isConnected()) {
      this.logger.warn('Redis not connected, cannot delete user token', CacheService.name);
      return;
    }

    try {
      const tokenKey = `${this.TOKEN_CACHE_KEY_PREFIX}${userId}`;
      await this.redisService.del(tokenKey);
      this.logger.log(`Token deleted from cache for user ${userId}`, CacheService.name);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error deleting token for user ${userId}: ${errorMessage}`, CacheService.name);
    }
  }
}
