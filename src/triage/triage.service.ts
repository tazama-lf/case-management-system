import { Injectable } from '@nestjs/common';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TriageService {
  async handleAlert(submitAlertDto: SubmitAlertDto) {
    // Mock logic for auto-closing alert
    const {
      confidence_per,
      transaction,
      alert_data,
      ...rest
    } = submitAlertDto;

    let caseStatus = 'PENDING';
    let taskStatus = 'IN_PROGRESS';
    let message = 'Alert received.';
    if (
      confidence_per > 90 &&
      !transaction &&
      alert_data?.is_true_positive &&
      !alert_data?.aml_suspected
    ) {
      caseStatus = '71 - AUTOCLOSED CONFIRMED';
      taskStatus = '30 - COMPLETED';
      message = 'Alert auto-closed with high confidence.';
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
