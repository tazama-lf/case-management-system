import { Test, TestingModule } from '@nestjs/testing';
import { ProcessAlertService } from '../src/modules/process-alert/process-alert.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConfigService } from '@nestjs/config';
import { TriageService } from '../src/modules/triage/triage.service';
import { TaskService } from '../src/modules/task/task.service';
import { CaseCreationApprovalService } from '../src/modules/case/services/case-creation-approval.service';
import { AlertService } from '../src/modules/alert/alert.service';
import { IngestAlertDto } from '../src/modules/alert/dto/IngestAlert.dto';
import { CaseStatus, TaskStatus } from '@prisma/client-cms';
import { CANDIDATE_GROUPS } from '../src/constants/case.constants';

describe('ProcessAlertService', () => {
  let service: ProcessAlertService;
  let loggerService: any;
  let configService: any;
  let triageService: any;
  let taskService: any;
  let caseCreationService: any;
  let alertService: any;

  const mockIngestAlertDto: IngestAlertDto = {
    message: 'Alert message text',
    report: {
      status: 'ALRT',
    } as any,
    transaction: {
      TxTp: 'pacs.002.001.12',
      TxID: 'tx-123',
    } as any,
    networkMap: {
      active: true,
      cfg: '1.0',
      tenantId: 'tenant-001',
      messages: [],
    } as any,
  };

  const mockAlert = {
    alert_id: 123,
    case_id: 456,
    status: 'OPEN',
    created_at: new Date(),
  };

  beforeEach(async () => {
    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockTriageService = {
      handleAITriage: jest.fn().mockResolvedValue({}),
    };

    const mockTaskService = {
      createTask: jest.fn().mockResolvedValue({}),
    };

    const mockCaseCreationService = {
      updateCaseStatus: jest.fn().mockResolvedValue({}),
    };

    const mockAlertService = {
      handleAlertOrNALT: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessAlertService,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: TriageService,
          useValue: mockTriageService,
        },
        {
          provide: TaskService,
          useValue: mockTaskService,
        },
        {
          provide: CaseCreationApprovalService,
          useValue: mockCaseCreationService,
        },
        {
          provide: AlertService,
          useValue: mockAlertService,
        },
      ],
    }).compile();

    service = module.get<ProcessAlertService>(ProcessAlertService);
    loggerService = module.get(LoggerService);
    configService = module.get(ConfigService);
    triageService = module.get(TriageService);
    taskService = module.get(TaskService);
    caseCreationService = module.get(CaseCreationApprovalService);
    alertService = module.get(AlertService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processIncomingAlert', () => {
    const source = 'CORE_BANKING';
    const userId = 'user-123';
    const tenantId = 'tenant-001';

    describe('NALT status handling', () => {
      it('should return early when report status is NALT', async () => {
        const naltDto = {
          ...mockIngestAlertDto,
          report: { ...mockIngestAlertDto.report, status: 'NALT' },
        };

        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);

        await service.processIncomingAlert(naltDto, source, userId, tenantId);

        expect(alertService.handleAlertOrNALT).toHaveBeenCalledWith(
          {
            message: naltDto.message,
            report: naltDto.report,
            transaction: naltDto.transaction,
            networkMap: naltDto.networkMap,
          },
          userId,
          tenantId,
          source,
        );
        expect(configService.get).not.toHaveBeenCalled();
        expect(triageService.handleAITriage).not.toHaveBeenCalled();
        expect(taskService.createTask).not.toHaveBeenCalled();
      });

      it('should return early when alert has no case_id', async () => {
        const alertWithoutCase = { ...mockAlert, case_id: null };
        alertService.handleAlertOrNALT.mockResolvedValue(alertWithoutCase);

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(alertService.handleAlertOrNALT).toHaveBeenCalled();
        expect(configService.get).not.toHaveBeenCalled();
        expect(triageService.handleAITriage).not.toHaveBeenCalled();
        expect(taskService.createTask).not.toHaveBeenCalled();
      });

      it('should return early when alert case_id is undefined', async () => {
        const alertWithoutCase = { ...mockAlert, case_id: undefined };
        alertService.handleAlertOrNALT.mockResolvedValue(alertWithoutCase);

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(alertService.handleAlertOrNALT).toHaveBeenCalled();
        expect(configService.get).not.toHaveBeenCalled();
      });

      it('should return early when alert case_id is 0', async () => {
        const alertWithZeroCaseId = { ...mockAlert, case_id: 0 };
        alertService.handleAlertOrNALT.mockResolvedValue(alertWithZeroCaseId);

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(alertService.handleAlertOrNALT).toHaveBeenCalled();
        expect(configService.get).not.toHaveBeenCalled();
      });
    });

    describe('AI triage flow', () => {
      beforeEach(() => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        configService.get.mockReturnValue('AI');
      });

      it('should handle AI triage when TRIAGE_TYPE is AI', async () => {
        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(loggerService.log).toHaveBeenCalledWith('Start - Processing Incoming Alert', 'ProcessAlertService');
        expect(alertService.handleAlertOrNALT).toHaveBeenCalled();
        expect(configService.get).toHaveBeenCalledWith('TRIAGE_TYPE', 'DISABLED');
        expect(triageService.handleAITriage).toHaveBeenCalledWith(
          mockAlert.alert_id,
          mockAlert.case_id,
          {
            message: mockIngestAlertDto.message,
            report: mockIngestAlertDto.report,
            transaction: mockIngestAlertDto.transaction,
            networkMap: mockIngestAlertDto.networkMap,
          },
          userId,
          tenantId,
        );
        expect(taskService.createTask).not.toHaveBeenCalled();
        expect(caseCreationService.updateCaseStatus).not.toHaveBeenCalled();
      });

      it('should handle AI triage with lowercase ai', async () => {
        configService.get.mockReturnValue('ai');

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(triageService.handleAITriage).toHaveBeenCalled();
        expect(taskService.createTask).not.toHaveBeenCalled();
      });

      it('should handle AI triage with mixed case aI', async () => {
        configService.get.mockReturnValue('aI');

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(triageService.handleAITriage).toHaveBeenCalled();
      });

      it('should pass correct alert and case IDs to AI triage', async () => {
        const differentAlert = { ...mockAlert, alert_id: 999, case_id: 888 };
        alertService.handleAlertOrNALT.mockResolvedValue(differentAlert);

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(triageService.handleAITriage).toHaveBeenCalledWith(
          999,
          888,
          expect.any(Object),
          userId,
          tenantId,
        );
      });
    });

    describe('Manual triage flow', () => {
      beforeEach(() => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        configService.get.mockReturnValue('MANUAL');
      });

      it('should create manual triage task when TRIAGE_TYPE is MANUAL', async () => {
        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(configService.get).toHaveBeenCalledWith('TRIAGE_TYPE', 'DISABLED');
        expect(taskService.createTask).toHaveBeenCalledWith(
          {
            caseId: mockAlert.case_id,
            status: TaskStatus.STATUS_01_UNASSIGNED,
            name: 'Complete New Case',
            description: `Manual triage required for alert: ${mockAlert.alert_id}`,
            candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
          },
          userId,
          tenantId,
        );
        expect(triageService.handleAITriage).not.toHaveBeenCalled();
        expect(caseCreationService.updateCaseStatus).not.toHaveBeenCalled();
      });

      it('should handle manual triage with lowercase manual', async () => {
        configService.get.mockReturnValue('manual');

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(taskService.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Complete New Case',
            candidateGroup: CANDIDATE_GROUPS.INVESTIGATIONS,
          }),
          userId,
          tenantId,
        );
      });

      it('should include alert_id in task description', async () => {
        const customAlert = { ...mockAlert, alert_id: 12345 };
        alertService.handleAlertOrNALT.mockResolvedValue(customAlert);

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(taskService.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'Manual triage required for alert: 12345',
          }),
          userId,
          tenantId,
        );
      });

      it('should use correct task status for manual triage', async () => {
        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(taskService.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            status: TaskStatus.STATUS_01_UNASSIGNED,
          }),
          userId,
          tenantId,
        );
      });
    });

    describe('Disabled triage flow', () => {
      beforeEach(() => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
      });

      it('should create investigation task and update case status when TRIAGE_TYPE is DISABLED', async () => {
        configService.get.mockReturnValue('DISABLED');

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(taskService.createTask).toHaveBeenCalledWith(
          {
            caseId: mockAlert.case_id,
            status: TaskStatus.STATUS_01_UNASSIGNED,
            name: 'Investigate Case',
            description: `Investigate case: ${mockAlert.case_id}`,
            candidateGroup: 'Investigations',
          },
          userId,
          tenantId,
        );
        expect(caseCreationService.updateCaseStatus).toHaveBeenCalledWith(
          mockAlert.case_id,
          CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
          userId,
          tenantId,
        );
        expect(triageService.handleAITriage).not.toHaveBeenCalled();
      });

      it('should handle default case when TRIAGE_TYPE is not recognized', async () => {
        configService.get.mockReturnValue('UNKNOWN_TYPE');

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(taskService.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Investigate Case',
          }),
          userId,
          tenantId,
        );
        expect(caseCreationService.updateCaseStatus).toHaveBeenCalled();
      });

      it('should use default DISABLED behavior for empty string', async () => {
        configService.get.mockReturnValue('');

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(taskService.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Investigate Case',
          }),
          userId,
          tenantId,
        );
      });

      it('should include case_id in task description', async () => {
        const customAlert = { ...mockAlert, case_id: 789 };
        alertService.handleAlertOrNALT.mockResolvedValue(customAlert);
        configService.get.mockReturnValue('DISABLED');

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(taskService.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            description: 'Investigate case: 789',
          }),
          userId,
          tenantId,
        );
      });

      it('should update case to READY_FOR_ASSIGNMENT status', async () => {
        configService.get.mockReturnValue('DISABLED');

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(caseCreationService.updateCaseStatus).toHaveBeenCalledWith(
          mockAlert.case_id,
          CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
          userId,
          tenantId,
        );
      });

      it('should handle lowercase disabled', async () => {
        configService.get.mockReturnValue('disabled');

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(taskService.createTask).toHaveBeenCalled();
        expect(caseCreationService.updateCaseStatus).toHaveBeenCalled();
      });
    });

    describe('Alert service integration', () => {
      beforeEach(() => {
        configService.get.mockReturnValue('DISABLED');
      });

      it('should pass correct DTO structure to alertService', async () => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(alertService.handleAlertOrNALT).toHaveBeenCalledWith(
          {
            message: mockIngestAlertDto.message,
            report: mockIngestAlertDto.report,
            transaction: mockIngestAlertDto.transaction,
            networkMap: mockIngestAlertDto.networkMap,
          },
          userId,
          tenantId,
          source,
        );
      });

      it('should pass source parameter to alertService', async () => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        const customSource = 'EXTERNAL_API';

        await service.processIncomingAlert(mockIngestAlertDto, customSource, userId, tenantId);

        expect(alertService.handleAlertOrNALT).toHaveBeenCalledWith(
          expect.any(Object),
          userId,
          tenantId,
          customSource,
        );
      });

      it('should pass userId and tenantId to alertService', async () => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        const customUserId = 'custom-user-456';
        const customTenantId = 'custom-tenant-789';

        await service.processIncomingAlert(mockIngestAlertDto, source, customUserId, customTenantId);

        expect(alertService.handleAlertOrNALT).toHaveBeenCalledWith(
          expect.any(Object),
          customUserId,
          customTenantId,
          source,
        );
      });
    });

    describe('Logger integration', () => {
      beforeEach(() => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        configService.get.mockReturnValue('DISABLED');
      });

      it('should log at the start of processing', async () => {
        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(loggerService.log).toHaveBeenCalledWith('Start - Processing Incoming Alert', 'ProcessAlertService');
      });

      it('should log even when returning early for NALT', async () => {
        const naltDto = {
          ...mockIngestAlertDto,
          report: { ...mockIngestAlertDto.report, status: 'NALT' },
        };

        await service.processIncomingAlert(naltDto, source, userId, tenantId);

        expect(loggerService.log).toHaveBeenCalledWith('Start - Processing Incoming Alert', 'ProcessAlertService');
      });

      it('should log even when returning early for no case_id', async () => {
        alertService.handleAlertOrNALT.mockResolvedValue({ ...mockAlert, case_id: null });

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(loggerService.log).toHaveBeenCalledWith('Start - Processing Incoming Alert', 'ProcessAlertService');
      });
    });

    describe('Error propagation', () => {
      it('should propagate errors from alertService', async () => {
        const error = new Error('Alert service failed');
        alertService.handleAlertOrNALT.mockRejectedValue(error);

        await expect(service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId)).rejects.toThrow(
          'Alert service failed',
        );
      });

      it('should propagate errors from triageService', async () => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        configService.get.mockReturnValue('AI');
        const error = new Error('AI triage failed');
        triageService.handleAITriage.mockRejectedValue(error);

        await expect(service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId)).rejects.toThrow(
          'AI triage failed',
        );
      });

      it('should propagate errors from taskService', async () => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        configService.get.mockReturnValue('MANUAL');
        const error = new Error('Task creation failed');
        taskService.createTask.mockRejectedValue(error);

        await expect(service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId)).rejects.toThrow(
          'Task creation failed',
        );
      });

      it('should propagate errors from caseCreationService', async () => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        configService.get.mockReturnValue('DISABLED');
        const error = new Error('Case update failed');
        caseCreationService.updateCaseStatus.mockRejectedValue(error);

        await expect(service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId)).rejects.toThrow(
          'Case update failed',
        );
      });
    });

    describe('Edge cases', () => {
      it('should handle alert with very large IDs', async () => {
        const largeIdAlert = { ...mockAlert, alert_id: 999999999, case_id: 888888888 };
        alertService.handleAlertOrNALT.mockResolvedValue(largeIdAlert);
        configService.get.mockReturnValue('DISABLED');

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(taskService.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            caseId: 888888888,
            description: 'Investigate case: 888888888',
          }),
          userId,
          tenantId,
        );
      });

      it('should handle empty networkMap', async () => {
        const dtoWithEmptyNetworkMap = {
          ...mockIngestAlertDto,
          networkMap: {
            active: false,
            cfg: '',
            tenantId: '',
            messages: [],
          } as any,
        };
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        configService.get.mockReturnValue('AI');

        await service.processIncomingAlert(dtoWithEmptyNetworkMap, source, userId, tenantId);

        expect(triageService.handleAITriage).toHaveBeenCalledWith(
          mockAlert.alert_id,
          mockAlert.case_id,
          expect.objectContaining({
            networkMap: expect.any(Object),
          }),
          userId,
          tenantId,
        );
      });

      it('should handle null networkMap', async () => {
        const dtoWithNullNetworkMap = { ...mockIngestAlertDto, networkMap: null as any };
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        configService.get.mockReturnValue('AI');

        await service.processIncomingAlert(dtoWithNullNetworkMap, source, userId, tenantId);

        expect(triageService.handleAITriage).toHaveBeenCalledWith(
          mockAlert.alert_id,
          mockAlert.case_id,
          expect.objectContaining({
            networkMap: null,
          }),
          userId,
          tenantId,
        );
      });

      it('should handle different tenant and user combinations', async () => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        configService.get.mockReturnValue('MANUAL');

        const testCases = [
          { userId: 'user-1', tenantId: 'tenant-1' },
          { userId: 'user-2', tenantId: 'tenant-2' },
          { userId: '', tenantId: 'tenant-3' },
        ];

        for (const testCase of testCases) {
          await service.processIncomingAlert(mockIngestAlertDto, source, testCase.userId, testCase.tenantId);

          expect(taskService.createTask).toHaveBeenCalledWith(expect.any(Object), testCase.userId, testCase.tenantId);
        }
      });
    });
  });
});
