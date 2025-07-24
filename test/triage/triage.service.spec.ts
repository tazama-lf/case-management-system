import { TriageService } from '../../src/triage/triage.service';
import { SubmitAlertDto } from '../../src/triage/dto/submit-alert.dto';

describe('TriageService', () => {
  let service: TriageService;

  beforeEach(() => {
    service = new TriageService();
  });

  it('should auto-close alert with high confidence and true positive', async () => {
    const dto: SubmitAlertDto = {
      tenant_id: 'tenant1',
      priority: 'High',
      txtp: 'TX1',
      source: 'system',
      message: 'Test',
      alert_data: { is_true_positive: true, aml_suspected: false },
      transaction: null,
      network_map: {},
      confidence_per: 95,
    };
    const result = await service.handleAlert(dto);
    expect(result.case_status).toBe('71 - AUTOCLOSED CONFIRMED');
    expect(result.task_status).toBe('30 - COMPLETED');
  });

  it('should not auto-close alert if confidence is low', async () => {
    const dto: SubmitAlertDto = {
      tenant_id: 'tenant1',
      priority: 'Low',
      txtp: 'TX2',
      source: 'system',
      message: 'Test',
      alert_data: { is_true_positive: true, aml_suspected: false },
      transaction: null,
      network_map: {},
      confidence_per: 50,
    };
    const result = await service.handleAlert(dto);
    expect(result.case_status).toBe('PENDING');
    expect(result.task_status).toBe('IN_PROGRESS');
  });

  it('should throw BadRequestException for missing required fields', async () => {
    await expect(service.handleAlert({} as any)).rejects.toThrow('Missing required alert fields.');
  });
  
});
