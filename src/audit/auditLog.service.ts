/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { validate as isUuid } from 'uuid';
=======
import { PrismaService } from '../prisma.service';
>>>>>>> 9e1ce67 (feat: audit log)
=======
import { PrismaService } from 'prisma/prisma.service';
<<<<<<< HEAD
>>>>>>> fd5a237 (feat:auth)
=======
import { v4 as uuidv4 } from 'uuid';
import { validate as isUuid } from 'uuid';

>>>>>>> ea2f4e8 (feat:auth)

=======
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { validate as isUuid } from 'uuid';

>>>>>>> ac7173e (feat: Test Coverage)
@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async logAction(data: {
<<<<<<< HEAD
<<<<<<< HEAD
    userId?: string;
<<<<<<< HEAD
=======
    userId: string;
<<<<<<< HEAD
>>>>>>> 9e1ce67 (feat: audit log)
=======
=======
    userId?: string;
>>>>>>> ea2f4e8 (feat:auth)
    tenantId: string;
    username?: string;
>>>>>>> fd5a237 (feat:auth)
=======
>>>>>>> a522114 (feat:Authentication & Authorization)
    operation: string;
    entityName: string;
    actionPerformed: string;
    outcome: string;
    performedAt?: Date;
  }) {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    const user_id = data.userId && isUuid(data.userId) ? data.userId : uuidv4();
    return this.prisma.auditLog.create({
      data: {
        user_id,
=======
    return this.prisma.auditLog.create({
      data: {
        user_id: data.userId,
<<<<<<< HEAD
<<<<<<< HEAD
>>>>>>> 9e1ce67 (feat: audit log)
=======
        tenant_id: data.tenantId,
=======
=======
  const user_id = data.userId && isUuid(data.userId) ? data.userId : uuidv4();
    return this.prisma.auditLog.create({
      data: {
        user_id,
>>>>>>> ea2f4e8 (feat:auth)
        tenantId: data.tenantId,
>>>>>>> dd9f997 (feat:auth)
        username: data.username,
>>>>>>> fd5a237 (feat:auth)
=======
    const user_id = data.userId && isUuid(data.userId) ? data.userId : uuidv4();
    return this.prisma.auditLog.create({
      data: {
        user_id,
>>>>>>> a522114 (feat:Authentication & Authorization)
        operation: data.operation,
        entity_name: data.entityName,
        action_performed: data.actionPerformed,
        outcome: data.outcome,
        performed_at: data.performedAt ?? new Date(),
      },
    });
  }
<<<<<<< HEAD
<<<<<<< HEAD

  async logPermissionDenied(user: any, entityName: string, action: string, _details?: any) {
    return this.logAction({
      userId: user?.sub || 'unknown',
=======

  async logPermissionDenied(
    user: any,
    entityName: string,
    action: string,
    _details?: any,
  ) {
    return this.logAction({
      userId: user?.sub || 'unknown',
<<<<<<< HEAD
      tenantId: user?.tenantId || 'unknown',
      username: user?.username,
>>>>>>> fd5a237 (feat:auth)
=======
>>>>>>> a522114 (feat:Authentication & Authorization)
      operation: 'permission_denied',
      entityName,
      actionPerformed: action,
      outcome: 'denied',
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> bb28498 (feat:fixing the conflic merge)
    });
  }

  async getLogs(limit = 50, offset = 0) {
    return this.prisma.auditLog.findMany({
      orderBy: { performed_at: 'desc' },
      take: limit,
      skip: offset,
    });
  }
=======
>>>>>>> 9e1ce67 (feat: audit log)
=======
      details,
    });
  }
<<<<<<< HEAD
>>>>>>> fd5a237 (feat:auth)
=======

  async getLogs(limit = 50, offset = 0) {
    return this.prisma.auditLog.findMany({
      orderBy: { performed_at: 'desc' },
      take: limit,
      skip: offset,
    });
  }
>>>>>>> 80bd0dd (feat:Authentication & Authorization)
}
