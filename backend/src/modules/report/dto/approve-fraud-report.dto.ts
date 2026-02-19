import type { FraudReportOutcome } from '../report.model';

export class ApproveFraudReportDto {
  outcome: FraudReportOutcome;
  supervisor: string;
  supervisorUserId: string;
}
