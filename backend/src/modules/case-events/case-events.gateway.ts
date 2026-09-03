import { Logger } from '@nestjs/common';
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

// Redis-tracked connection sets are refreshed with this TTL on every join, so a socket that
// never gets a matching disconnect (e.g. the server process is killed) doesn't permanently
// occupy one of that user's connection slots - it just ages out.
const USER_SOCKETS_TTL_SECONDS = 60 * 60;

const userSocketsKey = (userId: string): string => `case-events:user-sockets:${userId}`;

interface CaseChangedPayload {
  caseId: number;
  type: 'created' | 'status-changed';
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
export class CaseEventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private readonly server!: Server;

  private readonly logger = new Logger(CaseEventsGateway.name);

  // Per-instance fallback connection tracking, used only when Redis is unavailable - caps
  // connections on this instance alone in that case, rather than globally across a
  // horizontally-scaled deployment. Best-effort, matching this app's "Redis is optional,
  // degrade gracefully" convention (see RedisService) rather than refusing to run without it.
  private readonly localUserSockets = new Map<string, Set<string>>();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

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

      // client.data is socket.io's own per-connection storage bag, designed to be mutated exactly
      // like this - not a shared/external object.
      // eslint-disable-next-line require-atomic-updates, no-param-reassign -- see comment above
      client.data.userId = user.userId;
      // eslint-disable-next-line require-atomic-updates, no-param-reassign -- see comment above
      client.data.trackedViaRedis = viaRedis;
      void client.join(`tenant:${user.tenantId}`);
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
      const key = userSocketsKey(userId);
      const count = await redisClient.scard(key);
      if (count >= MAX_CONNECTIONS_PER_USER) return { registered: false, viaRedis: true };
      await redisClient.sadd(key, socketId);
      await redisClient.expire(key, USER_SOCKETS_TTL_SECONDS);
      return { registered: true, viaRedis: true };
    }

    const sockets = this.localUserSockets.get(userId) ?? new Set<string>();
    if (sockets.size >= MAX_CONNECTIONS_PER_USER) return { registered: false, viaRedis: false };
    sockets.add(socketId);
    this.localUserSockets.set(userId, sockets);
    return { registered: true, viaRedis: false };
  }

  private async unregisterConnection(userId: string, socketId: string, viaRedis: boolean): Promise<void> {
    if (viaRedis) {
      const redisClient = this.redisService.getClient();
      if (redisClient) {
        await redisClient.srem(userSocketsKey(userId), socketId);
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
