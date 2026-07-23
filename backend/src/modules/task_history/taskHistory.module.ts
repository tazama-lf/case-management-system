import { Module } from '@nestjs/common';
import { TaskHistoryService } from './taskHistory.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { TaskHistoryController } from './taskHistory.controller';

@Module({
  imports: [PrismaModule],
  providers: [TaskHistoryService],
  exports: [TaskHistoryService],
  controllers: [TaskHistoryController],
})
export class TaskHistoryModule {}
