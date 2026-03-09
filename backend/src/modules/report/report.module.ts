import { Module } from '@nestjs/common';
import { ReportsController } from './report.controller';
import { ReportsService } from './report.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuditLogModule } from '../audit/auditLog.module';
import { CaseModule } from '../case/case.module';
import { TaskModule } from '../task/task.module';
import { CouchdbModule } from '../couchdb/couchdb.module';
import { NotificationModule } from '../notification/notification.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { EventLogModule } from '../event_log/eventLog.module';

@Module({
  imports: [PrismaModule, AuditLogModule, CaseModule, TaskModule, CouchdbModule, NotificationModule, EvidenceModule, EventLogModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
