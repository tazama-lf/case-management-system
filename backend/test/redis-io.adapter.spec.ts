import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplicationContext } from '@nestjs/common';
import { RedisIoAdapter } from '../src/redis-io.adapter';
import { RedisService } from '../src/modules/shared/redis.service';

// Mirrors what the real @socket.io/redis-adapter constructor does: calls subscribe()/psubscribe()
// on the sub client synchronously, with no promise exposed for either. Tests drive success/failure
// through mockSubClient.subscribe/psubscribe rather than this function's own return value.
const mockCreateAdapter = jest.fn((_pubClient: unknown, subClient: { subscribe: (...a: unknown[]) => unknown; psubscribe: (...a: unknown[]) => unknown }) => {
  subClient.subscribe('request-channel', 'response-channel');
  subClient.psubscribe('channel*');
  return 'redis-adapter-instance';
});

jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: (pubClient: unknown, subClient: { subscribe: (...a: unknown[]) => unknown; psubscribe: (...a: unknown[]) => unknown }) =>
    mockCreateAdapter(pubClient, subClient),
}));

// Short enough to keep the "Redis never becomes ready" test fast, long enough to exercise at
// least one retry tick in the "not ready yet" tests. Tests await adapter.waitUntilReady() rather
// than sleeping a guessed duration, so these values only affect how long the fallback tests take
// to settle, not whether any test can assert too early.
const READY_TIMEOUT_MS = 150;
const POLL_INTERVAL_MS = 10;

