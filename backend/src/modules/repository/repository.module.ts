import { Module, Logger } from '@nestjs/common';
import { AlertRepository } from './alert.repository';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CaseRepository } from './case.repository';
import { TaskRepository } from './task.repository';
import { AsyncTaskRepository } from './async-task.repository';
import { CommentRepository } from './comment.repository';
import { FilterRepository } from './filter.repository';
import { EvidenceRepository } from './evidence.repository';
import { AdminRepository } from './admin.repository';
import { TransactionDataRespository } from './transactionalData.respository';
import { BaseRepository } from './base.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    BaseRepository,
    AlertRepository,
    CaseRepository,
    TaskRepository,
    AsyncTaskRepository,
    CommentRepository,
    EvidenceRepository,
    AdminRepository,
    FilterRepository,
    TransactionDataRespository,
    Logger,
  ],
  exports: [
    BaseRepository,
    AlertRepository,
    CaseRepository,
    TaskRepository,
    AsyncTaskRepository,
    CommentRepository,
    EvidenceRepository,
    AdminRepository,
    FilterRepository,
    TransactionDataRespository,
  ],
})
export class RepositoryModule {}
