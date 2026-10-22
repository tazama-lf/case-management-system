import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { LoggerModule } from '../../logger/logger.module';
import { LoggingOrchestrationModule } from '../logging-orchestration/logging-orchestration.module';
import { CaseInvestigatorService } from './case-investigator.service';
import { CaseInvestigatorController } from './case-investigator.controller';

// Every other module that needs to know "can this investigator see this case", or that needs to
// react to task assignment for ACL purposes, imports this module and uses
// CaseInvestigatorService rather than querying case_investigators /
// case_investigators_blacklist directly.
@Module({
  imports: [PrismaModule, LoggerModule, LoggingOrchestrationModule],
  providers: [CaseInvestigatorService],
  controllers: [CaseInvestigatorController],
  exports: [CaseInvestigatorService],
})
export class CaseInvestigatorModule {}
