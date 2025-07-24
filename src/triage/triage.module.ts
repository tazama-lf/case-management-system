import { Module } from '@nestjs/common';
<<<<<<< HEAD
import { TriageService } from './triage.service';
import { TriageController } from './triage.controller';
import { AuditLogService } from '../audit/auditLog.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TriageController],
  providers: [TriageService, AuditLogService],
=======
import { TriageController } from './triage.controller';
import { TriageService } from './triage.service';

@Module({
  controllers: [TriageController],
  providers: [TriageService],
>>>>>>> 875cecd (feat(core): init NestJS with triage mock API)
})
export class TriageModule {}
