import { Injectable, BadRequestException } from '@nestjs/common';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enum for case status codes.
 */
export enum CaseStatus {
  PENDING = 'PENDING',
  AUTOCLOSED_CONFIRMED = '71 - AUTOCLOSED CONFIRMED',
}

export enum TaskStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = '30 - COMPLETED',
}

@Injectable()
export class TriageService {
  /**
   * Handles alert submission and applies auto-close logic based on business rules.
   * @param submitAlertDto - The alert data submitted for triage
   * @returns Alert response with status and audit log
   * @throws BadRequestException if required fields are missing or invalid
   */
  async handleAlert(submitAlertDto: SubmitAlertDto) {
    if (
      !submitAlertDto ||
      !submitAlertDto.priority ||
      !submitAlertDto.tenant_id ||
      typeof submitAlertDto.confidence_per !== 'number'
    ) {
      throw new BadRequestException('Missing required alert fields.');
    }

    const {
      confidence_per,
      transaction,
      alert_data,
      ...rest
    } = submitAlertDto;

    let caseStatus = CaseStatus.PENDING;
    let taskStatus = TaskStatus.IN_PROGRESS;
    let message = 'Alert received.';
    if (
      confidence_per > 90 &&
      !transaction &&
      alert_data?.is_true_positive &&
      !alert_data?.aml_suspected
    ) {
      caseStatus = CaseStatus.AUTOCLOSED_CONFIRMED;
      taskStatus = TaskStatus.COMPLETED;
      message = 'Alert auto-closed with high confidence.';
      console.log(`[AUDIT] Alert auto-closed:`, {
        alert_id: 'to-be-generated',
        outcome: message,
        closed_at: new Date().toISOString(),
      });
    }

    return {
      alert_id: uuidv4(),
      priority: submitAlertDto.priority,
      confidence_per,
      message,
      created_at: new Date().toISOString(),
      case_status: caseStatus,
      task_status: taskStatus,
    };
  }
}
