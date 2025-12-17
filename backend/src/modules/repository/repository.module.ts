import { Module } from '@nestjs/common';
import { AlertRepository } from './alert.repository';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CaseRepository } from './case.repository';
import { TaskRepository } from './task.repository';
import { AsyncTaskRepository } from './async-task.repository';
import { CommentRepository } from './comment.repository';
import { FilterRepository } from './filter.repository';

@Module({
  imports: [PrismaModule],
  providers: [AlertRepository, CaseRepository, TaskRepository, AsyncTaskRepository, CommentRepository, FilterRepository],
  exports: [AlertRepository, CaseRepository, TaskRepository, AsyncTaskRepository, CommentRepository, FilterRepository],
})
export class RepositoryModule { }
