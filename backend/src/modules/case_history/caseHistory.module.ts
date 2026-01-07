import { Module } from '@nestjs/common';
import { CaseHistoryService } from './caseHistory.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { LoggerModule } from 'src/logger/logger.module';
import { CaseHistoryController } from './caseHistory.controller';

@Module({
  imports: [PrismaModule, LoggerModule],
  providers: [CaseHistoryService],
  exports: [CaseHistoryService],
  controllers: [CaseHistoryController]
})
export class CaseHistoryModule { }
