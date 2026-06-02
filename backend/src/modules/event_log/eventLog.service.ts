import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { v4 as uuidv4, validate as isUuid } from 'uuid';
import { EventLog } from '@prisma/client-cms';

@Injectable()
export class EventLogService {
  constructor(private readonly prisma: PrismaService) {}

  async logEventAction(data: {
    userId?: string;
    tenantId: string;
    operation: string;
    entityName: string;
    actionPerformed: string;
    outcome: string;
    performedAt?: Date;
  }): Promise<EventLog> {
    if (!data.tenantId) {
      throw new Error('Missing tenantId in event log write');
    }
    const userId = data.userId && isUuid(data.userId) ? data.userId : uuidv4();
    const { tenantId } = data;
    return await this.prisma.eventLog.create({
      data: {
        user_id: userId,
        tenant_id: tenantId,
        operation: data.operation,
        entity_name: data.entityName,
        action_performed: data.actionPerformed,
        outcome: data.outcome,
        performed_at: data.performedAt ?? new Date(),
      },
    });
  }

  async logPermissionDenied(user: any, entityName: string, action: string, _details?: any): Promise<EventLog> {
    const tenantId = user?.tenant_id;
    if (!tenantId) {
      throw new Error('Missing tenantId in permission denied event');
    }
    return await this.logEventAction({
      userId: user?.sub ?? 'unknown',
      tenantId,
      operation: 'permission_denied',
      entityName,
      actionPerformed: action,
      outcome: 'denied',
    });
  }

  async getLogs(limit = 50, offset = 0): Promise<EventLog[]> {
    return await this.prisma.eventLog.findMany({
      orderBy: { performed_at: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async getActionHistoryForAlert(alertId: number): Promise<EventLog[]> {
    return await this.prisma.eventLog.findMany({
      where: {
        operation: 'ALERT_UPDATED',
        action_performed: { startsWith: `${alertId} -` },
        entity_name: 'AlertService',
      },
      orderBy: { performed_at: 'desc' },
    });
  }

  async getActionHistoryForCase(caseId: number): Promise<EventLog[]> {
    return await this.prisma.eventLog.findMany({
      where: {
        OR: [
          { action_performed: { contains: caseId.toString() } },
          { action_performed: { contains: `case ${caseId}` } },
          { action_performed: { contains: `Case ${caseId}` } },
        ],
        entity_name: { in: ['Alert', 'Case'] },
      },
      orderBy: { performed_at: 'asc' },
    });
  }
}
