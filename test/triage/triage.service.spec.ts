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
    expect(result.message).toBe('Alert auto-closed with high confidence.');
    expect(result.priority).toBe('High');
    expect(result.confidence_per).toBe(95);
    expect(result.alert_id).toBeDefined();
    expect(result.created_at).toBeDefined();
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
    expect(result.message).toBe('Alert received.');
    expect(result.priority).toBe('Low');
    expect(result.confidence_per).toBe(50);
    expect(result.alert_id).toBeDefined();
    expect(result.created_at).toBeDefined();
  });

  it('should not auto-close alert if not a true positive', async () => {
    const dto: SubmitAlertDto = {
      tenant_id: 'tenant1',
      priority: 'High',
      txtp: 'TX3',
      source: 'system',
      message: 'Test',
      alert_data: { is_true_positive: false, aml_suspected: false },
      transaction: null,
      network_map: {},
      confidence_per: 95,
    };
    const result = await service.handleAlert(dto);
    expect(result.message).toBe('Alert received.');
  });

  it('should not auto-close alert if transaction exists', async () => {
    const dto: SubmitAlertDto = {
      tenant_id: 'tenant1',
      priority: 'High',
      txtp: 'TX4',
      source: 'system',
      message: 'Test',
      alert_data: { is_true_positive: true, aml_suspected: false },
      transaction: { id: 1 },
      network_map: {},
      confidence_per: 95,
    };
    const result = await service.handleAlert(dto);
    expect(result.message).toBe('Alert received.');
  });

  it('should not auto-close alert if AML is suspected', async () => {
    const dto: SubmitAlertDto = {
      tenant_id: 'tenant1',
      priority: 'High',
      txtp: 'TX5',
      source: 'system',
      message: 'Test',
      alert_data: { is_true_positive: true, aml_suspected: true },
      transaction: null,
      network_map: {},
      confidence_per: 95,
    };
    const result = await service.handleAlert(dto);
    expect(result.message).toBe('Alert received.');
  });

  it('should throw BadRequestException for missing required fields', async () => {
    await expect(service.handleAlert({} as any)).rejects.toThrow(
      'Missing required alert fields.',
    );
  });

  it('should log audit when auto-closing', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation();
    const dto: SubmitAlertDto = {
      tenant_id: 'tenant1',
      priority: 'High',
      txtp: 'TX6',
      source: 'system',
      message: 'Test',
      alert_data: { is_true_positive: true, aml_suspected: false },
      transaction: null,
      network_map: {},
      confidence_per: 95,
    };
    await service.handleAlert(dto);
    expect(spy).toHaveBeenCalledWith(
      '[AUDIT] Alert auto-closed:',
      expect.objectContaining({
        outcome: 'Alert auto-closed with high confidence.',
      }),
    );
    spy.mockRestore();
  });
});
