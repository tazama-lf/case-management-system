import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../shared/redis.service';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import { UserGroupDetails } from '../../utils/types/UserList';
import { resolveCmsRole } from '../../utils/cms-roles';

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
  private readonly CACHE_TTL_HOURS = 720; // 720 hours == 30 days TTL
  private readonly AuthBaseUrl: string;

  // In-memory copy of the user directory, kept alongside Redis. Redis stays the shared, 30-day source of
  // truth, but role lookups (who is a supervisor, who may be revoked) must not stop working just because
  // Redis is down or was restarted empty - without this every role was "unknown" and revoke/blacklist
  // failed closed. Per process, and short-lived so a role change in Keycloak is picked up.
  private readonly localUsers = new Map<string, { user: UserDetails; expiresAt: number }>();
  private readonly LOCAL_USER_TTL_MS = 12 * 60 * 60 * 1000;

  // Guards refreshDirectoryIfUnknown so a burst of requests triggers one refresh, and a user who is
  // genuinely not in any role group cannot make every request hit the auth service.
  private directoryRefresh: Promise<void> | null = null;
  private lastDirectoryRefreshAt = 0;
  private readonly DIRECTORY_REFRESH_COOLDOWN_MS = 60 * 1000;

  // Users confirmed to be in the directory, and when. Page loads for a known user then cost a Map lookup
  // - no Redis round trip, no auth-service call - for the next few minutes.
  private readonly verifiedUsers = new Map<string, number>();
  private readonly VERIFIED_USER_TTL_MS = 5 * 60 * 1000;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.AuthBaseUrl = this.configService.get<string>('TAZAMA_AUTH_URL')!;
  }

  /**
   * Fetches every cached role's users from the auth service and stores them: in Redis when it is
   * connected (shared, 30-day TTL) and always in the in-memory fallback. `retryCount` is kept for the
   * existing callers; there is nothing to wait for any more - an unreachable Redis no longer blocks this.
   */
  public async initializeUserCache(retryCount = 0, token: string): Promise<void> {
    this.logger.log(`InitializeUserCache called (attempt ${retryCount + 1})`, CacheService.name);

    try {
      const cacheData: Record<string, UserDetails> = {};
      let totalUsers = 0;
      const rolePromises = this.CACHE_ROLES.map(async (role) => {
        try {
          this.logger.log(`Fetching users with role: ${role}`, CacheService.name);

          const users = await this.getUsersByRole(token, role, this.configService.get<string>('KEYCLOAK_GROUP_NAME') ?? '');

          for (const user of users) {
            const key = this.getCacheKey(user.id);

            // CACHE_ROLES' fetches run in parallel (Promise.all below) and each one's
            // completion synchronously writes its own users into this shared cacheData
            // object. A user present in more than one role's results (e.g. an investigator
            // who is also a supervisor) must keep every role seen so far rather than have
            // whichever fetch finishes last overwrite the others.
            // Checked via hasOwn rather than truthiness of cacheData[key] itself - Record's
            // plain index signature types that lookup as always UserDetails (never undefined),
            // even though a key nothing has written yet genuinely is undefined at runtime.
            if (Object.hasOwn(cacheData, key)) {
              const existing = cacheData[key];
              existing.roles = [...new Set([...(existing.roles ?? []), role])];
            } else {
              cacheData[key] = {
                id: user.id,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: `${user.firstName} ${user.lastName}`.trim(),
                email: user.email,
                roles: [role],
              };
            }

            totalUsers += 1;
          }

          this.logger.log(`Cached ${users.length} users with role: ${role}`, CacheService.name);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.logger.error(`Failed to fetch users with role ${role}: ${err.message}`, CacheService.name);
        }
      });

      await Promise.all(rolePromises);

      if (Object.keys(cacheData).length > 0) {
        this.storeLocally(cacheData);
        if (this.redisService.isConnected()) {
          await this.redisService.mset(cacheData, this.CACHE_TTL_HOURS * 3600);
          this.logger.log(`User cache initialized in Redis with ${totalUsers} total users`, CacheService.name);
        } else {
          this.logger.warn(`Redis not connected - kept ${totalUsers} users in the in-memory directory only`, CacheService.name);
        }
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

  private storeLocally(users: Record<string, UserDetails>): void {
    const expiresAt = Date.now() + this.LOCAL_USER_TTL_MS;
    for (const user of Object.values(users)) {
      this.localUsers.set(user.id, { user, expiresAt });
    }
  }

  private getLocalUser(userId: string): UserDetails | null {
    const entry = this.localUsers.get(userId);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt < Date.now()) {
      this.localUsers.delete(userId);
      return null;
    }
    return entry.user;
  }

  async getUserFromCache(userId: string): Promise<UserDetails | null> {
    const localUser = this.getLocalUser(userId);

    if (!this.redisService.isConnected()) {
      this.logger.debug('Redis not connected, cache unavailable', CacheService.name);
      return localUser;
    }

    try {
      const cachedUser = await this.redisService.get<UserDetails>(this.getCacheKey(userId), true);
      if (cachedUser) {
        this.logger.debug(`User ${userId} found in Redis cache`, CacheService.name);
        return cachedUser;
      }

      this.logger.debug(`User ${userId} not found in Redis cache`, CacheService.name);
      return localUser;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Error getting user ${userId} from cache: ${errorMessage}`, CacheService.name);
      if (localUser) {
        return localUser;
      }
      throw error;
    }
  }

  /**
   * Repairs the user directory when the given (logged-in) user is not in it - after a backend restart,
   * a Redis outage or flush, or a user the last refresh predates. Safe to call on every request: it is a
   * no-op when the user is known, joins a refresh already in flight, and is rate-limited otherwise.
   */
  async refreshDirectoryIfUnknown(userId: string, token: string): Promise<void> {
    // The common case, on every page load: a user confirmed a moment ago, or one in this process's own
    // in-memory copy. No I/O at all.
    const verifiedAt = this.verifiedUsers.get(userId);
    if (verifiedAt !== undefined && Date.now() - verifiedAt < this.VERIFIED_USER_TTL_MS) {
      return;
    }
    if (this.getLocalUser(userId)) {
      this.verifiedUsers.set(userId, Date.now());
      return;
    }

    if (this.directoryRefresh) {
      await this.directoryRefresh;
      return;
    }

    let known: UserDetails | null;
    try {
      known = await this.getUserFromCache(userId);
    } catch {
      known = null;
    }
    if (known) {
      this.verifiedUsers.set(userId, Date.now());
      return;
    }

    if (Date.now() - this.lastDirectoryRefreshAt < this.DIRECTORY_REFRESH_COOLDOWN_MS) {
      return;
    }
    this.lastDirectoryRefreshAt = Date.now();

    this.directoryRefresh = this.initializeUserCache(0, token).finally(() => {
      this.directoryRefresh = null;
    });
    await this.directoryRefresh;
  }

  async getUserEmailFromCache(userId: string): Promise<string | null> {
    const user = await this.getUserFromCache(userId);
    return user?.email ?? null;
  }

  async getUserRole(userId: string): Promise<string | null> {
    const user = await this.getUserFromCache(userId);
    if (!user?.roles || user.roles.length === 0) {
      return null;
    }

    // Resolved by the shared precedence (utils/cms-roles), not by whichever role's parallel fetch in
    // initializeUserCache finished last - and identically to the token's role.
    return resolveCmsRole(user.roles) ?? user.roles[0];
  }

  /**
   * Store user JWT token in Redis cache with TTL matching the token's expiration.
   *
   * Safe to call on every proxied request, not just when the cache is known to be stale:
   * a token only ever overwrites what's cached if it is actually newer (later `exp`). Without
   * that check, an older browser tab or notebook kernel still holding an earlier token could
   * call this after a newer token was already cached for the same user and regress it back.
   *
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

      const existingToken = await this.getUserToken(userId);
      if (existingToken) {
        const existingDecoded = jwt.decode(existingToken) as { exp?: number } | null;
        if (existingDecoded?.exp && existingDecoded.exp >= decoded.exp) {
          this.logger.debug(`Cached token for user ${userId} is already as fresh or fresher, skipping write`, CacheService.name);
          return;
        }
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
