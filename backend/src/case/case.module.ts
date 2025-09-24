import { Module, forwardRef } from '@nestjs/common';
import { CaseService } from './case.service';
import { CaseController } from './case.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogModule } from 'src/audit/auditLog.module';
import { LoggerModule } from '../logger/logger.module';
import { FlowableModule } from 'src/flowable/flowable.module';

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    LoggerModule,
    forwardRef(() => FlowableModule), // Use forwardRef here too
  ],
  providers: [CaseService],
  exports: [CaseService],
  controllers: [CaseController],
})
export class CaseModule {}