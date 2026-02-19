import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { v4 as uuidv4, validate as isUuid } from 'uuid';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async logAction(data: {
    userId?: string;
    operation: string;
    entityName: string;
    actionPerformed: string;
    outcome: string;
    performedAt?: Date;
  }) {
    const user_id = data.userId && isUuid(data.userId) ? data.userId : uuidv4();
    return await this.prisma.auditLog.create({
      data: {
        user_id,
        operation: data.operation,
        entity_name: data.entityName,
        action_performed: data.actionPerformed,
        outcome: data.outcome,
        performed_at: data.performedAt ?? new Date(),
      },
    });
  }

  async logPermissionDenied(user: any, entityName: string, action: string, _details?: any) {
    return await this.logAction({
      userId: user?.sub || 'unknown',
      operation: 'permission_denied',
      entityName,
      actionPerformed: action,
      outcome: 'denied',
    });
  }

  async getLogs(limit = 50, offset = 0) {
    return await this.prisma.auditLog.findMany({
      orderBy: { performed_at: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async getActionHistoryForAlert(alertId: number) {
    return await this.prisma.auditLog.findMany({
      where: {
        operation: 'ALERT_UPDATED',
        action_performed: { contains: `${alertId}` },
        entity_name: 'AlertService',
      },
      orderBy: { performed_at: 'asc' },
    });
  }

  async getActionHistoryForCase(caseId: number) {
    return await this.prisma.auditLog.findMany({
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
