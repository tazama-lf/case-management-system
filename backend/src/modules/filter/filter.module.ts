import { Module } from '@nestjs/common';
import { FilterService } from './filter.service';
import { LoggerModule } from '../../logger/logger.module';
import { AuditLogModule } from 'src/modules/audit/auditLog.module';
import { FilterController } from './filter.controller';
import { RepositoryModule } from '../repository/repository.module';

@Module({
  imports: [LoggerModule, AuditLogModule, RepositoryModule],
  providers: [FilterService],
  exports: [FilterService],
  controllers: [FilterController],
})
export class FilterModule {}
