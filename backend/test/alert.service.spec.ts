import { Test, TestingModule } from '@nestjs/testing';
import { AlertService } from '../src/modules/alert/alert.service';
import { AlertRepository } from '../src/modules/repository/alert.repository';
import { CaseCreationService } from '../src/modules/case/services/case-creation.service';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { EventLogService } from '../src/modules/event_log/eventLog.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConfigService } from '@nestjs/config';
import { GoldLakehouseService } from '../src/modules/gold-lakehouse/gold-lakehouse.service';
import { TransactionLakehouseService } from '../src/modules/gold-lakehouse/transaction-lakehouse.service';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CaseCreationType, CaseStatus, Priority } from '@prisma/client-cms';
import { Outcome } from '../src/utils/types/outcome';

describe('AlertService', () => {
  let service: AlertService;
  let alertRepository: jest.Mocked<AlertRepository>;
  let caseCreationService: jest.Mocked<CaseCreationService>;
  let loggingOrchestrationService: jest.Mocked<LoggingOrchestrationService>;
  let eventLogService: jest.Mocked<EventLogService>;
  let loggerService: jest.Mocked<LoggerService>;
  let configService: jest.Mocked<ConfigService>;
  let goldLakehouseService: jest.Mocked<GoldLakehouseService>;
  let transactionLakehouseService: jest.Mocked<TransactionLakehouseService>;

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
    created_at: new Date(),
    updated_at: new Date(),
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
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        {
          provide: AlertRepository,
          useValue: {
            createAlert: jest.fn(),
            createTransaction: jest.fn(),
            updateAlert: jest.fn(),
            getAlertById: jest.fn(),
            getReferenceId: jest.fn(),
          },
        },
        {
          provide: CaseCreationService,
          useValue: { createCase: jest.fn() },
        },
        {
          provide: LoggingOrchestrationService,
          useValue: { logActions: jest.fn() },
        },
        {
          provide: EventLogService,
          useValue: { getActionHistoryForAlert: jest.fn() },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: GoldLakehouseService,
          useValue: { runSqlQuery: jest.fn() },
        },
        {
          provide: TransactionLakehouseService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
    alertRepository = module.get(AlertRepository);
    caseCreationService = module.get(CaseCreationService);
    loggingOrchestrationService = module.get(LoggingOrchestrationService);
    eventLogService = module.get(EventLogService);
    loggerService = module.get(LoggerService);
    configService = module.get(ConfigService);
    goldLakehouseService = module.get(GoldLakehouseService);
    transactionLakehouseService = module.get(TransactionLakehouseService);
  });

  afterEach(() => jest.clearAllMocks());

  // ===================== createNewAlert =====================
  describe('createNewAlert', () => {
    it('creates alert successfully', async () => {
      alertRepository.createTransaction.mockResolvedValue({ transactionId: 1 } as any);
      alertRepository.createAlert.mockResolvedValue(mockAlert);

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
    });

    it('uses default message when none provided', async () => {
      const dto = { ...mockIngestAlertDto, message: undefined };
      alertRepository.createTransaction.mockResolvedValue({ transactionId: 1 } as any);
      alertRepository.createAlert.mockResolvedValue(mockAlert);

      await service.createNewAlert(dto, 'tenant-123', 'test-source', 1);

      expect(alertRepository.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Suspicious activity detected' }),
      );
    });

    it('throws InternalServerErrorException when createAlert returns null', async () => {
      alertRepository.createTransaction.mockResolvedValue({ transactionId: 1 } as any);
      alertRepository.createAlert.mockResolvedValue(null as any);

      await expect(service.createNewAlert(mockIngestAlertDto, 'tenant-123', 'test-source', 1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('throws InternalServerErrorException on Error', async () => {
      alertRepository.createTransaction.mockRejectedValue(new Error('DB error'));

      await expect(service.createNewAlert(mockIngestAlertDto, 'tenant-123', 'test-source', 1)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('throws InternalServerErrorException on string error', async () => {
      alertRepository.createTransaction.mockResolvedValue({ transactionId: 1 } as any);
      alertRepository.createAlert.mockRejectedValue('string error');

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

  // ===================== updateAlert =====================
  describe('updateAlert', () => {
    const updateData = { priority: Priority.URGENT, message: 'Updated' };

    it('updates alert successfully', async () => {
      const updated = { ...mockAlert, ...updateData };
      alertRepository.updateAlert.mockResolvedValue(updated as any);
      loggingOrchestrationService.logActions.mockResolvedValue(undefined as any);

      const result = await service.updateAlert(1, 'user-123', updateData);

      expect(result).toEqual(updated);
      expect(alertRepository.updateAlert).toHaveBeenCalledWith(1, updateData, undefined);
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith({
        userId: 'user-123',
        operation: 'ALERT_UPDATED',
        entityName: AlertService.name,
        actionPerformed: '1 - Triaged by user user-123',
        outcome: Outcome.SUCCESS,
      });
    });

    it('passes transaction client to repository', async () => {
      const tx = {} as any;
      alertRepository.updateAlert.mockResolvedValue({ ...mockAlert } as any);
      loggingOrchestrationService.logActions.mockResolvedValue(undefined as any);

      await service.updateAlert(1, 'user-123', updateData, tx);

      expect(alertRepository.updateAlert).toHaveBeenCalledWith(1, updateData, tx);
    });

    it('throws InternalServerErrorException on Error', async () => {
      alertRepository.updateAlert.mockRejectedValue(new Error('Update failed'));

      await expect(service.updateAlert(1, 'user-123', updateData)).rejects.toThrow(InternalServerErrorException);
      expect(loggerService.error).toHaveBeenCalledWith(
        'Error updating alert 1: Update failed',
        expect.any(String),
        AlertService.name,
      );
    });

    it('throws InternalServerErrorException on string error', async () => {
      alertRepository.updateAlert.mockRejectedValue('string error');

      await expect(service.updateAlert(1, 'user-123', updateData)).rejects.toThrow(InternalServerErrorException);
      expect(loggerService.error).toHaveBeenCalledWith(
        'Error updating alert 1: string error',
        undefined,
        AlertService.name,
      );
    });
  });

  // ===================== handleAlertOrNALT =====================
  describe('handleAlertOrNALT', () => {
    it('creates NALT alert when report status is NALT', async () => {
      const naltDto: any = { ...mockIngestAlertDto, report: { status: 'NALT', id: '123' } };
      alertRepository.createTransaction.mockResolvedValue({ transactionId: 1 } as any);
      alertRepository.createAlert.mockResolvedValue(mockAlert);

      const result = await service.handleAlertOrNALT(naltDto, 'user-123', 'tenant-123', 'test-source');

      expect(result).toEqual(mockAlert);
      expect(alertRepository.createAlert).toHaveBeenCalledWith(expect.objectContaining({ caseId: 0 }));
    });

    it('creates case and alert when report status is ALRT', async () => {
      configService.get.mockReturnValue('system-uuid');
      caseCreationService.createCase.mockResolvedValue(mockCase as any);
      alertRepository.createTransaction.mockResolvedValue({ transactionId: 1 } as any);
      alertRepository.createAlert.mockResolvedValue(mockAlert);

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
        'SUPERVISOR',
      );
      expect(alertRepository.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({ caseId: mockCase.case_id }),
      );
    });

    it('falls back to userId when SYSTEM_UUID not configured', async () => {
      configService.get.mockReturnValue('user-123');
      caseCreationService.createCase.mockResolvedValue(mockCase as any);
      alertRepository.createTransaction.mockResolvedValue({ transactionId: 1 } as any);
      alertRepository.createAlert.mockResolvedValue(mockAlert);

      await service.handleAlertOrNALT(mockIngestAlertDto, 'user-123', 'tenant-123', 'test-source');

      expect(configService.get).toHaveBeenCalledWith('SYSTEM_UUID', 'user-123');
      expect(caseCreationService.createCase).toHaveBeenCalledWith(
        expect.objectContaining({ caseCreatorUserId: 'user-123' }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  // ===================== getAlertTransactionalData =====================
  describe('getAlertTransactionalData', () => {
    const mockReferenceIdData = {
      id: 1,
      txTp: 'pacs.002.001.12',
      referenceIdName: 'EndToEndId',
      createdAt: new Date(),
    };

    const mockTransactionData = {
      status: 'success',
      code: 200,
      table: 'transaction_detail',
      row_count: 2,
      data: [
        {
          pk: 'pk-1',
          transaction_id: 500356,
          end_to_end_id: 'tx-123',
          tenant_id: 'DEFAULT',
          tx_type: 'pacs.002.001.12',
        },
        {
          pk: 'pk-2',
          transaction_id: 500356,
          end_to_end_id: 'tx-123',
          tenant_id: 'DEFAULT',
          tx_type: 'pacs.008.001.10',
        },
      ],
    };

    it('returns transaction data for valid alert', async () => {
      alertRepository.getAlertById.mockResolvedValue(mockAlert);
      alertRepository.getReferenceId.mockResolvedValue(mockReferenceIdData as any);
      goldLakehouseService.runSqlQuery.mockResolvedValue(mockTransactionData as any);

      const result = await service.getAlertTransactionalData(1);

      expect(result).toEqual({ transactionData: mockTransactionData });
      expect(alertRepository.getReferenceId).toHaveBeenCalledWith('pacs.002.001.12');
      expect(goldLakehouseService.runSqlQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * from transaction_detail where end_to_end_id = 'tx-123'"),
        1000,
      );
    });

    it('throws when alert not found', async () => {
      alertRepository.getAlertById.mockResolvedValue(null);

      await expect(service.getAlertTransactionalData(1)).rejects.toThrow(InternalServerErrorException);
    });

    it('throws when referenceId not in transaction', async () => {
      const alertNoRef = { ...mockAlert, transaction: { TxTp: 'pacs.002.001.12' } };
      alertRepository.getAlertById.mockResolvedValue(alertNoRef);
      alertRepository.getReferenceId.mockResolvedValue(mockReferenceIdData as any);

      await expect(service.getAlertTransactionalData(1)).rejects.toThrow('ReferenceId not found in transaction data');
    });

    it('throws when goldLakehouseService returns data without data property', async () => {
      alertRepository.getAlertById.mockResolvedValue(mockAlert);
      alertRepository.getReferenceId.mockResolvedValue(mockReferenceIdData as any);
      goldLakehouseService.runSqlQuery.mockResolvedValue({ status: 'success', code: 200 } as any);

      await expect(service.getAlertTransactionalData(1)).rejects.toThrow(InternalServerErrorException);
    });

    it('throws when goldLakehouseService returns null data', async () => {
      alertRepository.getAlertById.mockResolvedValue(mockAlert);
      alertRepository.getReferenceId.mockResolvedValue(mockReferenceIdData as any);
      goldLakehouseService.runSqlQuery.mockResolvedValue({ data: null } as any);

      await expect(service.getAlertTransactionalData(1)).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ===================== getAlertDetails =====================
  describe('getAlertDetails', () => {
    it('returns sanitized alert for matching tenant', async () => {
      alertRepository.getAlertById.mockResolvedValue(mockAlert);

      const result = await service.getAlertDetails(1, 'tenant-123', 'user-123');

      expect(result).not.toHaveProperty('tenant_id');
      expect(result).toHaveProperty('alert_id', 1);
      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('Alert 1 opened by user user-123'),
        AlertService.name,
      );
    });

    it('throws NotFoundException when alert not found', async () => {
      alertRepository.getAlertById.mockResolvedValue(null);

      await expect(service.getAlertDetails(1, 'tenant-123', 'user-123')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when tenant does not match', async () => {
      alertRepository.getAlertById.mockResolvedValue({ ...mockAlert, tenant_id: 'other-tenant' });

      await expect(service.getAlertDetails(1, 'tenant-123', 'user-123')).rejects.toThrow(NotFoundException);
    });

    it('throws InternalServerErrorException on repository Error', async () => {
      alertRepository.getAlertById.mockRejectedValue(new Error('DB error'));

      await expect(service.getAlertDetails(1, 'tenant-123', 'user-123')).rejects.toThrow(InternalServerErrorException);
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  // ===================== getAlertActionHistory =====================
  describe('getAlertActionHistory', () => {
    const mockHistory = [
      {
        event_log_id: 1,
        user_id: 'user-123',
        operation: 'CREATED',
        entity_name: 'AlertService',
        action_performed: 'created',
        outcome: 'SUCCESS',
        performed_at: new Date(),
      },
    ];

    it('returns action history for valid alert', async () => {
      alertRepository.getAlertById.mockResolvedValue(mockAlert);
      eventLogService.getActionHistoryForAlert.mockResolvedValue(mockHistory as any);

      const result = await service.getAlertActionHistory(1, 'tenant-123', 'user-123');

      expect(result).toEqual({ alertId: 1, tenantId: 'tenant-123', userId: 'user-123', history: mockHistory });
      expect(eventLogService.getActionHistoryForAlert).toHaveBeenCalledWith(1);
    });

    it('throws NotFoundException when alert not found', async () => {
      alertRepository.getAlertById.mockResolvedValue(null);

      await expect(service.getAlertActionHistory(1, 'tenant-123', 'user-123')).rejects.toThrow(NotFoundException);
    });

    it('returns empty history when no actions found', async () => {
      alertRepository.getAlertById.mockResolvedValue(mockAlert);
      eventLogService.getActionHistoryForAlert.mockResolvedValue([] as any);

      const result = await service.getAlertActionHistory(1, 'tenant-123', 'user-123');

      expect(result.history).toEqual([]);
    });
  });
});
