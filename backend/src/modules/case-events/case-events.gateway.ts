import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../shared/redis.service';
import { validateTazamaToken } from '../../guards/tazama-token-validator';
import { TazamaClaims } from '../../decorators/auth.decorator';

// Only users who could actually see the Cases Dashboard may subscribe to live updates about it.
// Kept as its own constant so the two stay in sync deliberately, not by accident of import order.
const SUBSCRIBER_CLAIMS = [TazamaClaims.CMS_INVESTIGATOR, TazamaClaims.CMS_SUPERVISOR, TazamaClaims.CMS_COMPLIANCE_OFFICER];

// Caps how many simultaneous sockets one authenticated user may hold open (e.g. multiple
// browser tabs is fine; hundreds of connections from a single token is not). Generous enough
// not to bother a real user with several tabs open.
const MAX_CONNECTIONS_PER_USER = 5;

// A Redis-tracked slot is only trusted while its socket keeps heart-beating. Every live socket
// re-stamps its slot on this interval; a slot that has not been re-stamped for
// USER_SOCKETS_STALE_AFTER_MS belongs to a socket that is gone (server restart, crash, or a
// disconnect that raced its own registration) and is swept the next time that user connects.
// Without this a leaked slot lived as long as the user had any other socket open, and a handful
// of them locked the user out of live updates entirely.
const USER_SOCKETS_HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
const USER_SOCKETS_STALE_AFTER_MS = USER_SOCKETS_HEARTBEAT_INTERVAL_MS * 3;

// Whole-key expiry, refreshed on every register and heartbeat, so the key of a user with no live
// sockets at all disappears on its own.
const USER_SOCKETS_TTL_SECONDS = 60 * 60;

// v2: a sorted set of socketId -> last heartbeat (ms). The old key was a plain set that could not
// age members out; bumping the name also leaves any leaked old sets behind to expire on their own.
const userSocketsKey = (userId: string): string => `case-events:user-sockets:v2:${userId}`;

// Registers a socket under the per-user sorted set as one atomic step on the Redis server, so two
// concurrent connections for the same user can't both read a count under the limit and both add
// themselves before either write lands (EVAL runs the whole script as a single command with no
// other client's commands interleaved). First sweeps members whose heartbeat is older than the
// stale cutoff, so slots leaked by dead sockets don't count against the limit. Returns 1 if the
// socket is now registered (added, or already present), 0 if the limit was reached.
const REGISTER_CONNECTION_SCRIPT = `
local key = KEYS[1]
local member = ARGV[1]
local limit = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
local staleBefore = tonumber(ARGV[5])
redis.call('ZREMRANGEBYSCORE', key, '-inf', staleBefore)
if redis.call('ZSCORE', key, member) then
  redis.call('ZADD', key, now, member)
  redis.call('EXPIRE', key, ttl)
  return 1
end
if redis.call('ZCARD', key) >= limit then
  return 0
end
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, ttl)
return 1
`;

interface CaseChangedPayload {
  caseId: number;
  type: 'created' | 'status-changed' | 'access-changed';
}

