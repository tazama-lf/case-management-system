import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../src/modules/shared/redis.service';
import { ConfigService } from '@nestjs/config';

// Create mock Redis client
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  ping: jest.fn().mockResolvedValue('PONG'),
  disconnect: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  status: 'ready',
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(1),
  mset: jest.fn().mockResolvedValue('OK'),
  mget: jest.fn().mockResolvedValue([]),
  exists: jest.fn().mockResolvedValue(0),
  expire: jest.fn().mockResolvedValue(1),
  flushall: jest.fn().mockResolvedValue('OK'),
  pipeline: jest.fn().mockReturnValue({
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  }),
};

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockRedisClient),
  };
});

describe('RedisService', () => {
  let service: RedisService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // Reset mock client state
    mockRedisClient.status = 'ready';
    jest.clearAllMocks();

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
          REDIS_PASSWORD: 'secret',
          REDIS_DB: 0,
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should connect to Redis with full configuration', async () => {
      const Redis = require('ioredis').default;
      await service.onModuleInit();

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 6379,
          password: 'secret',
          db: 0,
        }),
      );
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    it('should connect without password when not configured', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
          REDIS_PASSWORD: undefined,
          REDIS_DB: 0,
        };
        return config[key] ?? defaultValue;
      });

      const newModule = await Test.createTestingModule({
        providers: [RedisService, { provide: ConfigService, useValue: configService }],
      }).compile();
      const newService = newModule.get<RedisService>(RedisService);

      await newService.onModuleInit();

      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should register event handlers', async () => {
      await service.onModuleInit();

      expect(mockRedisClient.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should handle connection errors gracefully', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection refused'));

      await service.onModuleInit();

      expect(mockRedisClient.connect).toHaveBeenCalled();
      // Should not throw error
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect Redis client on module destroy', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('isConnected', () => {
    it('should return true when Redis is connected', async () => {
      await service.onModuleInit();
      mockRedisClient.status = 'ready';

      expect(service.isConnected()).toBe(true);
    });

    it('should return false when Redis is not connected', async () => {
      await service.onModuleInit();
      mockRedisClient.status = 'end' as any;

      expect(service.isConnected()).toBe(false);
    });
  });

  describe('set', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should set string value without TTL', async () => {
      await service.set('key1', 'value1');

      expect(mockRedisClient.set).toHaveBeenCalledWith('key1', 'value1');
    });

    it('should set string value with TTL', async () => {
      await service.set('key1', 'value1', 3600);

      expect(mockRedisClient.setex).toHaveBeenCalledWith('key1', 3600, 'value1');
    });

    it('should set object value', async () => {
      const obj = { foo: 'bar', count: 42 };
      await service.set('key1', obj);

      expect(mockRedisClient.set).toHaveBeenCalledWith('key1', JSON.stringify(obj));
    });

    it('should set object value with TTL', async () => {
      const obj = { foo: 'bar' };
      await service.set('key1', obj, 1800);

      expect(mockRedisClient.setex).toHaveBeenCalledWith('key1', 1800, JSON.stringify(obj));
    });

    it('should skip operation when Redis not connected', async () => {
      mockRedisClient.status = 'end' as any;

      await service.set('key1', 'value1');

      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('should handle set errors gracefully', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis error'));

      await service.set('key1', 'value1');

      // Should not throw error
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should get string value', async () => {
      mockRedisClient.get.mockResolvedValue('value1');

      const result = await service.get('key1');

      expect(result).toBe('value1');
      expect(mockRedisClient.get).toHaveBeenCalledWith('key1');
    });

    it('should get and parse JSON value', async () => {
      const obj = { foo: 'bar', count: 42 };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(obj));

      const result = await service.get<any>('key1', true);

      expect(result).toEqual(obj);
    });

    it('should return null for non-existent key', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.get('key1');

      expect(result).toBeNull();
    });

    it('should return null when Redis not connected', async () => {
      mockRedisClient.status = 'end' as any;

      const result = await service.get('key1');

      expect(result).toBeNull();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('should handle get errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.get('key1');

      expect(result).toBeNull();
    });

    it('should handle JSON parse errors', async () => {
      mockRedisClient.get.mockResolvedValue('invalid json');

      const result = await service.get('key1', true);

      expect(result).toBeNull();
    });
  });

  describe('del', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should delete a key', async () => {
      await service.del('key1');

      expect(mockRedisClient.del).toHaveBeenCalledWith('key1');
    });

    it('should skip operation when Redis not connected', async () => {
      mockRedisClient.status = 'end' as any;

      await service.del('key1');

      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should handle delete errors gracefully', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      await service.del('key1');

      // Should not throw error
    });
  });

  describe('mset', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should set multiple string values', async () => {
      await service.mset({ key1: 'value1', key2: 'value2' });

      expect(mockRedisClient.mset).toHaveBeenCalledWith('key1', 'value1', 'key2', 'value2');
    });

    it('should set multiple object values', async () => {
      const data = { key1: { foo: 'bar' }, key2: { count: 42 } };
      await service.mset(data);

      expect(mockRedisClient.mset).toHaveBeenCalledWith('key1', JSON.stringify({ foo: 'bar' }), 'key2', JSON.stringify({ count: 42 }));
    });

    it('should set multiple values with TTL', async () => {
      const mockPipeline = {
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      mockRedisClient.pipeline.mockReturnValue(mockPipeline as any);

      await service.mset({ key1: 'value1', key2: 'value2' }, 3600);

      expect(mockRedisClient.mset).toHaveBeenCalled();
      expect(mockPipeline.expire).toHaveBeenCalledWith('key1', 3600);
      expect(mockPipeline.expire).toHaveBeenCalledWith('key2', 3600);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should skip operation when Redis not connected', async () => {
      mockRedisClient.status = 'end' as any;

      await service.mset({ key1: 'value1' });

      expect(mockRedisClient.mset).not.toHaveBeenCalled();
    });

    it('should handle mset errors gracefully', async () => {
      mockRedisClient.mset.mockRejectedValue(new Error('Redis error'));

      await service.mset({ key1: 'value1' });

      // Should not throw error
    });
  });

  describe('mget', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should get multiple string values', async () => {
      mockRedisClient.mget.mockResolvedValue(['value1', 'value2', null]);

      const result = await service.mget(['key1', 'key2', 'key3']);

      expect(result).toEqual({ key1: 'value1', key2: 'value2', key3: null });
      expect(mockRedisClient.mget).toHaveBeenCalledWith('key1', 'key2', 'key3');
    });

    it('should get and parse multiple JSON values', async () => {
      mockRedisClient.mget.mockResolvedValue([JSON.stringify({ foo: 'bar' }), JSON.stringify({ count: 42 })]);

      const result = await service.mget(['key1', 'key2'], true);

      expect(result).toEqual({ key1: { foo: 'bar' }, key2: { count: 42 } });
    });

    it('should return empty object when Redis not connected', async () => {
      mockRedisClient.status = 'end' as any;

      const result = await service.mget(['key1']);

      expect(result).toEqual({});
      expect(mockRedisClient.mget).not.toHaveBeenCalled();
    });

    it('should handle mget errors gracefully', async () => {
      mockRedisClient.mget.mockRejectedValue(new Error('Redis error'));

      const result = await service.mget(['key1']);

      expect(result).toEqual({});
    });
  });

  describe('exists', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return true when key exists', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await service.exists('key1');

      expect(result).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('key1');
    });

    it('should return false when key does not exist', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await service.exists('key1');

      expect(result).toBe(false);
    });

    it('should return false when Redis not connected', async () => {
      mockRedisClient.status = 'end' as any;

      const result = await service.exists('key1');

      expect(result).toBe(false);
      expect(mockRedisClient.exists).not.toHaveBeenCalled();
    });

    it('should handle exists errors gracefully', async () => {
      mockRedisClient.exists.mockRejectedValue(new Error('Redis error'));

      const result = await service.exists('key1');

      expect(result).toBe(false);
    });
  });

  describe('expire', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should set TTL for a key', async () => {
      await service.expire('key1', 3600);

      expect(mockRedisClient.expire).toHaveBeenCalledWith('key1', 3600);
    });

    it('should skip operation when Redis not connected', async () => {
      mockRedisClient.status = 'end' as any;

      await service.expire('key1', 3600);

      expect(mockRedisClient.expire).not.toHaveBeenCalled();
    });

    it('should handle expire errors gracefully', async () => {
      mockRedisClient.expire.mockRejectedValue(new Error('Redis error'));

      await service.expire('key1', 3600);

      // Should not throw error
    });
  });

  describe('flushAll', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should flush all Redis data', async () => {
      await service.flushAll();

      expect(mockRedisClient.flushall).toHaveBeenCalled();
    });

    it('should skip operation when Redis not connected', async () => {
      mockRedisClient.status = 'end' as any;

      await service.flushAll();

      expect(mockRedisClient.flushall).not.toHaveBeenCalled();
    });

    it('should handle flushall errors gracefully', async () => {
      mockRedisClient.flushall.mockRejectedValue(new Error('Redis error'));

      await service.flushAll();

      // Should not throw error
    });
  });

  describe('getClient', () => {
    it('should return Redis client when connected', async () => {
      await service.onModuleInit();
      mockRedisClient.status = 'ready';

      const client = service.getClient();

      expect(client).toBe(mockRedisClient);
    });

    it('should return null when not connected', async () => {
      await service.onModuleInit();
      mockRedisClient.status = 'end' as any;

      const client = service.getClient();

      expect(client).toBeNull();
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should handle empty data in mset', async () => {
      await service.mset({});

      expect(mockRedisClient.mset).toHaveBeenCalledWith();
    });

    it('should handle empty keys array in mget', async () => {
      mockRedisClient.mget.mockResolvedValue([]);

      const result = await service.mget([]);

      expect(result).toEqual({});
    });

    it('should handle very long keys', async () => {
      const longKey = 'a'.repeat(10000);
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set(longKey, 'value');

      expect(mockRedisClient.set).toHaveBeenCalledWith(longKey, 'value');
    });

    it('should handle very large objects', async () => {
      const largeObj = { data: 'x'.repeat(1000000) };
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('key1', largeObj);

      expect(mockRedisClient.set).toHaveBeenCalledWith('key1', JSON.stringify(largeObj));
    });

    it('should handle special characters in keys', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('key:with:colons', 'value');
      await service.set('key-with-dashes', 'value');
      await service.set('key.with.dots', 'value');

      expect(mockRedisClient.set).toHaveBeenCalledTimes(3);
    });
  });
});
