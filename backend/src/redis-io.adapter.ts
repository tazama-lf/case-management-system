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
 * gateways to whatever adapter is current during init and won't rebind them. That
 * means createIOServer() runs before RedisService.onModuleInit, so getClient() can throw, not
 * just return null - client acquisition is polled for a bounded window instead of read once, and
 * falls back to the in-process adapter if Redis never becomes reachable.
 *
 * Callers MUST await waitUntilReady() before accepting real connections:
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
    // super.close() calls each namespace's adapter.close(), which sends (without awaiting) the
    // unsubscribe commands on the sub client - that must happen before we quit it ourselves, or
    // those unsubscribes hit an already-closed connection and reject with nobody handling them.
    // Even in that order, they can still reject (a silent Redis leaves them pending until the
    // force-disconnect below; a down one rejects them from ioredis's offline queue), so they're
    // captured here - interceptCalls() marks each one handled: they're best-effort at shutdown.
    const unsubscribes = this.subClients.map((client) => this.interceptCalls(client, ['unsubscribe', 'punsubscribe']));
    try {
      await super.close(server);
    } finally {
      unsubscribes.forEach(({ restore }) => {
        restore();
      });
    }
    await Promise.all(
      this.subClients.map(async (client) => {
        // quit() can stay pending if Redis keeps the socket open but stops replying, and
        // RedisService sets no commandTimeout - bound it and force-disconnect on expiry.
        await this.awaitWithTimeout(client.quit(), 'Redis subscriber shutdown').catch(() => {
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

    const previousAdapter = server.adapter();
    let subClient: Redis | undefined;
    let installed = false;
    try {
      subClient = pubClient.duplicate();
      subClient.on('error', (error: Error) => {
        RedisIoAdapter.logger.error(`WebSocket Redis (sub) client error: ${error.message}`);
      });
      // ioredis's connectTimeout (default 10s) already bounds connect() on its own, but not every
      // operation below has an equivalent default - a connected-but-silent Redis could otherwise
      // leave one pending forever, and since main.ts awaits waitUntilReady() before app.listen(),
      // that would block the whole app from ever accepting connections. Bounding everything here
      // means none of it depends on ioredis's own (or lack of) per-operation defaults.
      await this.awaitWithTimeout(subClient.connect(), 'Redis subscriber connection');

      // createAdapter()'s constructor calls subscribe()/psubscribe() on subClient synchronously
      // but keeps their promises to itself, so interceptCalls() captures them first - that's the
      // only way to know a subscription actually succeeded (a connected client that happily
      // replies to other commands, e.g. an ACL denying SUBSCRIBE specifically, would otherwise
      // look identical to one that's genuinely subscribed).
      const subscriptions = this.interceptCalls(subClient, ['subscribe', 'psubscribe']);
      try {
        server.adapter(createAdapter(pubClient, subClient));
      } finally {
        subscriptions.restore();
      }
      installed = true;
      await this.awaitWithTimeout(Promise.all(subscriptions.calls), 'Redis subscriber subscription setup');
      this.subClients.push(subClient);
      RedisIoAdapter.logger.log('Socket.IO Redis adapter attached - broadcasts now span all backend instances');
    } catch (error) {
      // If the Redis adapter was already installed above, an untested/broken subscriber leaves
      // it able to publish to other pods (pubClient) but never receive from them (subClient) -
      // worse than the clean single-instance fallback restoring the previous adapter gives us.
      if (installed && previousAdapter) {
        server.adapter(previousAdapter);
      }
      // Only tracked in this.subClients once fully set up - an untracked client that failed
      // partway through would otherwise sit there retrying via its retryStrategy and logging on
      // every attempt until shutdown, even though the fallback path below never uses it.
      subClient?.disconnect();
      RedisIoAdapter.logger.warn(
        `Failed to set up the WebSocket Redis adapter - live case updates will only reach clients on this instance: ${(error as Error).message}`,
      );
    }
  }

  // Wraps the given (un)subscribe methods on a sub client to capture the promises of whatever
  // calls @socket.io/redis-adapter makes to them - it calls them directly and keeps the promises
  // to itself, with no hook of its own. Callers must call restore() once the adapter code that
  // makes those calls has run, so nothing else ends up going through the wrappers.
  private interceptCalls(
    client: Redis,
    methods: ReadonlyArray<'subscribe' | 'psubscribe' | 'unsubscribe' | 'punsubscribe'>,
  ): { calls: Array<Promise<unknown>>; restore: () => void } {
    const calls: Array<Promise<unknown>> = [];
    const originals = methods.map((method) => {
      const original = client[method] as (...args: unknown[]) => unknown;
      // eslint-disable-next-line no-param-reassign -- deliberate, temporary interception; undone by restore()
      client[method] = ((...args: unknown[]) => {
        const result = original.apply(client, args);
        const call = Promise.resolve(result);
        // Marked handled the moment it's captured: at shutdown these can reject (e.g. ioredis
        // flushing its offline queue) while super.close() is still pending, before any caller
        // could attach a handler. Callers awaiting `calls` still see the rejection.
        call.catch(() => undefined);
        calls.push(call);
        return result;
      }) as never;
      return { method, original };
    });

    const restore = (): void => {
      originals.forEach(({ method, original }) => {
        // eslint-disable-next-line no-param-reassign -- restoring the originals captured above
        client[method] = original as never;
      });
    };

    return { calls, restore };
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

  // ioredis doesn't bound every operation by default (see the call sites above), so this gives
  // any of them the same readyTimeoutMs bound the rest of this class already commits to, rather
  // than risking an indefinite hang on a connected-but-unresponsive Redis.
  private async awaitWithTimeout<T>(operation: Promise<T>, operationName: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        operation,
        // eslint-disable-next-line promise/avoid-new -- no existing utility races a promise against a rejecting timeout
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`${operationName} timed out after ${this.readyTimeoutMs}ms`));
          }, this.readyTimeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}
