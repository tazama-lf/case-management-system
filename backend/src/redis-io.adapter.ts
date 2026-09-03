import { Logger } from '@nestjs/common';
import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type Redis from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Makes Socket.IO broadcasts (e.g. CaseEventsGateway's "case:changed" pings) reach clients
 * connected to ANY backend instance, not just the one that received the triggering event.
 * Without this, a horizontally-scaled deployment would only deliver live updates to whichever
 * pod a given client happens to be connected to - broadcasts wouldn't cross instances.
 *
 * connectToRedis() must be called (and must succeed) before this adapter is handed to
 * app.useWebSocketAdapter(); callers should fall back to the plain IoAdapter if Redis isn't
 * reachable, matching this app's existing "Redis is optional, degrade gracefully" convention
 * (see RedisService) - a single-instance deployment keeps working exactly as before either way.
 */
export class RedisIoAdapter extends IoAdapter {
  private static readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplicationContext,
    private readonly pubClient: Redis,
    private readonly subClient: Redis,
  ) {
    super(app);
  }

  connectToRedis(): void {
    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
      RedisIoAdapter.logger.log('Socket.IO Redis adapter attached - broadcasts now span all backend instances');
    }
    return server;
  }
}
