import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { LoggerModule } from '../../logger/logger.module';
import { CommentController } from './comment.controller';
import { RepositoryModule } from '../repository/repository.module';
import { CaseInvestigatorModule } from '../case-investigator/case-investigator.module';

@Module({
  imports: [LoggerModule, RepositoryModule, CaseInvestigatorModule],
  providers: [CommentService],
  exports: [CommentService],
  controllers: [CommentController],
})
export class CommentModule {}
