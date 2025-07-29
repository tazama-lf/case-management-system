import { Module } from '@nestjs/common';
import { AuditLogService } from './auditLog.service';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule,],
  providers: [AuditLogService],
  controllers: [],
  exports: [AuditLogService],
})
export class AuditLogModule {}
