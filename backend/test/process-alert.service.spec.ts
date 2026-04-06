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
          report: { ...mockIngestAlertDto.report, status: 'NALT' as const },
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
      });

      it.each(['AI', 'ai', 'aI'])('should handle AI triage when TRIAGE_TYPE is %s (case-insensitive)', async (triageType) => {
        configService.get.mockReturnValue(triageType);

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(loggerService.log).toHaveBeenCalledWith('Start - Processing Incoming Alert', 'ProcessAlertService');
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
    });

    describe('Manual triage flow', () => {
      beforeEach(() => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
      });

      it.each(['MANUAL', 'manual'])('should create manual triage task when TRIAGE_TYPE is %s', async (triageType) => {
        configService.get.mockReturnValue(triageType);

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
    });

    describe('Disabled triage flow', () => {
      beforeEach(() => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
      });

      it.each(['DISABLED', 'disabled', 'UNKNOWN_TYPE', ''])(
        'should create investigation task when TRIAGE_TYPE is %s',
        async (triageType) => {
          configService.get.mockReturnValue(triageType);

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
        },
      );
    });

    describe('Alert service integration', () => {
      beforeEach(() => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        configService.get.mockReturnValue('DISABLED');
      });

      it('should pass correct parameters to alertService', async () => {
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
    });

    describe('Logger integration', () => {
      it('should log at the start of processing in all scenarios', async () => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        configService.get.mockReturnValue('DISABLED');

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(loggerService.log).toHaveBeenCalledWith('Start - Processing Incoming Alert', 'ProcessAlertService');
      });
    });

    describe('Error propagation', () => {
      it('should propagate errors from alertService', async () => {
        const error = new Error('Alert service failed');
        alertService.handleAlertOrNALT.mockRejectedValue(error);

        await expect(service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId)).rejects.toThrow('Alert service failed');
      });

      it('should propagate errors from triageService', async () => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        configService.get.mockReturnValue('AI');
        const error = new Error('AI triage failed');
        triageService.handleAITriage.mockRejectedValue(error);

        await expect(service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId)).rejects.toThrow('AI triage failed');
      });

      it('should propagate errors from taskService', async () => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        configService.get.mockReturnValue('MANUAL');
        const error = new Error('Task creation failed');
        taskService.createTask.mockRejectedValue(error);

        await expect(service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId)).rejects.toThrow('Task creation failed');
      });

      it('should propagate errors from caseCreationService', async () => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        configService.get.mockReturnValue('DISABLED');
        const error = new Error('Case update failed');
        caseCreationService.updateCaseStatus.mockRejectedValue(error);

        await expect(service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId)).rejects.toThrow('Case update failed');
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

      it('should handle different networkMap values', async () => {
        alertService.handleAlertOrNALT.mockResolvedValue(mockAlert);
        configService.get.mockReturnValue('AI');

        await service.processIncomingAlert(mockIngestAlertDto, source, userId, tenantId);

        expect(triageService.handleAITriage).toHaveBeenCalledWith(
          mockAlert.alert_id,
          mockAlert.case_id,
          expect.objectContaining({
            networkMap: expect.anything(),
          }),
          userId,
          tenantId,
        );
      });
    });
  });
});
