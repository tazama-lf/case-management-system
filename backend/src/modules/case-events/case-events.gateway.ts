import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { PrismaService } from '../../../prisma/prisma.service';
import { validateTazamaToken } from '../../guards/tazama-token-validator';

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
export class CaseEventsGateway implements OnGatewayConnection {
  @WebSocketServer() private readonly server!: Server;

  private readonly logger = new Logger(CaseEventsGateway.name);

  constructor(private readonly prismaService: PrismaService) {}

  handleConnection(client: Socket): void {
    try {
      const token = client.handshake.auth.token as string | undefined;
      if (!token) {
        throw new Error('No token provided');
      }
      // No specific claims required - any authenticated CMS user may subscribe to their
      // tenant's "case changed" pings; visibility of the actual case data is still enforced
      // by the REST endpoint the client re-fetches from.
      const user = validateTazamaToken(token, [], []);
      void client.join(`tenant:${user.tenantId}`);
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`WebSocket auth failed, disconnecting client: ${err.message}`);
      client.disconnect(true);
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
