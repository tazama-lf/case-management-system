import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../shared/redis.service';
import { AuthHelperService } from '../auth/auth-helper.service';
import { AuthService } from '../auth/auth.service';

export interface UserDetails {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    fullName: string;
    roles: string[];
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

    constructor(
        private readonly redisService: RedisService,
        private readonly authHelperService: AuthHelperService,
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Initialize user cache on module startup
     */
    async onModuleInit() {
        this.logger.log('Initializing CMS cache...', CacheService.name);
        // Don't await to avoid blocking startup - let it run in background
        this.initializeUserCache().catch(error => {
            this.logger.warn(`Cache initialization failed (non-blocking): ${error.message}`, CacheService.name);
        });
    }

    /**
     * Initialize cache with CMS_INVESTIGATOR and CMS_SUPERVISOR users
     */
    private async initializeUserCache(): Promise<void> {
        try {
            if (!this.redisService.isConnected()) {
                this.logger.warn('Redis not connected, skipping cache initialization', CacheService.name);
                return;
            }

            const cacheData: Record<string, UserDetails> = {};
            let totalUsers = 0;

            for (const role of this.CACHE_ROLES) {
                try {
                    this.logger.log(`Fetching users with role: ${role}`, CacheService.name);

                    // Get admin token for API calls
                    const adminData = await this.authService.login(
                        this.configService.get<string>('TAZAMA_AUTH_ADMIN_USERNAME') || '',
                        this.configService.get<string>('TAZAMA_AUTH_ADMIN_PASSWORD') || '',
                    );

                    const users = await this.authHelperService.getAllUsersWithRole(role, adminData.token);

                    for (const user of users) {
                        const userDetails: UserDetails = {
                            id: user.id,
                            username: user.username,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            fullName: `${user.firstName} ${user.lastName}`.trim(),
                            email: user.email,
                            roles: user.roles,
                        };

                        cacheData[this.getCacheKey(user.id)] = userDetails;
                        totalUsers++;
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
                this.logger.warn(`No users fetched for caching`, CacheService.name);
            }
        } catch (error) {
            this.logger.warn(`Failed to initialize user cache (will fall back to API): ${error.message}`, CacheService.name);
            this.cacheInitialized = false;
        }
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
    async refreshUserCache(): Promise<void> {
        this.logger.log('Refreshing user cache...', CacheService.name);
        await this.initializeUserCache();
    }

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
        return user?.email || null;
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
            const cacheKeys = userIds.map(id => this.getCacheKey(id));
            const cachedData = await this.redisService.mget<UserDetails>(cacheKeys, true);

            // Map results back to user IDs
            userIds.forEach(userId => {
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