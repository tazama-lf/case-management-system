import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from 'src/audit/auditLog.module';
import { LoggerModule } from '../logger/logger.module';
import { FlowableModule } from '../flowable/flowable.module';

@Module({
  imports: [ConfigModule, PrismaModule, AuditLogModule, LoggerModule, FlowableModule],
  providers: [CaseService],
  controllers: [CaseController],
  exports: [CaseService],
})
export class CaseModule {}
