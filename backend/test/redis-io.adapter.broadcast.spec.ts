import { randomUUID } from 'node:crypto';
import { Module, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';

import { CaseEventsGateway } from '../src/modules/case-events/case-events.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../src/modules/shared/redis.service';
import { RedisIoAdapter } from '../src/redis-io.adapter';

// Real JWTs aren't the point of this test - only that the gateway's own auth check passes so a
// client can join the tenant room and observe the broadcast.
jest.mock('../src/guards/tazama-token-validator', () => ({
  validateTazamaToken: jest.fn(),
}));
const { validateTazamaToken } = require('../src/guards/tazama-token-validator') as { validateTazamaToken: jest.Mock };

// Unique per test run: CaseEventsGateway tracks each user's open sockets in Redis under a key
// keyed by userId with a 1hr TTL (case-events.gateway.ts), shared with the same real Redis
// instance across runs. A fixed mock userId would let a socket count from one run (especially
// one that crashed/was killed before it could clean up) silently cap out a later run.
const TEST_USER_ID = `redis-io-adapter-broadcast-test-${randomUUID()}`;
const TEST_TENANT_ID = 'tenant-redis-io-adapter-broadcast-test';
validateTazamaToken.mockReturnValue({ userId: TEST_USER_ID, tenantId: TEST_TENANT_ID, actorRole: 'CMS_INVESTIGATOR' });

const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 16379); // matches docker-compose-infra.yml's valkey mapping
const CONNECT_TIMEOUT_MS = 2000;

@Injectable()
class TestConfigService {
  get<T>(key: string, defaultValue?: T): T {
    const values: Record<string, unknown> = { REDIS_HOST, REDIS_PORT };
    return (values[key] as T) ?? (defaultValue as T);
  }
}

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [
    CaseEventsGateway,
    { provide: PrismaService, useValue: { case: { findUnique: jest.fn() } } },
    RedisService,
    { provide: ConfigService, useClass: TestConfigService },
  ],
})
class BroadcastTestModule {}

// Boots one Nest HTTP+WebSocket instance the same way backend/src/main.ts does: install
// RedisIoAdapter before app.init(), then wait for it to actually attach before starting the TCP
// listener, so no client can connect (and join a room) before the swap from the default
// in-process adapter to the Redis one has happened - see redis-io.adapter.ts for why that order
// matters. Returns the port it's actually listening on.
async function bootPod(): Promise<{ app: INestApplication; port: number }> {
  const app = await NestFactory.create(BroadcastTestModule, { logger: false });
  const redisIoAdapter = new RedisIoAdapter(app);
  app.useWebSocketAdapter(redisIoAdapter);
  await app.init();
  await redisIoAdapter.waitUntilReady();
  await app.listen(0);
  const address = app.getHttpServer().address();
  return { app, port: typeof address === 'string' ? 0 : address.port };
}

async function isRedisReachable(): Promise<boolean> {
  const Redis = (await import('ioredis')).default;
  const client = new Redis({ host: REDIS_HOST, port: REDIS_PORT, lazyConnect: true, connectTimeout: CONNECT_TIMEOUT_MS });
  try {
    await client.connect();
    await client.ping();
    return true;
  } catch {
    return false;
  } finally {
    client.disconnect();
  }
}

// Resolves on the gateway's 'ready' signal, not on 'connect' - 'connect' fires as soon as the
// transport handshake completes, independent of handleConnection's async tenant-room join
// (case-events.gateway.ts). Resolving on 'connect' would let the test emit a broadcast before
// the client is actually in its room, which can time out instead of failing clearly.
function connectClient(port: number): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const client = ioClient(`http://localhost:${port}`, {
      auth: { token: 'valid-token' },
      timeout: CONNECT_TIMEOUT_MS,
    });
    client.once('ready', () => resolve(client));
    client.once('connect_error', reject);
    // The gateway rejects at the application level (bad/limited auth) rather than at the
    // transport level, so a plain 'connect_error' listener alone won't catch that case.
    client.once('auth_failed', () => reject(new Error('server rejected connection: auth_failed')));
    client.once('connection_limit_exceeded', () => reject(new Error('server rejected connection: connection_limit_exceeded')));
  });
}

describe('RedisIoAdapter cross-instance broadcast', () => {
  let redisAvailable = false;
  let podA: { app: INestApplication; port: number };
  let podB: { app: INestApplication; port: number };

  beforeAll(async () => {
    redisAvailable = await isRedisReachable();
    if (!redisAvailable) {
      // eslint-disable-next-line no-console -- deliberate operator-facing message, not app logging
      console.warn(
        `Skipping RedisIoAdapter broadcast integration test - no Redis reachable at ${REDIS_HOST}:${REDIS_PORT}. ` +
          'Start one with `docker compose -f docker-compose-infra.yml up -d valkey` to run it.',
      );
      return;
    }
    [podA, podB] = await Promise.all([bootPod(), bootPod()]);
  });

  afterAll(async () => {
    await podA?.app.close();
    await podB?.app.close();
  });

  it('delivers a case:changed broadcast from pod A to a client connected only to pod B', async () => {
    if (!redisAvailable) return;

    const clientOnPodB = await connectClient(podB.port);
    try {
      const received = new Promise((resolve) => clientOnPodB.once('case:changed', resolve));

      podA.app.get(EventEmitter2).emit('case.created', { caseId: 42, tenantId: TEST_TENANT_ID });

      await expect(received).resolves.toEqual({ caseId: 42, type: 'created' });
    } finally {
      clientOnPodB.disconnect();
    }
  }, 10000);
});
