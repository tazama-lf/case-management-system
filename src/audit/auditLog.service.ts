import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async logAction(data: {
    userId: string;
    operation: string;
    entityName: string;
    actionPerformed: string;
    outcome: string;
    performedAt?: Date;
  }) {
    return this.prisma.auditLog.create({
      data: {
        user_id: data.userId,
        operation: data.operation,
        entity_name: data.entityName,
        action_performed: data.actionPerformed,
        outcome: data.outcome,
        performed_at: data.performedAt ?? new Date(),
      },
    });
  }
}
