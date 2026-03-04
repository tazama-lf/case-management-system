import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../shared/redis.service';
import axios from 'axios';
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

/**
 * Service for caching CMS user data in Redis to improve performance
 * for email notifications and user lookups
 */
@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);
  private cacheInitialized = false;
  private readonly CACHE_ROLES = ['CMS_INVESTIGATOR', 'CMS_SUPERVISOR'];
  private readonly CACHE_KEY_PREFIX = 'cms:users:';
  private readonly CACHE_TTL_HOURS = 720; // 720 hours == 30 days TTL
  private readonly AuthBaseUrl: string;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.AuthBaseUrl = this.configService.get<string>('TAZAMA_AUTH_URL')!;
  }

  /**
   * Initialize user cache on module startup
   */
  onModuleInit(): void {
    this.logger.log('Initializing CMS cache...', CacheService.name);

    // Add delay to ensure all services (especially Redis) are initialized
    // setTimeout(() => {
    //   this.initializeUserCache().catch((error: unknown) => {
    //     if (error instanceof Error) {
    //       this.logger.error('Cache initialization error:', error);
    //       this.logger.warn(`Cache initialization failed (non-blocking): ${error.message}`, CacheService.name);
    //     } else {
    //       this.logger.error('Cache initialization failed with non-error value:', error);
    //     }
    //   });
    // }, 2000); // Wait 2 seconds before initializing cache
  }

  /**
   * Initialize cache with CMS_INVESTIGATOR and CMS_SUPERVISOR users
   */
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

      for (const role of this.CACHE_ROLES) {
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
          this.logger.error(`Failed to fetch users with role ${role}: ${error.message}`, CacheService.name);
        }
      }

      // Store all users in Redis with TTL
      if (Object.keys(cacheData).length > 0) {
        await this.redisService.mset(cacheData, this.CACHE_TTL_HOURS * 3600);
        this.cacheInitialized = true;
        this.logger.log(`User cache initialized in Redis with ${totalUsers} total users`, CacheService.name);
      } else {
        this.logger.warn('No users fetched for caching', CacheService.name);
      }
    } catch (error) {
      this.logger.warn(`Failed to initialize user cache (will fall back to API): ${error.message}`, CacheService.name);
      this.cacheInitialized = false;
    }
  }

  async getUsersByRole(token: string, role: string, tenantName: string): Promise<UserGroupDetails[]> {
    this.logger.log(`Fetching users with role: ${role}`);
    const users = await axios.get<UserGroupDetails[]>(`${this.AuthBaseUrl}/user/${role}?groupName=${tenantName}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return users.data;
  }

  /**
   * Get Redis cache key for user ID
   */
  private getCacheKey(userId: string): string {
    return `${this.CACHE_KEY_PREFIX}${userId}`;
  }

  /**
   * Refresh the user cache manually
   */
  // async refreshUserCache(): Promise<void> {
  //   this.logger.log('Refreshing user cache...', CacheService.name);
  //   await this.initializeUserCache();
  // }

  /**
   * Get user from cache
   * @param userId - The user ID to lookup
   * @returns UserDetails object or null if not found in cache
   */
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
      this.logger.warn(`Error getting user ${userId} from cache: ${error.message}`, CacheService.name);
      return null;
    }
  }

  /**
   * Get user email from cache
   * @param userId - The user ID to lookup
   * @returns User's email address or null if not found in cache
   */
  async getUserEmailFromCache(userId: string): Promise<string | null> {
    const user = await this.getUserFromCache(userId);
    return user?.email ?? null;
  }

  /**
   * Get user's full name from cache
   * @param userId - The user ID to lookup
   * @returns User's full name or null if not found in cache
   */
  async getUserFullNameFromCache(userId: string): Promise<string | null> {
    const user = await this.getUserFromCache(userId);
    if (user) {
      return `${user.firstName} ${user.lastName}`.trim();
    }
    return null;
  }

  /**
   * Batch get user emails from cache
   * @param userIds - Array of user IDs to lookup
   * @returns Map of userId to email for cached users only
   */
  async getBatchUserEmailsFromCache(userIds: string[]): Promise<Map<string, string>> {
    const emailMap = new Map<string, string>();

    if (!this.redisService.isConnected()) {
      return emailMap;
    }

    try {
      // Get cache keys for all user IDs
      const cacheKeys = userIds.map((id) => this.getCacheKey(id));
      const cachedData = await this.redisService.mget<UserDetails>(cacheKeys, true);

      // Map results back to user IDs
      userIds.forEach((userId) => {
        const cacheKey = this.getCacheKey(userId);
        const userData = cachedData[cacheKey];
        if (userData?.email) {
          emailMap.set(userId, userData.email);
        }
      });

      this.logger.debug(`Found ${emailMap.size} users in cache out of ${userIds.length} requested`, CacheService.name);
      return emailMap;
    } catch (error) {
      this.logger.warn(`Error during batch cache lookup: ${error.message}`, CacheService.name);
      return emailMap;
    }
  }

  /**
   * Check if cache is initialized and available
   */
  isCacheAvailable(): boolean {
    return this.cacheInitialized && this.redisService.isConnected();
  }
}
