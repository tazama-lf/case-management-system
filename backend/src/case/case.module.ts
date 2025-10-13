import { Module, forwardRef } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from 'src/audit/auditLog.module';
import { LoggerModule } from '../logger/logger.module';
import { TaskModule } from 'src/task/task.module';
import { TriageModule } from 'src/triage/triage.module';
import {CommentModule} from "../comment/comment.module";

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    LoggerModule,
    forwardRef(() => TriageModule),
    TaskModule,
    CommentModule
  ],
  providers: [CaseService],
  exports: [CaseService],
  controllers: [CaseController],
})
export class CaseModule {}