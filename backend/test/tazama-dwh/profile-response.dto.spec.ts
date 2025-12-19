import { ProfileResponseDto, DetectedAnomalyDto } from '../../src/modules/tazama-dwh/dto/profile-response.dto';

describe('ProfileResponseDto', () => {
  it('should create an instance with required tenantId', () => {
    const dto = new ProfileResponseDto();
    dto.tenantId = 'T001';
    expect(dto.tenantId).toBe('T001');
  });

  it('should allow setting metrics and summaryTable', () => {
    const dto = new ProfileResponseDto();
    dto.metrics = { totalVolume: 10 };
    dto.summaryTable = { avgTicketSize: 100 };
    expect(dto.metrics.totalVolume).toBe(10);
    expect(dto.summaryTable.avgTicketSize).toBe(100);
  });

  it('should allow detected anomalies', () => {
    const anomaly = new DetectedAnomalyDto();
    anomaly.date = '2025-11-28';
    anomaly.type = 'Withdrawal';
    anomaly.amount = 3605.35;
    anomaly.description = 'Large transaction flagged';
    anomaly.risk = 'High';
    const dto = new ProfileResponseDto();
    dto.detectedAnomalies = [anomaly];
    expect(dto.detectedAnomalies?.[0]?.risk).toBe('High');
  });

  it('should allow transactionTable and notes', () => {
    const dto = new ProfileResponseDto();
    dto.transactionTable = [{ account: 'ACC-9012' }];
    dto.notes = 'Test notes';
    expect(dto.transactionTable?.[0]?.account).toBe('ACC-9012');
    expect(dto.notes).toBe('Test notes');
  });
});
