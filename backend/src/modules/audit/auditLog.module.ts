import { Global, Module } from '@nestjs/common';
import { AuditLogController } from './auditLog.controller';
import { AuditLogService } from './auditLog.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { createAuditProvider } from '@tazama-lf/audit-lib';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from '../../interpectors/audit-log.interceptor';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuditLogController],
  providers: [
    createAuditProvider('case-management-system'),
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    AuditLogService,
  ],
  exports: [AuditLogService, 'AUDIT_LOGGER'],
})
export class AuditLogModule { }
