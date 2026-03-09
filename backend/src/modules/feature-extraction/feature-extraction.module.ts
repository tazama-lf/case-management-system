import { Module } from '@nestjs/common';
import { FeatureExtractionService } from './feature-extraction.service';
import { LoggerModule } from 'src/logger/logger.module';
import { AuditLogModule } from 'src/modules/audit/auditLog.module';

@Module({
  imports: [LoggerModule, AuditLogModule],
  providers: [FeatureExtractionService],
  exports: [FeatureExtractionService],
})
export class FeatureExtractionModule {}
