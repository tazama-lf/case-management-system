import { Module } from '@nestjs/common';
import { TazamaDwhService } from './tazama-dwh.service';
import { TazamaDWHController } from './tazama-dwh.controller';
import { PrismaDWHService } from '../../../prismaDWH/prismaDWH.service';
import { AuditLogModule } from '../audit/auditLog.module';
import { LoggerModule } from '../../logger/logger.module';

@Module({
  imports: [AuditLogModule, LoggerModule],
  providers: [TazamaDwhService, PrismaDWHService],
  controllers: [TazamaDWHController],
})
export class TazamaDwhModule {}
