import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connectRedis();
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.disconnect();
      this.logger.log('Redis client disconnected', RedisService.name);
    }
  }

  private async connectRedis(): Promise<void> {
    try {
      const redisConfig = {
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        password: this.configService.get<string>('REDIS_PASSWORD'),
        db: this.configService.get<number>('REDIS_DB', 0),
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      };

      // Remove password if not provided
      if (!redisConfig.password) {
        delete redisConfig.password;
      }

      this.client = new Redis(redisConfig);

      // Event handlers
      this.client.on('connect', () => {
        this.logger.log('Redis client connected', RedisService.name);
      });

      this.client.on('error', (error) => {
        this.logger.error(`Redis client error: ${error.message}`, RedisService.name);
      });

      this.client.on('close', () => {
        this.logger.log('Redis client disconnected', RedisService.name);
      });

      // Test connection
      await this.client.connect();
      await this.client.ping();
      this.logger.log('Redis connection successful', RedisService.name);
    } catch (error) {
      this.logger.error(`Failed to connect to Redis: ${error.message}`, RedisService.name);
      // Don't throw error to prevent app startup failure
      // The service methods will handle Redis unavailability gracefully
    }
  }

  /**
   * Check if Redis is available
   */
  isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  /**
   * Set a value in Redis with optional TTL
   */
  async set(key: string, value: string | object, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected()) {
      this.logger.warn('Redis not available, skipping set operation', RedisService.name);
      return;
    }

    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
    } catch (error) {
      this.logger.error(`Redis SET failed for key ${key}: ${error.message}`, RedisService.name);
    }
  }

  /**
   * Get a value from Redis
   */
  async get<T = string>(key: string, parseJson = false): Promise<T | null> {
    if (!this.isConnected()) {
      this.logger.warn('Redis not available, returning null', RedisService.name);
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value === null) return null;

      if (parseJson) {
        return JSON.parse(value) as T;
      }
      return value as T;
    } catch (error) {
      this.logger.error(`Redis GET failed for key ${key}: ${error.message}`, RedisService.name);
      return null;
    }
  }

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<void> {
    if (!this.isConnected()) {
      this.logger.warn('Redis not available, skipping delete operation', RedisService.name);
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Redis DEL failed for key ${key}: ${error.message}`, RedisService.name);
    }
  }

  /**
   * Set multiple key-value pairs with optional TTL
   */
  async mset(data: Record<string, string | object>, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected()) {
      this.logger.warn('Redis not available, skipping mset operation', RedisService.name);
      return;
    }

    try {
      const serializedData: string[] = [];

      for (const [key, value] of Object.entries(data)) {
        serializedData.push(key);
        serializedData.push(typeof value === 'string' ? value : JSON.stringify(value));
      }

      await this.client.mset(...serializedData);

      // Set TTL for each key if specified
      if (ttlSeconds) {
        const keys = Object.keys(data);
        const pipeline = this.client.pipeline();
        keys.forEach((key) => pipeline.expire(key, ttlSeconds));
        await pipeline.exec();
      }
    } catch (error) {
      this.logger.error(`Redis MSET failed: ${error.message}`, RedisService.name);
    }
  }

  /**
   * Get multiple keys from Redis
   */
  async mget<T = string>(keys: string[], parseJson = false): Promise<Record<string, T | null>> {
    if (!this.isConnected()) {
      this.logger.warn('Redis not available, returning empty object', RedisService.name);
      return {};
    }

    try {
      const values = await this.client.mget(...keys);
      const result: Record<string, T | null> = {};

      keys.forEach((key, index) => {
        const value = values[index];
        if (value === null) {
          result[key] = null;
        } else if (parseJson) {
          result[key] = JSON.parse(value) as T;
        } else {
          result[key] = value as T;
        }
      });

      return result;
    } catch (error) {
      this.logger.error(`Redis MGET failed: ${error.message}`, RedisService.name);
      return {};
    }
  }

  /**
   * Check if key exists in Redis
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected()) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis EXISTS failed for key ${key}: ${error.message}`, RedisService.name);
      return false;
    }
  }

  /**
   * Set TTL for a key
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.isConnected()) {
      return;
    }

    try {
      await this.client.expire(key, ttlSeconds);
    } catch (error) {
      this.logger.error(`Redis EXPIRE failed for key ${key}: ${error.message}`, RedisService.name);
    }
  }

  /**
   * Clear all cache data (use with caution)
   */
  async flushAll(): Promise<void> {
    if (!this.isConnected()) {
      this.logger.warn('Redis not available, skipping flush operation', RedisService.name);
      return;
    }

    try {
      await this.client.flushall();
      this.logger.log('Redis cache cleared', RedisService.name);
    } catch (error) {
      this.logger.error(`Redis FLUSHALL failed: ${error.message}`, RedisService.name);
    }
  }

  /**
   * Get Redis client for advanced operations
   */
  getClient(): Redis | null {
    return this.isConnected() ? this.client : null;
  }
}
