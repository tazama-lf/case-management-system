import { Module } from '@nestjs/common';
import { CaseHistoryService } from './caseHistory.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CaseHistoryController } from './caseHistory.controller';

@Module({
  imports: [PrismaModule],
  providers: [CaseHistoryService],
  exports: [CaseHistoryService],
  controllers: [CaseHistoryController],
})
export class CaseHistoryModule {}
