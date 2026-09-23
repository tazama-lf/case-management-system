import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplicationContext } from '@nestjs/common';
import { RedisIoAdapter } from '../src/redis-io.adapter';
import { RedisService } from '../src/modules/shared/redis.service';

const mockCreateAdapter = jest.fn().mockReturnValue('redis-adapter-instance');

jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: (...args: unknown[]) => mockCreateAdapter(...args),
}));

// Short enough to keep the "Redis never becomes ready" test fast, long enough to exercise at
// least one retry tick in the "not ready yet" tests.
const READY_TIMEOUT_MS = 150;
const POLL_INTERVAL_MS = 10;

const wait = async (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('RedisIoAdapter', () => {
  let mockServer: { adapter: jest.Mock };
  let mockPubClient: { duplicate: jest.Mock };
  let mockSubClient: { on: jest.Mock; connect: jest.Mock };
  let mockRedisService: { getClient: jest.Mock };
  let mockApp: INestApplicationContext;
  let createIOServerSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    mockServer = { adapter: jest.fn() };
    createIOServerSpy = jest.spyOn(IoAdapter.prototype, 'createIOServer').mockReturnValue(mockServer as never);

    mockSubClient = {
      on: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
    };
    mockPubClient = {
      duplicate: jest.fn().mockReturnValue(mockSubClient),
    };
    mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockPubClient),
    };

    mockApp = {
      get: jest.fn().mockReturnValue(mockRedisService),
    } as unknown as INestApplicationContext;
  });

  afterEach(() => {
    createIOServerSpy.mockRestore();
  });

  const newAdapter = (): RedisIoAdapter => new RedisIoAdapter(mockApp, READY_TIMEOUT_MS, POLL_INTERVAL_MS);

  it('returns the underlying server built by the base IoAdapter synchronously', () => {
    const adapter = newAdapter();

    const server = adapter.createIOServer(3090);

    expect(server).toBe(mockServer);
    expect(createIOServerSpy).toHaveBeenCalledWith(3090, undefined);
  });

  it('attaches the Redis adapter once the sub client connects, when Redis is reachable', async () => {
    const adapter = newAdapter();

    adapter.createIOServer(3090);
    await wait(POLL_INTERVAL_MS * 2);

    expect(mockPubClient.duplicate).toHaveBeenCalled();
    expect(mockCreateAdapter).toHaveBeenCalledWith(mockPubClient, mockSubClient);
    expect(mockServer.adapter).toHaveBeenCalledWith('redis-adapter-instance');
  });

  it('registers an error handler on the sub client', async () => {
    const adapter = newAdapter();

    adapter.createIOServer(3090);
    await wait(POLL_INTERVAL_MS * 2);

    expect(mockSubClient.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('resolves the Redis client through RedisService looked up on the app context', async () => {
    const adapter = newAdapter();

    adapter.createIOServer(3090);
    await wait(POLL_INTERVAL_MS * 2);

    expect(mockApp.get).toHaveBeenCalledWith(RedisService);
  });

  it('falls back to the default adapter without throwing when Redis never becomes reachable', async () => {
    mockRedisService.getClient.mockReturnValue(null);
    const adapter = newAdapter();

    expect(() => adapter.createIOServer(3090)).not.toThrow();
    await wait(READY_TIMEOUT_MS + POLL_INTERVAL_MS * 2);

    expect(mockServer.adapter).not.toHaveBeenCalled();
    expect(mockPubClient.duplicate).not.toHaveBeenCalled();
  });

  it('falls back to the default adapter without throwing when the sub client fails to connect', async () => {
    const connectError = new Error('ECONNREFUSED');
    mockSubClient.connect.mockRejectedValue(connectError);
    const adapter = newAdapter();

    expect(() => adapter.createIOServer(3090)).not.toThrow();
    await wait(POLL_INTERVAL_MS * 2);

    expect(mockServer.adapter).not.toHaveBeenCalled();
  });

  // Regression coverage: createIOServer() runs before RedisService's onModuleInit has assigned
  // its client, so getClient() throws on the first (and possibly several) polls rather than just
  // returning null. The adapter must swallow that and keep retrying instead of crashing app boot.
  it('retries past getClient() throwing (RedisService not yet initialized) and attaches once ready', async () => {
    mockRedisService.getClient
      .mockImplementationOnce(() => {
        throw new TypeError("Cannot read properties of undefined (reading 'status')");
      })
      .mockImplementationOnce(() => {
        throw new TypeError("Cannot read properties of undefined (reading 'status')");
      })
      .mockReturnValue(mockPubClient);
    const adapter = newAdapter();

    expect(() => adapter.createIOServer(3090)).not.toThrow();
    await wait(POLL_INTERVAL_MS * 4);

    expect(mockServer.adapter).toHaveBeenCalledWith('redis-adapter-instance');
  });

  it('falls back without throwing when getClient() keeps throwing until the timeout elapses', async () => {
    mockRedisService.getClient.mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'status')");
    });
    const adapter = newAdapter();

    expect(() => adapter.createIOServer(3090)).not.toThrow();
    await wait(READY_TIMEOUT_MS + POLL_INTERVAL_MS * 2);

    expect(mockServer.adapter).not.toHaveBeenCalled();
  });
});
