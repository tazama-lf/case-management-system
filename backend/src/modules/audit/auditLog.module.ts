import { Module } from '@nestjs/common';
import { AuditLogController } from './auditLog.controller';
import { AuditLogService } from './auditLog.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { createAuditProvider } from '@tazama-lf/audit-lib';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogDecoratorInterceptor } from './decorators/audit-log.interceptor';

@Module({
  controllers: [AuditLogController],
  providers: [
    AuditLogService,
    createAuditProvider('case-management-system'),
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogDecoratorInterceptor,
    },
  ],
  exports: [AuditLogService],
})
export class AuditLogModule {}
