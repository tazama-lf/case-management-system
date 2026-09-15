import { Module, forwardRef } from '@nestjs/common';
import { TaskHistoryService } from './taskHistory.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { TaskHistoryController } from './taskHistory.controller';
import { CaseInvestigatorModule } from '../case-investigator/case-investigator.module';

@Module({
  imports: [PrismaModule, forwardRef(() => CaseInvestigatorModule)],
  providers: [TaskHistoryService],
  exports: [TaskHistoryService],
  controllers: [TaskHistoryController],
})
export class TaskHistoryModule {}
