import { Module } from '@nestjs/common';
import { CaseCreationService } from './case-creation.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuditLogModule } from '../audit/auditLog.module';
import { LoggerModule } from '../../logger/logger.module';

@Module({
  imports: [PrismaModule, AuditLogModule, LoggerModule],
  providers: [CaseCreationService],
  exports: [CaseCreationService],
})
export class CaseCreationModule {}
