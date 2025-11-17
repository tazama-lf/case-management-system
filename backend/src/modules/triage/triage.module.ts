import { Module } from '@nestjs/common';
import { TriageService } from './triage.service';
import { TriageController } from './triage.controller';
import { AuditLogService } from '../audit/auditLog.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { LoggerModule } from '../../logger/logger.module';
import { TaskModule } from '../task/task.module';
import { CommentModule } from '../comment/comment.module';
import { CaseCreationModule } from '../case-creation/case-creation.module';
import { FeatureExtractionModule } from 'src/modules/feature-extraction/feature-extraction.module';
import { RepositoryModule } from '../repository/repository.module';

@Module({
  imports: [PrismaModule, RepositoryModule, LoggerModule, CaseCreationModule, TaskModule, CommentModule, FeatureExtractionModule],
  controllers: [TriageController],
  providers: [TriageService, AuditLogService],
  exports: [TriageService],
})
export class TriageModule {}