/**
 * Pushes a lightweight "something changed" signal to every connected client belonging to a
 * tenant whenever a case is created or its status changes, so the Cases Dashboard can refresh
 * itself without the user manually reloading the page.
 *
 * Deliberately does NOT push case data over the socket - clients always re-fetch via the
 * existing, already-authorized GET /api/v1/cases/all endpoint, so this gateway never needs to
 * duplicate the role-based case-visibility rules that endpoint enforces (case.controller.ts).
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class CaseEventsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() private readonly server!: Server;

  private readonly logger = new Logger(CaseEventsGateway.name);

  // Per-instance fallback connection tracking, used only when Redis is unavailable.
  private readonly localUserSockets = new Map<string, Set<string>>();

  // Every socket currently registered via Redis, so the refresh interval knows which per-user
  // keys still have a live socket and need their TTL kept alive.
  private readonly redisTrackedSockets = new Map<string, Set<string>>();

  private refreshIntervalHandle: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit(): void {
    this.refreshIntervalHandle = setInterval(() => {
      void this.heartbeatTrackedSockets();
    }, USER_SOCKETS_HEARTBEAT_INTERVAL_MS);
    // Don't let this timer alone keep the Node process alive.
    this.refreshIntervalHandle.unref();
  }

  onModuleDestroy(): void {
    if (this.refreshIntervalHandle) {
      clearInterval(this.refreshIntervalHandle);
    }
  }

  // Re-stamps the heartbeat of every socket this process still has open, so a live socket's slot
  // never goes stale, and keeps each user's key alive. Slots of sockets that are gone are simply not
  // re-stamped and age out (see USER_SOCKETS_STALE_AFTER_MS).
  private async heartbeatTrackedSockets(): Promise<void> {
    const redisClient = this.redisService.getClient();
    if (!redisClient) return;

    const now = Date.now();
    // Fired off together rather than awaited one at a time in the loop - these are independent
    // per-user refreshes, so there's no reason to let one wait on the previous one's round trip.
    await Promise.all(
      Array.from(this.redisTrackedSockets.entries())
        .filter(([, socketIds]) => socketIds.size > 0)
        .map(async ([userId, socketIds]) => {
          try {
            const key = userSocketsKey(userId);
            await Promise.all(Array.from(socketIds).map(async (socketId) => await redisClient.zadd(key, now, socketId)));
            await redisClient.expire(key, USER_SOCKETS_TTL_SECONDS);
          } catch (error) {
            this.logger.warn(`Failed to heartbeat socket slots for user ${userId}: ${(error as Error).message}`);
          }
        }),
    );
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth.token as string | undefined;
      if (!token) {
        throw new Error('No token provided');
      }
      // Only users who could actually load the Cases Dashboard may subscribe to its live
      // updates - visibility of the actual case data is still separately enforced by the
      // REST endpoint the client re-fetches from.
      const user = validateTazamaToken(token, [], SUBSCRIBER_CLAIMS);

      const { registered, viaRedis } = await this.registerConnection(user.userId, client.id);
      if (!registered) {
        this.logger.warn(`Connection limit reached for user ${user.userId}, rejecting new socket`);
        client.emit('connection_limit_exceeded');
        client.disconnect(true);
        return;
      }

      // The client may have gone away while the registration above was awaiting Redis. Its
      // disconnect event already fired with no userId recorded on the socket yet, so
      // handleDisconnect found nothing to clean up - release the slot here or it leaks until it goes stale.
      if (client.disconnected) {
        await this.unregisterConnection(user.userId, client.id, viaRedis);
        return;
      }

      // client.data is socket.io's own per-connection storage bag, designed to be mutated exactly
      // like this - not a shared/external object.
      // eslint-disable-next-line no-param-reassign -- see comment above
      client.data.userId = user.userId;
      // eslint-disable-next-line no-param-reassign -- see comment above
      client.data.trackedViaRedis = viaRedis;
      // Awaited (rather than fire-and-forget) so 'ready' below is a trustworthy signal that the
      // room join has actually completed - the client's own 'connect' event fires as soon as the
      // transport handshake completes, independent of this handler, so it can't be used for that.
      await client.join(`tenant:${user.tenantId}`);
      client.emit('ready');
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`WebSocket auth failed, disconnecting client: ${err.message}`);
      // Tell the client *why* before closing, so it can stop trying with a token that will
      // never become valid (e.g. expired/logged out) instead of just seeing an ordinary
      // disconnect and reconnecting with the same bad token.
      client.emit('auth_failed');
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId) return; // never successfully authenticated - nothing was registered for it
    // Clean up through the same store this connection was registered in, even if Redis's
    // availability has changed since connect time - otherwise a disconnect could target the
    // wrong store and leave a stale entry (Redis's TTL still bounds that case; see
    // USER_SOCKETS_TTL_SECONDS).
    const viaRedis = Boolean(client.data.trackedViaRedis);
    await this.unregisterConnection(userId, client.id, viaRedis);
  }

  private async registerConnection(userId: string, socketId: string): Promise<{ registered: boolean; viaRedis: boolean }> {
    const redisClient = this.redisService.getClient();
    if (redisClient) {
      try {
        const key = userSocketsKey(userId);
        const now = Date.now();
        const registered = await redisClient.eval(
          REGISTER_CONNECTION_SCRIPT,
          1,
          key,
          socketId,
          MAX_CONNECTIONS_PER_USER,
          USER_SOCKETS_TTL_SECONDS,
          now,
          now - USER_SOCKETS_STALE_AFTER_MS,
        );
        if (registered === 1) {
          const tracked = this.redisTrackedSockets.get(userId) ?? new Set<string>();
          tracked.add(socketId);
          this.redisTrackedSockets.set(userId, tracked);
        }
        return { registered: registered === 1, viaRedis: true };
      } catch (error) {
        this.logger.warn(`Redis registerConnection failed for user ${userId}, falling back to local tracking: ${(error as Error).message}`);
      }
    }

    const sockets = this.localUserSockets.get(userId) ?? new Set<string>();
    if (sockets.size >= MAX_CONNECTIONS_PER_USER) return { registered: false, viaRedis: false };
    sockets.add(socketId);
    this.localUserSockets.set(userId, sockets);
    return { registered: true, viaRedis: false };
  }

  private async unregisterConnection(userId: string, socketId: string, viaRedis: boolean): Promise<void> {
    if (viaRedis) {
      const tracked = this.redisTrackedSockets.get(userId);
      if (tracked) {
        tracked.delete(socketId);
        if (tracked.size === 0) {
          this.redisTrackedSockets.delete(userId);
        }
      }
      const redisClient = this.redisService.getClient();
      if (redisClient) {
        await redisClient.zrem(userSocketsKey(userId), socketId);
      }
      return;
    }

    const sockets = this.localUserSockets.get(userId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.localUserSockets.delete(userId);
    }
  }

  private broadcast(tenantId: string, payload: CaseChangedPayload): void {
    this.server.to(`tenant:${tenantId}`).emit('case:changed', payload);
  }

  @OnEvent('case.created')
  handleCaseCreatedEvent(payload: { caseId: number; tenantId: string }): void {
    try {
      this.broadcast(payload.tenantId, { caseId: payload.caseId, type: 'created' });
    } catch (error) {
      this.logger.error(`Failed to broadcast case.created: ${(error as Error).message}`);
    }
  }

  // Who may see a case changed (blacklist / revoke / unblock) without its status changing. Clients
  // react exactly as for any other change: re-fetch GET /cases/all, whose visibility rules already
  // drop a blacklisted investigator's case from their queue.
  @OnEvent('case.access-changed')
  handleCaseAccessChangedEvent(payload: { caseId: number; tenantId: string }): void {
    try {
      this.broadcast(payload.tenantId, { caseId: payload.caseId, type: 'access-changed' });
    } catch (error) {
      this.logger.error(`Failed to broadcast case.access-changed: ${(error as Error).message}`);
    }
  }

  // EventEmitterModule.forRoot() runs listeners with async: false (the default - see
  // app.module.ts), so EventEmitter2 does not await or collect promises returned here. Any
  // unhandled rejection inside this handler becomes a process-level unhandled rejection rather
  // than something the emitter can catch, so every branch below must be wrapped in try/catch.
  @OnEvent('case.status-changed')
  async handleCaseStatusChangedEvent(payload: { caseId: number }): Promise<void> {
    try {
      const record = await this.prismaService.case.findUnique({
        where: { case_id: payload.caseId },
        select: { tenant_id: true },
      });
      if (!record) return;
      this.broadcast(record.tenant_id, { caseId: payload.caseId, type: 'status-changed' });
    } catch (error) {
      this.logger.error(`Failed to broadcast case.status-changed: ${(error as Error).message}`);
    }
  }
}
