import { Module, forwardRef } from '@nestjs/common';
import { CaseHistoryService } from './caseHistory.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CaseHistoryController } from './caseHistory.controller';
import { CaseInvestigatorModule } from '../case-investigator/case-investigator.module';

@Module({
  imports: [PrismaModule, forwardRef(() => CaseInvestigatorModule)],
  providers: [CaseHistoryService],
  exports: [CaseHistoryService],
  controllers: [CaseHistoryController],
})
export class CaseHistoryModule {}
