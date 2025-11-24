import { Module } from '@nestjs/common';
import { WorkqueueService } from './workqueue.service';
import { WorkqueueController } from './workqueue.controller';
import { FlowableModule } from '../flowable/flowable.module';
import { LoggerModule } from 'src/logger/logger.module';

@Module({
  imports: [FlowableModule, LoggerModule],
  providers: [WorkqueueService],
  controllers: [WorkqueueController],
  exports: [WorkqueueService],
})
export class WorkqueueModule {}
