import { Module } from '@nestjs/common';
import { AuditLogService } from './auditLog.service';
import { AuditLogController } from './auditLog.controller';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AuditLogService],
  controllers: [AuditLogController],
  exports: [AuditLogService],
})
export class AuditLogModule {}
