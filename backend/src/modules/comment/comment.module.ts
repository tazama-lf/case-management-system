import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { LoggerModule } from '../../logger/logger.module';
import { AuditLogModule } from 'src/modules/audit/auditLog.module';
import { CommentController } from './comment.controller';
import { RepositoryModule } from '../repository/repository.module';

@Module({
  imports: [LoggerModule, AuditLogModule, RepositoryModule],
  providers: [CommentService],
  exports: [CommentService],
  controllers: [CommentController],
})
export class CommentModule {}
