import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { v4 as uuidv4, validate as isUuid } from 'uuid';
import { AuditLog } from '@prisma/client-cms';
import { IAuditLogInput, IAuditService } from '@tazama-lf/audit-lib';

@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('AUDIT_LOGGER') private readonly logger: IAuditService,
  ) { }

  async logAction(data: IAuditLogInput): Promise<void> {
    try {
      await this.logger.log(data);
    } catch (error) {
      // Log the error but do not throw, to avoid impacting the main operation
      console.error('Failed to log audit action:', error);
    }
  }

  async getLogs(limit = 50, offset = 0): Promise<AuditLog[]> {
    return await this.prisma.auditLog.findMany({
      orderBy: { performed_at: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async getActionHistoryForAlert(alertId: number): Promise<AuditLog[]> {
    return await this.prisma.auditLog.findMany({
      where: {
        operation: 'ALERT_UPDATED',
        action_performed: { contains: `${alertId}` },
        entity_name: 'AlertService',
      },
      orderBy: { performed_at: 'asc' },
    });
  }

  async getActionHistoryForCase(caseId: number): Promise<AuditLog[]> {
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
