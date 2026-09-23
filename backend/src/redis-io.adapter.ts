import { Logger } from '@nestjs/common';
import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type Redis from 'ioredis';
import { setTimeout as delay } from 'node:timers/promises';
import type { Server, ServerOptions } from 'socket.io';
import { RedisService } from './modules/shared/redis.service';

/**
 * Makes Socket.IO broadcasts (e.g. CaseEventsGateway's "case:changed" pings) reach clients on
 * ANY backend instance, not just the one that received the triggering event.
 *
 * Must be installed via app.useWebSocketAdapter() BEFORE app.init()/app.listen() - Nest binds
 * gateways to whatever adapter is current during init and won't rebind them (see main.ts). That
 * means createIOServer() runs before RedisService.onModuleInit, so getClient() can throw, not
 * just return null - client acquisition is polled for a bounded window instead of read once, and
 * falls back to the in-process adapter if Redis never becomes reachable.
 *
 * Callers MUST await waitUntilReady() before accepting real connections (see main.ts):
 * Socket.IO's Server#adapter() rebuilds each namespace's adapter from scratch rather than
 * migrating existing room memberships, so a client that joins a room before the swap completes
 * would silently stop receiving broadcasts even though it stays connected.
 */
export class RedisIoAdapter extends IoAdapter {
  private static readonly logger = new Logger(RedisIoAdapter.name);
  private readonly attachPromises: Array<Promise<void>> = [];
  // Duplicated from RedisService's client - RedisService doesn't know about these, so they'd
  // otherwise leak (and eventually surface as an unhandled "Connection is closed" rejection).
  private readonly subClients: Redis[] = [];

  constructor(
    private readonly app: INestApplicationContext,
    private readonly readyTimeoutMs = 10_000,
    private readonly pollIntervalMs = 100,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, options);
    this.attachPromises.push(this.attachRedisAdapter(server));
    return server;
  }

  // Resolves once every attach attempt has succeeded or fallen back. See the class doc.
  async waitUntilReady(): Promise<void> {
    await Promise.all(this.attachPromises);
  }

  async close(server: Server): Promise<void> {
    // super.close() awaits each namespace's adapter.close(), which gracefully unsubscribes the
    // sub client - must happen before we quit it ourselves, or the unsubscribe queues on an
    // already-dead connection and never resolves.
    await super.close(server);
    await Promise.all(
      this.subClients.map(async (client) => {
        await client.quit().catch(() => {
          client.disconnect();
        });
      }),
    );
  }

  private async attachRedisAdapter(server: Server): Promise<void> {
    const redisService = this.app.get(RedisService);
    const pubClient = await this.waitForRedisClient(redisService);
    if (!pubClient) {
      RedisIoAdapter.logger.warn('Redis is unavailable - WebSocket broadcasts will only reach clients on this instance');
      return;
    }

    let subClient: Redis | undefined;
    try {
      subClient = pubClient.duplicate();
      subClient.on('error', (error: Error) => {
        RedisIoAdapter.logger.error(`WebSocket Redis (sub) client error: ${error.message}`);
      });
      await subClient.connect();
      this.subClients.push(subClient);

      server.adapter(createAdapter(pubClient, subClient));
      RedisIoAdapter.logger.log('Socket.IO Redis adapter attached - broadcasts now span all backend instances');
    } catch (error) {
      // Only tracked in this.subClients once connected - an untracked client that failed to
      // connect would otherwise sit there retrying via its retryStrategy and logging on every
      // attempt until shutdown, even though the fallback path below never uses it.
      subClient?.disconnect();
      RedisIoAdapter.logger.warn(
        `Failed to set up the WebSocket Redis adapter - live case updates will only reach clients on this instance: ${(error as Error).message}`,
      );
    }
  }

  // getClient() can throw before RedisService finishes connecting (see class doc); retries on
  // both that throw and a `null` result, up to readyTimeoutMs.
  private async waitForRedisClient(redisService: RedisService): Promise<Redis | null> {
    const deadline = Date.now() + this.readyTimeoutMs;
    for (;;) {
      try {
        const client = redisService.getClient();
        if (client) return client;
      } catch {
        // RedisService hasn't finished connecting yet - fall through to retry below.
      }
      if (Date.now() >= deadline) return null;
      // eslint-disable-next-line no-await-in-loop -- intentional sequential retry
      await delay(this.pollIntervalMs);
    }
  }
}
