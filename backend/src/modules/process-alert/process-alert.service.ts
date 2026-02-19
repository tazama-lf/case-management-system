import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { IngestAlertDto } from 'src/modules/alert/dto/IngestAlert.dto';
import { TaskService } from '../task/task.service';
import { TriageService } from '../triage/triage.service';
import { CaseStatus, TaskStatus } from '@prisma/client-cms';
import { CaseCreationApprovalService } from '../case/services/case-creation-approval.service';
import { AlertService } from '../alert/alert.service';
import { CANDIDATE_GROUPS } from '../../constants/case.constants';

@Injectable()
export class ProcessAlertService {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly configService: ConfigService,
    private readonly triageService: TriageService,
    private readonly taskService: TaskService,
    private readonly caseCreationService: CaseCreationApprovalService,
    private readonly alertService: AlertService,
  ) {}

  async processIncomingAlert(req: IngestAlertDto, source: string, userId: string, tenantId: string) {
    this.loggerService.log('Start - Processing Incoming Alert', ProcessAlertService.name);
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
        await this.taskService.createTask(
          {
            caseId: alert.case_id,
            status: TaskStatus.STATUS_01_UNASSIGNED,
            name: 'Complete New Case',
            description: `Manual triage required for alert: ${alert.alert_id}`,
            candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
            // assignedUserId: userId
          },
          userId,
        );
        break;
      }

      case 'DISABLED':
      default: {
        await this.taskService.createTask(
          {
            caseId: alert.case_id,
            status: TaskStatus.STATUS_01_UNASSIGNED,
            name: 'Investigate Case',
            description: `Investigate case: ${alert.case_id}`,
            candidateGroup: 'Investigations',
          },
          userId,
        );

        await this.caseCreationService.updateCaseStatus(alert.case_id, CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT, userId);
        break;
      }
    }
  }
}
