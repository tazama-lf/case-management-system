import { Module } from '@nestjs/common';
import { FeatureExtractionService } from './feature-extraction.service';
import { LoggerModule } from 'src/logger/logger.module';

@Module({
  imports: [LoggerModule,],
  providers: [FeatureExtractionService],
  exports: [FeatureExtractionService],
})
export class FeatureExtractionModule {}
