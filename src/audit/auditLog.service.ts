import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async logAction(data: {
    userId: string;
    tenantId: string;
    username?: string;
    operation: string;
    entityName: string;
    actionPerformed: string;
    outcome: string;
    performedAt?: Date;
    details?: any;
  }) {
    return this.prisma.auditLog.create({
      data: {
        user_id: data.userId,
        tenantId: data.tenantId,
        username: data.username,
        operation: data.operation,
        entity_name: data.entityName,
        action_performed: data.actionPerformed,
        outcome: data.outcome,
        performed_at: data.performedAt ?? new Date(),
        details: data.details,
      },
    });
  }

  async logPermissionDenied(user: any, entityName: string, action: string, details?: any) {
    return this.logAction({
      userId: user?.sub || 'unknown',
      tenantId: user?.tenantId || 'unknown',
      username: user?.username,
      operation: 'permission_denied',
      entityName,
      actionPerformed: action,
      outcome: 'denied',
      details,
    });
  }
}
