import { Module } from '@nestjs/common';
import { AlertRepository } from './alert.repository';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CaseRepository } from './case.repository';
import { TaskRepository } from './task.repository';
import { AsyncTaskRepository } from './async-task.repository';
import { CommentRepository } from './comment.repository';
import { EvidenceRepository } from './evidence.repository';

@Module({
  imports: [PrismaModule],
  providers: [AlertRepository, CaseRepository, TaskRepository, AsyncTaskRepository, CommentRepository, EvidenceRepository],
  exports: [AlertRepository, CaseRepository, TaskRepository, AsyncTaskRepository, CommentRepository, EvidenceRepository],
})
export class RepositoryModule { }
