import { Test, TestingModule } from '@nestjs/testing';
import { AlertService } from '../src/modules/alert/alert.service';
import { AlertRepository } from '../src/modules/repository/alert.repository';
import { TransactionDataRespository } from '../src/modules/repository/transactionalData.respository';
import { CaseCreationService } from '../src/modules/case/services/case-creation.service';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { EventLogService } from '../src/modules/event_log/eventLog.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Alert, CaseCreationType, CaseStatus, CaseType, Priority } from '@prisma/client-cms';
import { IngestAlertDto } from '../src/modules/alert/dto/IngestAlert.dto';
import { UpdateAlertDTO } from '../src/modules/alert/dto/UpdateAlert.dto';
import { Outcome } from '../src/utils/types/outcome';

describe('AlertService', () => {
  let service: AlertService;
  let alertRepository: jest.Mocked<AlertRepository>;
  let transactionDataRespository: jest.Mocked<TransactionDataRespository>;
  let caseCreationService: jest.Mocked<CaseCreationService>;
  let loggingOrchestrationService: jest.Mocked<LoggingOrchestrationService>;
  let eventLogService: jest.Mocked<EventLogService>;
  let loggerService: jest.Mocked<LoggerService>;
  let configService: jest.Mocked<ConfigService>;

  const mockAlert: any = {
    alert_id: 1,
    tenant_id: 'tenant-123',
    priority: Priority.NEW,
    source: 'test-source',
    txtp: 'pacs.002.001.12',
    message: 'Suspicious activity detected',
    report: { status: 'ALRT', id: '123' },
    transaction: { TxTp: 'pacs.002.001.12', EndToEndId: 'tx-123' },
    networkMap: {},
    confidence_per: 0,
    case_id: 1,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  const mockIngestAlertDto: any = {
    transaction: { TxTp: 'pacs.002.001.12', EndToEndId: 'tx-123' },
    report: { status: 'ALRT', id: '123' },
    message: 'Suspicious activity detected',
    networkMap: {},
  };

  const mockCase = {
    case_id: 1,
    tenant_id: 'tenant-123',
    case_creator_user_id: 'user-123',
    status: CaseStatus.STATUS_00_DRAFT,
    priority: Priority.NEW,
    case_creation_type: CaseCreationType.AUTOMATIC_SYSTEM,
    case_type: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const mockAlertRepository = {
      createAlert: jest.fn(),
      createTransaction: jest.fn(),
      updateAlert: jest.fn(),
      getAlertById: jest.fn(),
      getReferenceId: jest.fn(),
    };

    const mockTransactionDataRespository = {
      getTransactionalData: jest.fn(),
    };

    const mockCaseCreationService = {
      createCase: jest.fn(),
      createCaseWithInvestigationTask: jest.fn(),
    };

    const mockLoggingOrchestrationService = {
      logActions: jest.fn(),
    };

    const mockEventLogService = {
      getActionHistoryForAlert: jest.fn(),
    };

    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        {
          provide: AlertRepository,
          useValue: mockAlertRepository,
        },
        {
          provide: TransactionDataRespository,
          useValue: mockTransactionDataRespository,
        },
        {
          provide: CaseCreationService,
          useValue: mockCaseCreationService,
        },
        {
          provide: LoggingOrchestrationService,
          useValue: mockLoggingOrchestrationService,
        },
        {
          provide: EventLogService,
          useValue: mockEventLogService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
    alertRepository = module.get(AlertRepository);
    transactionDataRespository = module.get(TransactionDataRespository);
    caseCreationService = module.get(CaseCreationService);
    loggingOrchestrationService = module.get(LoggingOrchestrationService);
    eventLogService = module.get(EventLogService);
    loggerService = module.get(LoggerService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createNewAlert', () => {
    it('should successfully create a new alert', async () => {
      (alertRepository.createTransaction as jest.Mock).mockResolvedValue({ transactionId: 1 } as any);
      (alertRepository.createAlert as jest.Mock).mockResolvedValue(mockAlert);

      const result = await service.createNewAlert(mockIngestAlertDto, 'tenant-123', 'test-source', 1);

      expect(result).toEqual(mockAlert);
      expect(alertRepository.createTransaction).toHaveBeenCalledWith('tenant-123', mockIngestAlertDto.transaction);
      expect(alertRepository.createAlert).toHaveBeenCalledWith({
        tenantId: 'tenant-123',
        priority: Priority.NEW,
        source: 'test-source',
        txtp: 'pacs.002.001.12',
        message: 'Suspicious activity detected',
        report: mockIngestAlertDto.report,
        transaction: mockIngestAlertDto.transaction,
        networkMap: mockIngestAlertDto.networkMap,
        confidencePer: 0,
        caseId: 1,
      });
      expect(loggerService.log).toHaveBeenCalledWith('Start - Alert Creation', AlertService.name);
      expect(loggerService.log).toHaveBeenCalledWith(`End - Alert Creation - ${mockAlert.alert_id}`, AlertService.name);
    });

    it('should use default message if none provided', async () => {
      const alertWithoutMessage: any = { ...mockIngestAlertDto, message: undefined };
      (alertRepository.createTransaction as jest.Mock).mockResolvedValue({ transactionId: 1 } as any);
      (alertRepository.createAlert as jest.Mock).mockResolvedValue(mockAlert);

      await service.createNewAlert(alertWithoutMessage, 'tenant-123', 'test-source', 1);

      expect(alertRepository.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Suspicious activity detected',
        }),
      );
    });

    it('should throw InternalServerErrorException on transaction creation error', async () => {
      const error = new Error('Database error');
      (alertRepository.createTransaction as jest.Mock).mockRejectedValue(error);

      await expect(service.createNewAlert(mockIngestAlertDto, 'tenant-123', 'test-source', 1)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on alert creation error', async () => {
      (alertRepository.createTransaction as jest.Mock).mockResolvedValue({ transactionId: 1 } as any);
      (alertRepository.createAlert as jest.Mock).mockRejectedValue(new Error('Alert creation failed'));

      await expect(service.createNewAlert(mockIngestAlertDto, 'tenant-123', 'test-source', 1)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      (alertRepository.createTransaction as jest.Mock).mockResolvedValue({ transactionId: 1 } as any);
      (alertRepository.createAlert as jest.Mock).mockRejectedValue('String error');

      await expect(service.createNewAlert(mockIngestAlertDto, 'tenant-123', 'test-source', 1)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(loggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Error creating alert'),
        undefined,
        AlertService.name,
      );
    });
  });

  describe('updateAlert', () => {
    const updateData: UpdateAlertDTO = {
      priority: Priority.URGENT,
      message: 'Updated message',
    };

    it('should successfully update an alert', async () => {
      const updatedAlert = { ...mockAlert, ...updateData };
      (alertRepository.updateAlert as jest.Mock).mockResolvedValue(updatedAlert as any);
      (loggingOrchestrationService.logActions as jest.Mock).mockResolvedValue(undefined);

      const result = await service.updateAlert(1, 'user-123', updateData);

      expect(result).toEqual(updatedAlert);
      expect(alertRepository.updateAlert).toHaveBeenCalledWith(1, updateData, undefined);
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith({
        userId: 'user-123',
        operation: 'ALERT_UPDATED',
        entityName: AlertService.name,
        actionPerformed: `1 - Triaged by user user-123`,
        outcome: Outcome.SUCCESS,
      });
      expect(loggerService.log).toHaveBeenCalledWith('Start - Alert Update - 1', AlertService.name);
      expect(loggerService.log).toHaveBeenCalledWith('End - Alert Update - 1', AlertService.name);
    });

    it('should update alert with transaction client', async () => {
      const mockTx = {} as any;
      const updatedAlert = { ...mockAlert, ...updateData };
      (alertRepository.updateAlert as jest.Mock).mockResolvedValue(updatedAlert as any);
      (loggingOrchestrationService.logActions as jest.Mock).mockResolvedValue(undefined);

      await service.updateAlert(1, 'user-123', updateData, mockTx);

      expect(alertRepository.updateAlert).toHaveBeenCalledWith(1, updateData, mockTx);
    });

    it('should throw InternalServerErrorException on update error', async () => {
      const error = new Error('Update failed');
      (alertRepository.updateAlert as jest.Mock).mockRejectedValue(error);

      await expect(service.updateAlert(1, 'user-123', updateData)).rejects.toThrow(InternalServerErrorException);
      expect(loggerService.error).toHaveBeenCalledWith(
        'Error updating alert 1: Update failed',
        expect.any(String),
        AlertService.name,
      );
    });

    it('should handle non-Error exceptions during update', async () => {
      (alertRepository.updateAlert as jest.Mock).mockRejectedValue('String error');

      await expect(service.updateAlert(1, 'user-123', updateData)).rejects.toThrow(InternalServerErrorException);
      expect(loggerService.error).toHaveBeenCalledWith(
        'Error updating alert 1: String error',
        undefined,
        AlertService.name,
      );
    });
  });

  describe('handleAlertOrNALT', () => {
    it('should create NALT when report status is NALT', async () => {
      const naltData: any = { ...mockIngestAlertDto, report: { status: 'NALT', id: '123' } };
      (alertRepository.createTransaction as jest.Mock).mockResolvedValue({ transactionId: 1 } as any);
      (alertRepository.createAlert as jest.Mock).mockResolvedValue(mockAlert);

      const result = await service.handleAlertOrNALT(naltData, 'user-123', 'tenant-123', 'test-source');

      expect(result).toEqual(mockAlert);
      expect(alertRepository.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 0,
        }),
      );
    });

    it('should create case and alert when report status is not NALT', async () => {
      (configService.get as jest.Mock).mockReturnValue('system-uuid');
      (caseCreationService.createCase as jest.Mock).mockResolvedValue(mockCase as any);
      (alertRepository.createTransaction as jest.Mock).mockResolvedValue({ transactionId: 1 } as any);
      (alertRepository.createAlert as jest.Mock).mockResolvedValue(mockAlert);

      const result = await service.handleAlertOrNALT(mockIngestAlertDto, 'user-123', 'tenant-123', 'test-source');

      expect(result).toEqual(mockAlert);
      expect(caseCreationService.createCase).toHaveBeenCalledWith(
        {
          tenantId: 'tenant-123',
          caseCreatorUserId: 'system-uuid',
          status: CaseStatus.STATUS_00_DRAFT,
          priority: Priority.NEW,
          caseCreationType: CaseCreationType.AUTOMATIC_SYSTEM,
        },
        'user-123',
        'tenant-123',
      );
      expect(alertRepository.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: mockCase.case_id,
        }),
      );
    });

    it('should create investigation tasks for FRAUD_AND_AML case type', async () => {
      const fraudAmlCase = { ...mockCase, case_type: CaseType.FRAUD_AND_AML };
      (configService.get as jest.Mock).mockReturnValue('system-uuid');
      (caseCreationService.createCase as jest.Mock).mockResolvedValue(fraudAmlCase as any);
      (caseCreationService.createCaseWithInvestigationTask as jest.Mock).mockResolvedValue(undefined);
      (alertRepository.createTransaction as jest.Mock).mockResolvedValue({ transactionId: 1 } as any);
      (alertRepository.createAlert as jest.Mock).mockResolvedValue(mockAlert);

      await service.handleAlertOrNALT(mockIngestAlertDto, 'user-123', 'tenant-123', 'test-source');

      expect(caseCreationService.createCaseWithInvestigationTask).toHaveBeenCalledWith(
        CaseType.FRAUD,
        'user-123',
        'tenant-123',
        fraudAmlCase.case_id,
        fraudAmlCase.priority,
      );
      expect(caseCreationService.createCaseWithInvestigationTask).toHaveBeenCalledWith(
        CaseType.AML,
        'user-123',
        'tenant-123',
        fraudAmlCase.case_id,
        fraudAmlCase.priority,
      );
    });

    it('should use userId as default when SYSTEM_UUID not configured', async () => {
      (configService.get as jest.Mock).mockReturnValue('user-123');
      (caseCreationService.createCase as jest.Mock).mockResolvedValue(mockCase as any);
      (alertRepository.createTransaction as jest.Mock).mockResolvedValue({ transactionId: 1 } as any);
      (alertRepository.createAlert as jest.Mock).mockResolvedValue(mockAlert);

      await service.handleAlertOrNALT(mockIngestAlertDto, 'user-123', 'tenant-123', 'test-source');

      expect(configService.get).toHaveBeenCalledWith('SYSTEM_UUID', 'user-123');
      expect(caseCreationService.createCase).toHaveBeenCalledWith(
        expect.objectContaining({
          caseCreatorUserId: 'user-123',
        }),
        'user-123',
        'tenant-123',
      );
    });
  });

  describe('getAlertTransactionalData', () => {
    const mockReferenceIdData = {
      id: 1,
      txTp: 'pacs.002.001.12',
      referenceIdName: 'EndToEndId',
      createdAt: new Date('2026-01-01'),
    };

    const mockTransactionData = {
      id: 1,
      referenceId: 'tx-123',
      data: { TxTp: 'pacs.002.001.12' },
      createdAt: new Date('2026-01-01'),
    };

    it('should throw BadRequestException when alertId is null', async () => {
      await expect(service.getAlertTransactionalData(null as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when alertId is undefined', async () => {
      await expect(service.getAlertTransactionalData(undefined as any)).rejects.toThrow(BadRequestException);
    });

    it('should successfully retrieve transactional data', async () => {
      (alertRepository.getAlertById as jest.Mock).mockResolvedValue(mockAlert);
      (alertRepository.getReferenceId as jest.Mock).mockResolvedValue(mockReferenceIdData);
      (transactionDataRespository.getTransactionalData as jest.Mock).mockResolvedValue(mockTransactionData);

      const result = await service.getAlertTransactionalData(1);

      expect(result).toEqual(mockTransactionData);
      expect(alertRepository.getAlertById).toHaveBeenCalledWith(1);
      expect(alertRepository.getReferenceId).toHaveBeenCalledWith('pacs.002.001.12');
      expect(transactionDataRespository.getTransactionalData).toHaveBeenCalledWith('tx-123');
    });

    it('should throw error when referenceId not found in transaction', async () => {
      const alertWithoutRefId = { ...mockAlert, transaction: { TxTp: 'pacs.002.001.12' } };
      (alertRepository.getAlertById as jest.Mock).mockResolvedValue(alertWithoutRefId);
      (alertRepository.getReferenceId as jest.Mock).mockResolvedValue(mockReferenceIdData);

      await expect(service.getAlertTransactionalData(1)).rejects.toThrow('ReferenceId not found in transaction data');
    });

    it('should throw InternalServerErrorException when transactionData not found', async () => {
      (alertRepository.getAlertById as jest.Mock).mockResolvedValue(mockAlert);
      (alertRepository.getReferenceId as jest.Mock).mockResolvedValue(mockReferenceIdData);
      (transactionDataRespository.getTransactionalData as jest.Mock).mockResolvedValue(null);

      await expect(service.getAlertTransactionalData(1)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when alert not found', async () => {
      (alertRepository.getAlertById as jest.Mock).mockResolvedValue(null);

      await expect(service.getAlertTransactionalData(1)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getAlertDetails', () => {
    it('should successfully retrieve alert details', async () => {
      (alertRepository.getAlertById as jest.Mock).mockResolvedValue(mockAlert);

      const result = await service.getAlertDetails(1, 'tenant-123', 'user-123');

      const { tenant_id, ...sanitizedAlert } = mockAlert;
      expect(result).toEqual(sanitizedAlert);
      expect(alertRepository.getAlertById).toHaveBeenCalledWith(1);
      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('Alert 1 opened by user user-123'),
        AlertService.name,
      );
    });

    it('should throw NotFoundException when alert not found', async () => {
      (alertRepository.getAlertById as jest.Mock).mockResolvedValue(null);

      await expect(service.getAlertDetails(1, 'tenant-123', 'user-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when tenant does not match', async () => {
      const differentTenantAlert = { ...mockAlert, tenant_id: 'different-tenant' };
      (alertRepository.getAlertById as jest.Mock).mockResolvedValue(differentTenantAlert);

      await expect(service.getAlertDetails(1, 'tenant-123', 'user-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on repository error', async () => {
      (alertRepository.getAlertById as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(service.getAlertDetails(1, 'tenant-123', 'user-123')).rejects.toThrow(InternalServerErrorException);
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should sanitize alert details by removing tenant_id', async () => {
      (alertRepository.getAlertById as jest.Mock).mockResolvedValue(mockAlert);

      const result = await service.getAlertDetails(1, 'tenant-123', 'user-123');

      expect(result).not.toHaveProperty('tenant_id');
      expect(result).toHaveProperty('alert_id');
    });
  });

  describe('getAlertActionHistory', () => {
    const mockHistory = [
      {
        id: 1,
        alertId: 1,
        userId: 'user-123',
        action: 'CREATED',
        timestamp: new Date('2026-01-01'),
      },
      {
        id: 2,
        alertId: 1,
        userId: 'user-123',
        action: 'UPDATED',
        timestamp: new Date('2026-01-02'),
      },
    ];

    it('should successfully retrieve alert action history', async () => {
      (alertRepository.getAlertById as jest.Mock).mockResolvedValue(mockAlert);
      (eventLogService.getActionHistoryForAlert as jest.Mock).mockResolvedValue(mockHistory);

      const result = await service.getAlertActionHistory(1, 'tenant-123', 'user-123');

      expect(result).toEqual({
        alertId: 1,
        tenantId: 'tenant-123',
        userId: 'user-123',
        history: mockHistory,
      });
      expect(alertRepository.getAlertById).toHaveBeenCalledWith(1);
      expect(eventLogService.getActionHistoryForAlert).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when alert not found', async () => {
      (alertRepository.getAlertById as jest.Mock).mockResolvedValue(null);

      await expect(service.getAlertActionHistory(1, 'tenant-123', 'user-123')).rejects.toThrow(NotFoundException);
    });

    it('should return empty history when no actions found', async () => {
      (alertRepository.getAlertById as jest.Mock).mockResolvedValue(mockAlert);
      (eventLogService.getActionHistoryForAlert as jest.Mock).mockResolvedValue([]);

      const result = await service.getAlertActionHistory(1, 'tenant-123', 'user-123');

      expect(result.history).toEqual([]);
    });
  });
});
