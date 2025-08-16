import { Module } from '@nestjs/common';
import { TriageService } from './triage.service';
import { TriageController } from './triage.controller';
import { AuditLogService } from '../audit/auditLog.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoggerService } from '@tazama-lf/frms-coe-lib';

@Module({
  imports: [PrismaModule],
  controllers: [TriageController],
  providers: [TriageService, AuditLogService, LoggerService],
  exports: [TriageService],
})
export class TriageModule {}
