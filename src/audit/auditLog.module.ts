import { Module } from '@nestjs/common';
import { AuditLogService } from './auditLog.service';
import { PrismaModule } from 'prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [PrismaModule],
  providers: [AuditLogService],
  controllers: [],
  exports: [AuditLogService],
})
export class AuditLogModule {}
