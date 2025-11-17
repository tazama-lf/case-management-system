import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkQueueService } from './work-queue.service';
import { WorkQueueController } from './work-queue.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../audit/auditLog.module';
import { FlowableModule } from '../flowable/flowable.module';
import { RuleEngineService } from './rule-engine.service';
import { WorkQueueGateway } from './work-queue.gateway';
import { SlaMonitoringService } from './sla-monitoring.service';

@Module({
  imports: [PrismaModule, AuthModule, AuditLogModule, forwardRef(() => FlowableModule), ConfigModule],
  providers: [WorkQueueService, RuleEngineService, WorkQueueGateway, SlaMonitoringService],
  exports: [WorkQueueService, RuleEngineService, SlaMonitoringService],
  controllers: [WorkQueueController],
})
export class WorkQueueModule {}
