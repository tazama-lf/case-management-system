import { Module } from '@nestjs/common';
import { AlertService } from './alert.service';
import { LoggerModule } from 'src/logger/logger.module';
import { ConfigModule } from '@nestjs/config';
import { AlertRepository } from '../repository/alert.repository';
import { RepositoryModule } from '../repository/repository.module';

@Module({
  imports: [LoggerModule, ConfigModule, RepositoryModule],
  providers: [AlertService, AlertRepository],
  exports: [AlertService, AlertRepository],
})
export class AlertModule {}
