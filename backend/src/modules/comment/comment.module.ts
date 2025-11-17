import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { LoggerModule } from '../../logger/logger.module';
import { AuditLogModule } from 'src/modules/audit/auditLog.module';
import { CommentController } from './comment.controller';

@Module({
  imports: [PrismaModule, LoggerModule, AuditLogModule],
  providers: [CommentService],
  exports: [CommentService],
  controllers: [CommentController],
})
export class CommentModule {}
