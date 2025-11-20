import { Module } from '@nestjs/common';
import { AlertRepository } from './alert.repository';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CaseRepository } from './case.repository';
import { TaskRepository } from './task.repository';
import { LoggerModule } from '../../logger/logger.module';

@Module({
  imports: [PrismaModule, LoggerModule],
  providers: [AlertRepository, CaseRepository, TaskRepository],
  exports: [AlertRepository, CaseRepository, TaskRepository],
})
export class RepositoryModule {}
