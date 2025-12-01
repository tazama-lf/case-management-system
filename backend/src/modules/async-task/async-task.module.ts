import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AsyncTaskService } from './async-task.service';
import { EmailWorkerService } from './email-worker.service';
import { AsyncTaskController } from './async-task.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  controllers: [AsyncTaskController],
  providers: [AsyncTaskService, EmailWorkerService],
  exports: [AsyncTaskService],
})
export class AsyncTaskModule {}
