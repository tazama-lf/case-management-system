import { Module } from '@nestjs/common';
import { CaseWorkflowService } from './case-workflow.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from '../audit/auditLog.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [PrismaModule, AuditLogModule, LoggerModule],
  providers: [CaseWorkflowService],
  exports: [CaseWorkflowService],
})
export class CaseWorkflowModule {}
