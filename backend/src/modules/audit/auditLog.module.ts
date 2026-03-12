import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { createAuditProvider } from '@tazama-lf/audit-lib';
import { AuditInterceptor } from '../../interpectors/audit-log.interceptor';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [createAuditProvider('case-management-system'), AuditInterceptor],
  exports: ['AUDIT_LOGGER', AuditInterceptor],
})
export class AuditLogModule {}
