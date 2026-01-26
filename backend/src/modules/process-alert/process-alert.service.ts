import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { IngestAlertDto } from 'src/modules/alert/dto/IngestAlert.dto';
import { TaskService } from '../task/task.service';
import { TriageService } from '../triage/triage.service';
import { CaseStatus } from '@prisma/client-cms';
import { CaseCreationApprovalService } from '../case/services/case-creation-approval.service';
import { AlertService } from '../alert/alert.service';
import { FlowableService } from '../flowable/flowable.service';
import { CANDIDATE_GROUPS } from 'src/constants/case.constants';
import { TaskSyncService } from '../task-sync/task-sync.service';
import { CaseSyncService } from '../case-sync/case-sync.service';

@Injectable()
export class ProcessAlertService {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly configService: ConfigService,
    private readonly triageService: TriageService,
    private readonly taskService: TaskService,
    private readonly caseCreationService: CaseCreationApprovalService,
    private readonly alertService: AlertService,
    private readonly flowableService: FlowableService,
    private readonly taskSyncService: TaskSyncService,
    private readonly caseSyncService: CaseSyncService,
  ) {}

  async processIncomingAlert(req: IngestAlertDto, source: string, userId: string, tenantId: string) {
    this.loggerService.log(`Start - Processing Incoming Alert`, ProcessAlertService.name);
    const submitAlertDto: IngestAlertDto = {
      message: req.message,
      report: req.report,
      transaction: req.transaction,
      networkMap: req.networkMap,
    };

    const alert = await this.alertService.handleAlertOrNALT(submitAlertDto, userId, tenantId, source);
    if (submitAlertDto.report.status === 'NALT' || !alert.case_id) return;

    const triageType = this.configService.get<string>('TRIAGE_TYPE', 'DISABLED').toUpperCase();

    switch (triageType) {
      case 'AI': {
        await this.triageService.handleAITriage(alert.alert_id, alert.case_id, submitAlertDto, userId, tenantId);
        break;
      }

      case 'MANUAL': {
        await this.taskSyncService.syncTaskCreationWithFlowable(userId, alert.case_id, CANDIDATE_GROUPS.INVESTIGATIONS);
        break;
      }

      case 'DISABLED':
      default: {
        await this.caseSyncService.syncCaseStatusWithFlowable(alert.case_id, CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT, userId);
        break;
      }
    }
  }
}
