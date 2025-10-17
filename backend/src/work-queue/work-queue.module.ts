import { Module } from '@nestjs/common';
import { WorkQueueController } from '../work-queue/work-queue.controller';
import { WorkQueueService } from './work-queue.service';
import { AssignmentRuleService } from './assignment-rule.service';
import { RuleEngineService } from './rule-engine.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WorkQueueController],
  providers: [WorkQueueService, AssignmentRuleService, RuleEngineService],
  exports: [WorkQueueService, AssignmentRuleService, RuleEngineService],
})
export class WorkQueueModule {}