describe('RedisIoAdapter', () => {
  let mockServer: { adapter: jest.Mock };
  let mockPubClient: { duplicate: jest.Mock };
  let mockSubClient: {
    on: jest.Mock;
    connect: jest.Mock;
    disconnect: jest.Mock;
    subscribe: jest.Mock;
    psubscribe: jest.Mock;
    unsubscribe: jest.Mock;
    punsubscribe: jest.Mock;
    quit: jest.Mock;
  };
  let mockRedisService: { getClient: jest.Mock };
  let mockApp: INestApplicationContext;
  let createIOServerSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // The getter form (no args) stands in for "whatever adapter constructor was active before
    // this adapter touched it" - a distinct sentinel so tests can assert a restore actually
    // happened, separately from the setter form (called with the Redis adapter constructor).
    mockServer = { adapter: jest.fn().mockReturnValue('default-adapter-instance') };
    createIOServerSpy = jest.spyOn(IoAdapter.prototype, 'createIOServer').mockReturnValue(mockServer as never);

    mockSubClient = {
      on: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      subscribe: jest.fn().mockResolvedValue(undefined),
      psubscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      punsubscribe: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue('OK'),
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
    await adapter.waitUntilReady();

    expect(mockPubClient.duplicate).toHaveBeenCalled();
    expect(mockCreateAdapter).toHaveBeenCalledWith(mockPubClient, mockSubClient);
    expect(mockServer.adapter).toHaveBeenCalledWith('redis-adapter-instance');
  });

  it('registers an error handler on the sub client', async () => {
    const adapter = newAdapter();

    adapter.createIOServer(3090);
    await adapter.waitUntilReady();

    expect(mockSubClient.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('resolves the Redis client through RedisService looked up on the app context', async () => {
    const adapter = newAdapter();

    adapter.createIOServer(3090);
    await adapter.waitUntilReady();

    expect(mockApp.get).toHaveBeenCalledWith(RedisService);
  });

  it('falls back to the default adapter without throwing when Redis never becomes reachable', async () => {
    mockRedisService.getClient.mockReturnValue(null);
    const adapter = newAdapter();

    expect(() => adapter.createIOServer(3090)).not.toThrow();
    await adapter.waitUntilReady();

    expect(mockServer.adapter).not.toHaveBeenCalled();
    expect(mockPubClient.duplicate).not.toHaveBeenCalled();
  });

  it('falls back to the default adapter without throwing when the sub client fails to connect', async () => {
    const connectError = new Error('ECONNREFUSED');
    mockSubClient.connect.mockRejectedValue(connectError);
    const adapter = newAdapter();

    expect(() => adapter.createIOServer(3090)).not.toThrow();
    await adapter.waitUntilReady();

    // connect() fails before the Redis adapter is ever installed, so the only call server.adapter
    // sees is the getter read (to know what to restore on failure) - never a set to the Redis one.
    expect(mockServer.adapter).not.toHaveBeenCalledWith('redis-adapter-instance');
    // The failed-to-connect sub client must be disconnected itself, so it doesn't sit there
    // retrying via its own retryStrategy and logging on every attempt for a client the fallback
    // path never ends up using.
    expect(mockSubClient.disconnect).toHaveBeenCalled();
  });

  // Regression coverage: ioredis's connectTimeout bounds connect() by default, but there's no
  // equivalent default for ping() (commandTimeout isn't set) - a connected-but-silent Redis would
  // leave it pending forever, and since main.ts awaits waitUntilReady() before app.listen(), that
  // would block the whole app from ever accepting connections, not just WebSocket ones.
  it('falls back without hanging when connect() never settles', async () => {
    mockSubClient.connect.mockReturnValue(new Promise(() => {}));
    const adapter = newAdapter();

    expect(() => adapter.createIOServer(3090)).not.toThrow();
    await adapter.waitUntilReady();

    expect(mockServer.adapter).not.toHaveBeenCalledWith('redis-adapter-instance');
  }, READY_TIMEOUT_MS + 2000);

  it('falls back without hanging when subscription setup never settles', async () => {
    mockSubClient.subscribe.mockReturnValue(new Promise(() => {}));
    const adapter = newAdapter();

    expect(() => adapter.createIOServer(3090)).not.toThrow();
    await adapter.waitUntilReady();

    expect(mockSubClient.disconnect).toHaveBeenCalled();
    expect(mockServer.adapter).toHaveBeenNthCalledWith(3, 'default-adapter-instance');
  }, READY_TIMEOUT_MS + 2000);

  // Regression coverage: createAdapter()'s constructor calls subscribe()/psubscribe() on the sub
  // client with no promise exposed for either - a rejection there (e.g. an ACL denying SUBSCRIBE
  // for this connection while other commands still work fine) has to be caught by intercepting
  // those specific calls, not inferred from some other command happening to succeed.
  it('falls back to the default adapter without throwing when a subscription rejects', async () => {
    const subscribeError = new Error('NOPERM this user has no permissions to run the subscribe command');
    mockSubClient.subscribe.mockRejectedValue(subscribeError);
    const adapter = newAdapter();

    expect(() => adapter.createIOServer(3090)).not.toThrow();
    await adapter.waitUntilReady();

    expect(mockSubClient.disconnect).toHaveBeenCalled();
    // server.adapter() is called with the (now-broken) Redis adapter before the rejection is
    // discovered, then must be restored - otherwise this instance is left able to publish to
    // other pods but never receive from them, which is worse than the clean fallback.
    expect(mockServer.adapter).toHaveBeenNthCalledWith(2, 'redis-adapter-instance');
    expect(mockServer.adapter).toHaveBeenNthCalledWith(3, 'default-adapter-instance');
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
    await adapter.waitUntilReady();

    expect(mockServer.adapter).toHaveBeenCalledWith('redis-adapter-instance');
  });

  it('falls back without throwing when getClient() keeps throwing until the timeout elapses', async () => {
    mockRedisService.getClient.mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'status')");
    });
    const adapter = newAdapter();

    expect(() => adapter.createIOServer(3090)).not.toThrow();
    await adapter.waitUntilReady();

    expect(mockServer.adapter).not.toHaveBeenCalled();
  });

  describe('close()', () => {
    let closeSpy: jest.SpyInstance;

    beforeEach(() => {
      // Mirrors what super.close() ends up doing via the real @socket.io/redis-adapter's close():
      // sends the unsubscribe commands on the sub client without awaiting or handling them.
      closeSpy = jest.spyOn(IoAdapter.prototype, 'close').mockImplementation(async () => {
        mockSubClient.punsubscribe('channel*');
        mockSubClient.unsubscribe(['request-channel', 'response-channel']);
      });
    });

    afterEach(() => {
      closeSpy.mockRestore();
    });

    const attachedAdapter = async (): Promise<RedisIoAdapter> => {
      const adapter = newAdapter();
      adapter.createIOServer(3090);
      await adapter.waitUntilReady();
      return adapter;
    };

    // Regression coverage: against a connected-but-silent Redis, the unsubscribes super.close()
    // sends and quit() all stay pending until quit() times out and disconnect() rejects everything
    // still queued - the unsubscribe rejections must not surface as unhandled rejections.
    it('force-disconnects after quit() times out without leaving unsubscribe rejections unhandled', async () => {
      const adapter = await attachedAdapter();
      const rejectPending: Array<(error: Error) => void> = [];
      const pendingUntilDisconnect = () =>
        new Promise((_resolve, reject) => {
          rejectPending.push(reject);
        });
      mockSubClient.unsubscribe.mockImplementation(pendingUntilDisconnect);
      mockSubClient.punsubscribe.mockImplementation(pendingUntilDisconnect);
      mockSubClient.quit.mockImplementation(pendingUntilDisconnect);
      mockSubClient.disconnect.mockImplementation(() => {
        rejectPending.forEach((reject) => reject(new Error('Connection is closed.')));
      });
      const unhandled = jest.fn();
      process.on('unhandledRejection', unhandled);

      try {
        await adapter.close(mockServer as never);
        // unhandledRejection fires only once the microtask queue has drained.
        await new Promise((resolve) => {
          setImmediate(resolve);
        });
      } finally {
        process.off('unhandledRejection', unhandled);
      }

      expect(mockSubClient.unsubscribe).toHaveBeenCalled();
      expect(mockSubClient.punsubscribe).toHaveBeenCalled();
      expect(mockSubClient.disconnect).toHaveBeenCalled();
      expect(unhandled).not.toHaveBeenCalled();
    }, READY_TIMEOUT_MS + 2000);

    it('unsubscribes before quitting and does not force-disconnect when Redis responds', async () => {
      const adapter = await attachedAdapter();

      await adapter.close(mockServer as never);

      expect(mockSubClient.unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
        mockSubClient.quit.mock.invocationCallOrder[0],
      );
      expect(mockSubClient.disconnect).not.toHaveBeenCalled();
    });

    it('restores the original unsubscribe methods once shutdown has sent them', async () => {
      const adapter = await attachedAdapter();
      const { unsubscribe, punsubscribe } = mockSubClient;

      await adapter.close(mockServer as never);

      expect(mockSubClient.unsubscribe).toBe(unsubscribe);
      expect(mockSubClient.punsubscribe).toBe(punsubscribe);
    });
  });
});
