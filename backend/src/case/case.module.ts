import { Module } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from 'src/audit/auditLog.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [PrismaModule, AuditLogModule, LoggerModule],
  providers: [CaseService],
  controllers: [CaseController],
  exports: [CaseService],
})
export class CaseModule {}
