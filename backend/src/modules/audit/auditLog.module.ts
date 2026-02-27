import { Global, Module } from '@nestjs/common';
import { AuditLogController } from './auditLog.controller';
import { AuditLogService } from './auditLog.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { createAuditProvider } from '@tazama-lf/audit-lib';
import { AuditInterceptor } from '../../interpectors/audit-log.interceptor';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuditLogController],
  providers: [
    createAuditProvider('case-management-system'),
    AuditLogService,
    AuditInterceptor,
  ],
  exports: [AuditLogService, 'AUDIT_LOGGER', AuditInterceptor],
})
export class AuditLogModule { }
