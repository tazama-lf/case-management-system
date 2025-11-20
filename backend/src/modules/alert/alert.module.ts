import { Module } from '@nestjs/common';
import { AlertService } from './alert.service';
import { LoggerModule } from 'src/logger/logger.module';
import { ConfigModule } from '@nestjs/config';
import { RepositoryModule } from '../repository/repository.module';
import { CaseModule } from '../case/case.module';
import { AuditLogModule } from '../audit/auditLog.module';

@Module({
  imports: [LoggerModule, AuditLogModule, ConfigModule, RepositoryModule, CaseModule],
  providers: [AlertService],
  exports: [AlertService],
})
export class AlertModule {}
