import { Module } from '@nestjs/common';
import { ReportsController } from './report.controller';
import { ReportsService } from './report.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuditLogModule } from '../audit/auditLog.module';
import { CaseModule } from '../case/case.module';
import { TaskModule } from '../task/task.module';

@Module({
  imports: [PrismaModule, AuditLogModule, CaseModule, TaskModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
