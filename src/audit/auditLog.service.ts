/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { validate as isUuid } from 'uuid';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async logAction(data: {
    userId?: string;
    operation: string;
    entityName: string;
    actionPerformed: string;
    outcome: string;
    performedAt?: Date;
  }) {
    const user_id = data.userId && isUuid(data.userId) ? data.userId : uuidv4();
    return this.prisma.auditLog.create({
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

  async logPermissionDenied(
    user: any,
    entityName: string,
    action: string,
    _details?: any,
  ) {
    return this.logAction({
      userId: user?.sub || 'unknown',
      operation: 'permission_denied',
      entityName,
      actionPerformed: action,
      outcome: 'denied',
    });
  }

  async getLogs(limit = 50, offset = 0) {
    return this.prisma.auditLog.findMany({
      orderBy: { performed_at: 'desc' },
      take: limit,
      skip: offset,
    });
  }
}
