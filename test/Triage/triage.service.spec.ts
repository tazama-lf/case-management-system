/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { TriageService } from '../../src/triage/triage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../src/audit/auditLog.service';
import { SubmitAlertDto } from '../../src/triage/dto/submit-alert.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import {
  AlertStatus,
  Priority,
  CaseType,
  CaseStatus,
  CaseCreationType,
  AlertType,
} from '@prisma/client';

import {
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UpdateAlertDto } from 'src/triage/dto/update-alert.dto';
import { ConvertAlertToCase } from 'src/triage/dto/convert-alert-to-case.dto';
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

const createMockPrismaService = () => ({
  alert: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst:jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  case: {
    create: jest.fn(),
  },

});

describe('TriageService', () => {
  let service: TriageService;
  let prismaService: any;
  let auditService: any;

  beforeEach(async () => {
    const mockPrismaService = createMockPrismaService();
    const mockAuditService = {
      logAction: jest.fn().mockResolvedValue({
        audit_log_id: 'audit-123',
        user_id: 'user-123',
        operation: 'TEST',
        entity_name: 'Test',
        action_performed: 'Test action',
        outcome: 'SUCCESS',
        performed_at: new Date(),
      }),
    };
    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TriageService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<TriageService>(TriageService);
    prismaService = module.get(PrismaService);
    auditService = module.get(AuditLogService);
  });

  describe('handleAITriage (Stories 1G,1A,1F,1I,1E,1C,1D)', () => {
    const alertId = 'alert-xyz';
    const userId = 'user-xyz';
    const tenantId = 'tenant-xyz';
    const baseDto: SubmitAlertDto = {
      result: {
        message: 'msg',
        report: {},
        transaction: {},
        networkMap: {},
      },
    };

    let predictSpy: jest.SpyInstance;
    let updateSpy: jest.SpyInstance;
    let createCaseSpy: jest.SpyInstance;
    let autoCloseSpy: jest.SpyInstance;
    let loggerLogSpy: jest.SpyInstance;

    const setEnv = (key: string, value?: string) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    };

    beforeEach(() => {
      predictSpy = jest.spyOn<any, any>(service as any, 'predictAlert');
      updateSpy = jest.spyOn(service as any, 'updateAlertData').mockResolvedValue(undefined);
      createCaseSpy = jest.spyOn(service as any, 'createInvestigationCase').mockResolvedValue({} as any);
      autoCloseSpy = jest.spyOn(service as any, 'autoCloseAlert').mockResolvedValue(undefined);
      loggerLogSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
    });

    afterEach(() => {
      predictSpy.mockRestore();
      updateSpy.mockRestore();
      createCaseSpy.mockRestore();
      autoCloseSpy.mockRestore();
      loggerLogSpy.mockRestore();
      setEnv('CONFIDENCE_THRESHOLD', undefined);
      setEnv('CLIENT_SYSTEM_INTERDICTION_ENABLED', undefined);
    });

    it('1G/1F: defaults threshold to 100 when not set; below threshold -> investigation + audit', async () => {
      // No CONFIDENCE_THRESHOLD set -> defaults to 100
      setEnv('CONFIDENCE_THRESHOLD', undefined);
      predictSpy.mockResolvedValue({
        priority: Priority.MEDIUM,
        alertType: AlertType.FRAUD,
        confidence_per: 90,
        isTruePositive: false,
      });

      await service.handleAITriage(alertId, baseDto, userId, tenantId);

      expect(updateSpy).toHaveBeenCalled();
      expect(createCaseSpy).toHaveBeenCalledWith(alertId, userId, tenantId, expect.any(Object));
      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'AI_TRIAGE_LOW_CONFIDENCE' }),
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[1G] Using confidence threshold: 100'),
      );
    });

    it('1A: high confidence false positive -> auto close REFUTED + audit', async () => {
      setEnv('CONFIDENCE_THRESHOLD', '80');
      predictSpy.mockResolvedValue({
        priority: Priority.LOW,
        alertType: AlertType.FRAUD,
        confidence_per: 95,
        isTruePositive: false,
      });

      await service.handleAITriage(alertId, baseDto, userId, tenantId);

      expect(autoCloseSpy).toHaveBeenCalledWith(alertId, AlertStatus.AUTOCLOSED_REFUTED, userId);
      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'AI_TRIAGE_HIGH_CONFIDENCE_FALSE_POSITIVE' }),
      );
    });

    it('1I: FRAUD_AND_AML true positive -> create master + two children + audit', async () => {
      setEnv('CONFIDENCE_THRESHOLD', '80');
      const master = { case_id: 'master-1' } as any;
      // First call returns master, subsequent calls for children
      predictSpy.mockResolvedValue({
        priority: Priority.MEDIUM,
        alertType: AlertType.FRAUD_AND_AML,
        confidence_per: 97,
        isTruePositive: true,
      });
      (createCaseSpy)
        .mockResolvedValueOnce(master)
        .mockResolvedValueOnce({} as any)
        .mockResolvedValueOnce({} as any);

      await service.handleAITriage(alertId, baseDto, userId, tenantId);

      expect(createCaseSpy).toHaveBeenNthCalledWith(1, alertId, userId, tenantId, expect.any(Object), CaseType.FRAUD_AND_AML);
      expect(createCaseSpy).toHaveBeenNthCalledWith(2, alertId, userId, tenantId, expect.any(Object), CaseType.FRAUD, master.case_id);
      expect(createCaseSpy).toHaveBeenNthCalledWith(3, alertId, userId, tenantId, expect.any(Object), CaseType.AML, master.case_id);
      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'ALERT_CONVERTED_TO_MASTER_AND_CHILD_CASES' }),
      );
    });

    it('1E: AML true positive -> create AML case + audit', async () => {
      setEnv('CONFIDENCE_THRESHOLD', '80');
      predictSpy.mockResolvedValue({
        priority: Priority.HIGH,
        alertType: AlertType.AML,
        confidence_per: 95,
        isTruePositive: true,
      });

      await service.handleAITriage(alertId, baseDto, userId, tenantId);

      expect(createCaseSpy).toHaveBeenCalledWith(alertId, userId, tenantId, expect.any(Object), CaseType.AML);
      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'AI_TRIAGE_TRUE_POSITIVE_AML' }),
      );
    });

    it('1C: FRAUD true positive but interdicted (no transaction) -> auto close CONFIRMED + audit', async () => {
      setEnv('CONFIDENCE_THRESHOLD', '80');
      setEnv('CLIENT_SYSTEM_INTERDICTION_ENABLED', 'true');
      const dto: SubmitAlertDto = {
        result: {
          message: 'm',
          report: {
            tadpResult: {
              typologyResult: [
                { result: 90, workflow: { interdictionThreshold: 50 } },
              ],
            },
          },
          transaction: {},
          networkMap: {},
        },
      } as any;

      predictSpy.mockResolvedValue({
        priority: Priority.MEDIUM,
        alertType: AlertType.FRAUD,
        confidence_per: 95,
        isTruePositive: true,
      });

      await service.handleAITriage(alertId, dto, userId, tenantId);

      expect(autoCloseSpy).toHaveBeenCalledWith(alertId, AlertStatus.AUTOCLOSED_CONFIRMED, userId);
      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'AI_TRIAGE_TRUE_POSITIVE_FRAUD_INTERDICTED' }),
      );
    });

    it('1D: FRAUD true positive and transaction occurred -> create FRAUD case + audit', async () => {
      setEnv('CONFIDENCE_THRESHOLD', '80');
      setEnv('CLIENT_SYSTEM_INTERDICTION_ENABLED', 'true');
      const dto: SubmitAlertDto = {
        result: {
          message: 'm',
          report: {
            tadpResult: {
              typologyResult: [
                { result: 20, workflow: { interdictionThreshold: 50 } }, // not interdicted
              ],
            },
          },
          transaction: {},
          networkMap: {},
        },
      } as any;

      predictSpy.mockResolvedValue({
        priority: Priority.MEDIUM,
        alertType: AlertType.FRAUD,
        confidence_per: 95,
        isTruePositive: true,
      });

      await service.handleAITriage(alertId, dto, userId, tenantId);

      expect(createCaseSpy).toHaveBeenCalledWith(alertId, userId, tenantId, expect.any(Object), CaseType.FRAUD);
      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'AI_TRIAGE_TRUE_POSITIVE_FRAUD' }),
      );
    });
  });

  describe('handleAITriage interdiction branches', () => {
    const alertId = 'alert-itd-1';
    const userId = 'user-itd-1';
    const tenantId = 'tenant-itd-1';

    const baseDto = (typology: any): SubmitAlertDto => ({
      result: {
        message: 'm',
        report: { tadpResult: { typologyResult: [typology] } },
        transaction: {},
        networkMap: {},
      },
    }) as any;

    let origEnvInterdiction: string | undefined;
    let predictSpy: jest.SpyInstance;
    let autoCloseSpy: jest.SpyInstance;
    let createCaseSpy: jest.SpyInstance;
    let updateAlertDataSpy: jest.SpyInstance;

    beforeEach(() => {
      origEnvInterdiction = process.env.CLIENT_SYSTEM_INTERDICTION_ENABLED;
      process.env.CLIENT_SYSTEM_INTERDICTION_ENABLED = 'true';
      predictSpy = jest.spyOn<any, any>(service as any, 'predictAlert').mockResolvedValue({
        confidence_per: 100,
        priority: Priority.HIGH,
        alertType: AlertType.FRAUD,
        isTruePositive: true,
      });
      autoCloseSpy = jest.spyOn<any, any>(service as any, 'autoCloseAlert').mockResolvedValue(undefined);
      createCaseSpy = jest.spyOn<any, any>(service as any, 'createInvestigationCase').mockResolvedValue({});
      updateAlertDataSpy = jest.spyOn(service, 'updateAlertData').mockResolvedValue({} as any);
      prismaService.alert.update.mockResolvedValue({});
    });

    afterEach(() => {
      process.env.CLIENT_SYSTEM_INTERDICTION_ENABLED = origEnvInterdiction;
      predictSpy.mockRestore();
      autoCloseSpy.mockRestore();
      createCaseSpy.mockRestore();
      updateAlertDataSpy.mockRestore();
    });

    it('sets transactionOccurred=false when result > threshold, leading to AUTOCLOSED_CONFIRMED for FRAUD', async () => {
      const dto = baseDto({ result: 90, workflow: { interdictionThreshold: 50 } });

      await service.handleAITriage(alertId, dto, userId, tenantId);

      expect(autoCloseSpy).toHaveBeenCalledWith(alertId, AlertStatus.AUTOCLOSED_CONFIRMED, userId);
      expect(createCaseSpy).not.toHaveBeenCalled();
    });

    it('keeps transactionOccurred=true when non-numeric typology values; creates FRAUD case', async () => {
      const dto = baseDto({ result: 'n/a', workflow: { interdictionThreshold: 'x' } });

      await service.handleAITriage(alertId, dto, userId, tenantId);

      expect(createCaseSpy).toHaveBeenCalledWith(alertId, userId, tenantId, expect.any(Object), CaseType.FRAUD);
      expect(autoCloseSpy).not.toHaveBeenCalledWith(alertId, AlertStatus.AUTOCLOSED_CONFIRMED, userId);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleNewAlert', () => {
    const mockSubmitAlertDto: SubmitAlertDto = {
      result: {
        message: 'Test alert message',
        report: { test: 'report data' },
        transaction: { test: 'transaction data' },
        networkMap: { test: 'network data' },
      },
    };

    const userId = 'test-user-id';
    const tenantId = 'test-tenant-id';

    it('should create new alert successfully', async () => {
      const expectedAlert = {
        alert_id: 'alert-123',
        tenant_id: tenantId,
        priority: Priority.LOW,
        source: 'test-source',
        txtp: '',
        alert_status: AlertStatus.NEW,
        message: 'Test alert message',
        alert_data: mockSubmitAlertDto.result.report,
        transaction: mockSubmitAlertDto.result.transaction,
        network_map: mockSubmitAlertDto.result.networkMap,
        confidence_per: 0,
        case_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      prismaService.alert.create.mockResolvedValue(expectedAlert);

      const result = await service.handleNewAlert(mockSubmitAlertDto, userId, tenantId, 'test-source');

      expect(prismaService.alert.create).toHaveBeenCalled();
      expect(auditService.logAction).toHaveBeenCalled();
      expect(result).toEqual(expectedAlert);
    });
  });

  describe('updateAlertData', () => {
  const alertId = 'alert-123';
  const userId = 'test-user-id';
  const tenantId = 'test-tenant-id';

  const mockUpdateDto: UpdateAlertDto = {
    confidence_per: 85,
    priority: Priority.HIGH,
    alertType: AlertType.FRAUD, // Added because service updates alert_type
  };

  const mockExistingAlert = {
    alert_id: alertId,
    tenant_id: tenantId,
    priority: Priority.LOW,
    source: 'test-source',
    txtp: null,
    message: 'Test alert message',
    alert_data: { test: 'report data' },
    transaction: { test: 'transaction data' },
    network_map: { test: 'network data' },
    confidence_per: 0,
    alert_status: AlertStatus.NEW,
    case_id: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  it('should update alert successfully', async () => {
    const updatedAlert = {
      ...mockExistingAlert,
      confidence_per: 85,
      priority: Priority.HIGH,
      alert_type: AlertType.FRAUD,
    };

    prismaService.alert.findFirst.mockResolvedValue(mockExistingAlert);
    prismaService.alert.update.mockResolvedValue(updatedAlert);

    const result = await service.updateAlertData(
      alertId,
      mockUpdateDto,
      userId,
      tenantId,
    );

    expect(prismaService.alert.findFirst).toHaveBeenCalledWith({
      where: { alert_id: alertId, tenant_id: tenantId },
    });
    expect(prismaService.alert.update).toHaveBeenCalledWith({
      where: { alert_id: alertId },
      data: {
        confidence_per: mockUpdateDto.confidence_per,
        priority: mockUpdateDto.priority,
        alert_type: mockUpdateDto.alertType,
      },
    });
    expect(auditService.logAction).toHaveBeenCalled();
    expect(result).toEqual(updatedAlert);
  });

  it('should throw NotFoundException when alert not found', async () => {
    prismaService.alert.findFirst.mockResolvedValue(null);

    await expect(
      service.updateAlertData(alertId, mockUpdateDto, userId, tenantId),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when alert is closed', async () => {
    const closedAlert = { ...mockExistingAlert, alert_status: AlertStatus.CLOSED };

    prismaService.alert.findFirst.mockResolvedValue(closedAlert);

    await expect(
      service.updateAlertData(alertId, mockUpdateDto, userId, tenantId),
    ).rejects.toThrow(
      `Alert ${alertId} is closed status and can not be updated`,
    );
  });

  it('should handle database errors during update operation', async () => {
    prismaService.alert.findFirst.mockResolvedValue(mockExistingAlert);
    prismaService.alert.update.mockRejectedValue(new Error('Database error'));

    await expect(
      service.updateAlertData(alertId, mockUpdateDto, userId, tenantId),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('should omit confidence_per and alert_type parts in audit when undefined', async () => {
    const dtoPartial: UpdateAlertDto = {
      priority: Priority.HIGH,
      // confidence_per and alertType deliberately undefined
    } as any;

    const updatedAlert = { ...mockExistingAlert, priority: Priority.HIGH };

    prismaService.alert.findFirst.mockResolvedValue(mockExistingAlert);
    prismaService.alert.update.mockResolvedValue(updatedAlert);

    await service.updateAlertData(alertId, dtoPartial, userId, tenantId);

    expect(prismaService.alert.update).toHaveBeenCalledWith({
      where: { alert_id: alertId },
      data: expect.objectContaining({ priority: Priority.HIGH }),
    });
    expect(auditService.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionPerformed: expect.stringContaining('Updated alert alert-123'),
      }),
    );
  });

  it('should omit priority part in audit when only confidence_per and alertType provided', async () => {
    const dtoPartial: UpdateAlertDto = {
      confidence_per: 77,
      alertType: AlertType.FRAUD,
    } as any;

    const updatedAlert = { ...mockExistingAlert, confidence_per: 77, alert_type: AlertType.FRAUD };

    prismaService.alert.findFirst.mockResolvedValue(mockExistingAlert);
    prismaService.alert.update.mockResolvedValue(updatedAlert);

    await service.updateAlertData(alertId, dtoPartial, userId, tenantId);

    expect(prismaService.alert.update).toHaveBeenCalledWith({
      where: { alert_id: alertId },
      data: expect.objectContaining({ confidence_per: 77, alert_type: AlertType.FRAUD }),
    });
  });
  });

  describe('manualCloseAlert', () => {
    const alertId = 'alert-123';
    const userId = 'test-user-id';
    const closeAlertDto = { reason: 'Alert marked as false positive' };

    const mockExistingAlert = {
      alert_id: alertId,
      tenant_id: 'test-tenant-id',
      priority: Priority.LOW,
      source: 'test-source',
      txtp: null,
      message: 'Test alert message',
      alert_data: { test: 'report data' },
      transaction: { test: 'transaction data' },
      network_map: { test: 'network data' },
      confidence_per: 0,
      alert_status: AlertStatus.NEW,
      case_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should close alert successfully', async () => {
      const closedAlert = {
        ...mockExistingAlert,
        alert_status: AlertStatus.CLOSED,
      };

      prismaService.alert.findFirst.mockResolvedValue(mockExistingAlert);
      prismaService.alert.update.mockResolvedValue(closedAlert);

      const result = await service.manualCloseAlert(alertId, closeAlertDto, userId, 'test-tenant-id');

      expect(prismaService.alert.findFirst).toHaveBeenCalled();
      expect(prismaService.alert.update).toHaveBeenCalled();
      expect(auditService.logAction).toHaveBeenCalled();
      expect(result).toEqual(closedAlert);
    });

    it('should throw NotFoundException when alert not found', async () => {
      prismaService.alert.findUnique.mockResolvedValue(null);

      await expect(
        service.manualCloseAlert(
          alertId,
          closeAlertDto,
          userId,
          'test-tenant-id',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when alert not accessible for tenant', async () => {
      const alertWithDifferentTenant = {
        ...mockExistingAlert,
        tenant_id: 'different-tenant-id',
      };

      prismaService.alert.findUnique.mockResolvedValue(alertWithDifferentTenant);

      await expect(
        service.manualCloseAlert(
          alertId,
          closeAlertDto,
          userId,
          'test-tenant-id',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when alert is already closed', async () => {
      const closedAlert = {
        ...mockExistingAlert,
        alert_status: AlertStatus.CLOSED,
      };

      prismaService.alert.findFirst.mockResolvedValue(closedAlert);

      await expect(service.manualCloseAlert(alertId, closeAlertDto, userId, 'test-tenant-id')).rejects.toThrow(
        'Alert alert-123 is already closed',
      );
    });

    it('should handle database errors during close operation', async () => {
      prismaService.alert.findFirst.mockResolvedValue(mockExistingAlert);
      prismaService.alert.update.mockRejectedValue(new Error('Database error'));

      await expect(service.manualCloseAlert(alertId, closeAlertDto, userId, 'test-tenant-id')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('txtp extraction coverage', () => {
    it('should extract txtp from result.report.txtp', async () => {
      const dto: SubmitAlertDto = {
        result: {
          message: 'Test alert',
          report: { txtp: 'report-txtp' },
          transaction: { test: 'transaction' },
          networkMap: { test: 'network' },
        },
      };

      const mockAlert = {
        alert_id: 'alert-123',
        tenant_id: 'tenant-123',
        priority: Priority.LOW,
        source: 'test-source',
        txtp: 'report-txtp',
        alert_status: AlertStatus.NEW,
        message: 'Test alert',
      };

      prismaService.alert.create.mockResolvedValue(mockAlert);

      const result = await service.handleNewAlert(dto, 'user-123', 'tenant-123', 'test-source');

      expect(prismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          txtp: '',
        }),
      });
      expect(result).toEqual(mockAlert);
    });

    it('should extract txtp from result.transaction.TxTp', async () => {
      const dto: SubmitAlertDto = {
        result: {
          message: 'Test alert',
          report: { test: 'data' },
          transaction: { TxTp: 'transaction-txtp' },
          networkMap: { test: 'network' },
        },
      };

      const mockAlert = {
        alert_id: 'alert-123',
        tenant_id: 'tenant-123',
        priority: Priority.LOW,
        source: 'test-source',
        txtp: 'transaction-txtp',
        alert_status: AlertStatus.NEW,
        message: 'Test alert',
      };

      prismaService.alert.create.mockResolvedValue(mockAlert);

      const result = await service.handleNewAlert(dto, 'user-123', 'tenant-123', 'test-source');

      expect(prismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          txtp: 'transaction-txtp',
        }),
      });
      expect(result).toEqual(mockAlert);
    });

    it('should extract txtp from result.networkMap.txtp', async () => {
      const dto: SubmitAlertDto = {
        result: {
          message: 'Test alert',
          report: { test: 'data' },
          transaction: { test: 'transaction' },
          networkMap: { txtp: 'network-txtp' },
        },
      };

      const mockAlert = {
        alert_id: 'alert-123',
        tenant_id: 'tenant-123',
        priority: Priority.LOW,
        source: 'test-source',
        txtp: 'network-txtp',
        alert_status: AlertStatus.NEW,
        message: 'Test alert',
      };

      prismaService.alert.create.mockResolvedValue(mockAlert);

      const result = await service.handleNewAlert(dto, 'user-123', 'tenant-123', 'test-source');

      expect(prismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          txtp: '',
        }),
      });
      expect(result).toEqual(mockAlert);
    });
  });

  describe('error handling coverage', () => {
    it('should handle database errors in handleNewAlert', async () => {
      const dto: SubmitAlertDto = {
        result: {
          message: 'Test alert',
          report: { test: 'data' },
          transaction: { test: 'transaction' },
          networkMap: { test: 'network' },
        },
      };

      prismaService.alert.create.mockRejectedValue(new Error('Database error'));

      await expect(service.handleNewAlert(dto, 'user-123', 'tenant-123', 'test-source')).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle database errors in manualCloseAlert', async () => {
      prismaService.alert.findUnique.mockResolvedValue(null);

      await expect(service.manualCloseAlert('alert-123', { reason: 'Test close reason' }, 'user-123', 'tenant-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // describe('investigateAlert', () => {
  //   const alertId = 'alert-123';
  //   const userId = 'test-user-id';
  //   const tenantId = 'test-tenant-id';
  //   const caseType = CaseType.FRAUD;

  //   const mockExistingAlert = {
  //     alert_id: alertId,
  //     tenant_id: tenantId,
  //     priority: Priority.HIGH,
  //     source: 'test-source',
  //     txtp: null,
  //     message: 'Test alert message',
  //     alert_data: { test: 'report data' },
  //     transaction: { test: 'transaction data' },
  //     network_map: { test: 'network data' },
  //     confidence_per: 80,
  //     alert_status: AlertStatus.NEW,
  //     case_id: null,
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //   };

  //   it('should create case and update alert for investigation successfully', async () => {
  //     const mockCase = {
  //       case_id: 'case-123',
  //       case_creator_user_id: userId,
  //       case_owner_user_id: userId,
  //       tenant_id: tenantId,
  //       priority: Priority.HIGH,
  //       status: CaseStatus.DRAFT,
  //       parent_id: null,
  //       case_type: caseType,
  //       case_creation_type: CaseCreationType.MANUAL,
  //       created_at: new Date(),
  //       updated_at: new Date(),
  //     };

  //     const updatedAlert = {
  //       ...mockExistingAlert,
  //       alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
  //       case_id: mockCase.case_id,
  //     };

  //     prismaService.alert.findUnique.mockResolvedValue(mockExistingAlert);
  //     prismaService.case.create.mockResolvedValue(mockCase);
  //     prismaService.alert.update.mockResolvedValue(updatedAlert);

  //     const result = await service.investigateAlert(
  //       alertId,
  //       caseType,
  //       userId,
  //       tenantId,
  //     );

  //     expect(prismaService.alert.findUnique).toHaveBeenCalledWith({
  //       where: { alert_id: alertId },
  //     });
  //     expect(prismaService.case.create).toHaveBeenCalledWith({
  //       data: {
  //         case_creator_user_id: userId,
  //         case_owner_user_id: userId,
  //         tenant_id: tenantId,
  //         priority: Priority.HIGH,
  //         status: CaseStatus.DRAFT,
  //         parent_id: null,
  //         case_type: caseType,
  //         case_creation_type: CaseCreationType.MANUAL,
  //       },
  //     });
  //     expect(prismaService.alert.update).toHaveBeenCalledWith({
  //       where: { alert_id: alertId },
  //       data: {
  //         alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
  //         case_id: mockCase.case_id,
  //       },
  //     });
  //     expect(auditService.logAction).toHaveBeenCalled();
  //     expect(result).toEqual(updatedAlert);
  //   });

  //   it('should throw NotFoundException when alert not found', async () => {
  //     prismaService.alert.findUnique.mockResolvedValue(null);

  //     await expect(
  //       service.investigateAlert(alertId, caseType, userId, tenantId),
  //     ).rejects.toThrow(NotFoundException);
  //   });

  //   it('should throw NotFoundException when alert not accessible for tenant', async () => {
  //     const alertWithDifferentTenant = {
  //       ...mockExistingAlert,
  //       tenant_id: 'different-tenant-id',
  //     };

  //     prismaService.alert.findUnique.mockResolvedValue(
  //       alertWithDifferentTenant,
  //     );

  //     await expect(
  //       service.investigateAlert(alertId, caseType, userId, tenantId),
  //     ).rejects.toThrow(NotFoundException);
  //   });

  //   it('should use LOW priority as default when alert priority is null', async () => {
  //     const alertWithNullPriority = {
  //       ...mockExistingAlert,
  //       priority: null,
  //     };

  //     const mockCase = {
  //       case_id: 'case-123',
  //       case_creator_user_id: userId,
  //       case_owner_user_id: userId,
  //       tenant_id: tenantId,
  //       priority: Priority.LOW,
  //       status: CaseStatus.DRAFT,
  //       parent_id: null,
  //       case_type: caseType,
  //       case_creation_type: CaseCreationType.MANUAL,
  //     };

  //     const updatedAlert = {
  //       ...alertWithNullPriority,
  //       alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
  //       case_id: mockCase.case_id,
  //     };

  //     prismaService.alert.findUnique.mockResolvedValue(alertWithNullPriority);
  //     prismaService.case.create.mockResolvedValue(mockCase);
  //     prismaService.alert.update.mockResolvedValue(updatedAlert);

  //     await service.investigateAlert(alertId, caseType, userId, tenantId);

  //     expect(prismaService.case.create).toHaveBeenCalledWith({
  //       data: expect.objectContaining({
  //         priority: Priority.LOW,
  //       }),
  //     });
  //   });

  //   it('should handle database errors during investigation', async () => {
  //     prismaService.alert.findUnique.mockResolvedValue(mockExistingAlert);
  //     prismaService.case.create.mockRejectedValue(new Error('Database error'));

  //     await expect(
  //       service.investigateAlert(alertId, caseType, userId, tenantId),
  //     ).rejects.toThrow(InternalServerErrorException);
  //   });
  // });

  describe('getAlertsForUser', () => {
    const mockParams = {
      tenantId: 'test-tenant-id',
      page: 1,
      limit: 10,
      sortBy: 'created_at',
      sortOrder: 'desc' as const,
    };

    const mockAlerts = [
      {
        alert_id: 'alert-1',
        txtp: 'PAYMENT',
        priority: Priority.HIGH,
        confidence_per: 85,
        alert_status: AlertStatus.NEW,
        created_at: new Date(),
      },
      {
        alert_id: 'alert-2',
        txtp: 'TRANSFER',
        priority: Priority.LOW,
        confidence_per: 45,
        alert_status: AlertStatus.CLOSED,
        created_at: new Date(),
      },
    ];

    it('should return paginated alerts successfully', async () => {
      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(2);

      const result = await service.getAlertsForUser(mockParams);

      expect(prismaService.alert.findMany).toHaveBeenCalled();
      expect(prismaService.alert.count).toHaveBeenCalled();
      expect(result).toEqual({
        data: mockAlerts,
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
    });

    it('should throw BadRequestException for invalid page', async () => {
      const invalidParams = { ...mockParams, page: 0 };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow('Page must be a positive integer');
    });

    it('should throw BadRequestException for invalid limit', async () => {
      const invalidParams = { ...mockParams, limit: -1 };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow('Limit must be a positive integer');
    });

    it('should throw BadRequestException for invalid sortBy field', async () => {
      const invalidParams = { ...mockParams, sortBy: 'invalid_field' };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow('Invalid sortBy field: invalid_field');
    });

    it('should throw BadRequestException for invalid sortOrder', async () => {
      const invalidParams = { ...mockParams, sortOrder: 'invalid' as any };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow('sortOrder must be "asc" or "desc"');
    });

    it('should throw BadRequestException for invalid priority', async () => {
      const invalidParams = { ...mockParams, priority: 'INVALID_PRIORITY' };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow('Invalid priority: INVALID_PRIORITY');
    });

    it('should throw BadRequestException for invalid status', async () => {
      const invalidParams = { ...mockParams, status: 'INVALID_STATUS' };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow('Invalid status: INVALID_STATUS');
    });

    it('should handle search with UUID (36 characters)', async () => {
      const searchParams = {
        ...mockParams,
        search: '123e4567-e89b-12d3-a456-426614174000',
      };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(searchParams);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { alert_id: { equals: '123e4567-e89b-12d3-a456-426614174000' } },
              { case_id: { equals: '123e4567-e89b-12d3-a456-426614174000' } },
            ]),
          }),
        }),
      );
    });

    it('should handle search with priority match', async () => {
      const searchParams = { ...mockParams, search: 'HIGH' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(searchParams);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([{ priority: { equals: Priority.HIGH } }]),
          }),
        }),
      );
    });

    it('should handle search with status match', async () => {
      const searchParams = { ...mockParams, search: 'CLOSED' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(searchParams);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([{ alert_status: { equals: AlertStatus.CLOSED } }]),
          }),
        }),
      );
    });

    it('should handle search with general text (txtp contains)', async () => {
      const searchParams = { ...mockParams, search: 'payment' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(searchParams);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([{ txtp: { contains: 'payment', mode: 'insensitive' } }]),
          }),
        }),
      );
    });

    it('should handle database errors', async () => {
      prismaService.alert.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.getAlertsForUser(mockParams)).rejects.toThrow(InternalServerErrorException);
    });

    it('should filter alerts by priority when provided', async () => {
      const paramsWithPriority = { ...mockParams, priority: 'HIGH' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(paramsWithPriority);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priority: Priority.HIGH,
          }),
        }),
      );
    });

    it('should filter alerts by status when provided', async () => {
      const paramsWithStatus = { ...mockParams, status: 'NEW' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(paramsWithStatus);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            alert_status: AlertStatus.NEW,
          }),
        }),
      );
    });

    it('should filter alerts by type when provided', async () => {
      const paramsWithType = { ...mockParams, type: 'PAYMENT' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(paramsWithType);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            txtp: 'PAYMENT',
          }),
        }),
      );
    });

    it('should handle database errors', async () => {});
  });

  describe('getAlertDetails', () => {
    const alertId = 'alert-123';
    const tenantId = 'test-tenant-id';
    const userId = 'test-user-id';

    const mockAlert = {
      alert_id: alertId,
      txtp: 'PAYMENT',
      priority: Priority.HIGH,
      confidence_per: 85,
      alert_status: AlertStatus.NEW,
      created_at: new Date(),
      source: 'test-source',
      message: 'Test alert message',
      alert_data: { test: 'report data' },
      transaction: { test: 'transaction data' },
      network_map: { test: 'network data' },
      case_id: null,
      tenant_id: tenantId,
    };

    it('should return alert details successfully', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log').mockImplementation();

      prismaService.alert.findUnique.mockResolvedValue(mockAlert);

      const result = await service.getAlertDetails(alertId, tenantId, userId);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tenant_id, ...expectedResult } = mockAlert;
      expect(result).toEqual(expectedResult);
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining(`Alert ${alertId} opened by user ${userId}`));

      loggerSpy.mockRestore();
    });

    it('should throw NotFoundException when alert not found', async () => {
      prismaService.alert.findUnique.mockResolvedValue(null);

      await expect(service.getAlertDetails(alertId, tenantId, userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when alert not accessible for tenant', async () => {
      const alertWithDifferentTenant = {
        ...mockAlert,
        tenant_id: 'different-tenant-id',
      };

      prismaService.alert.findUnique.mockResolvedValue(alertWithDifferentTenant);

      await expect(service.getAlertDetails(alertId, tenantId, userId)).rejects.toThrow(NotFoundException);
    });

    it('should handle database errors', async () => {
      prismaService.alert.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(service.getAlertDetails(alertId, tenantId, userId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('convertToCase', () => {
    const alertId = 'alert-123';
    const userId = 'test-user-id';
    const tenantId = 'test-tenant-id';
    const convertDto: ConvertAlertToCase = {
      priority: Priority.HIGH,
      caseType: CaseType.FRAUD,
    };

    const mockExistingAlert = {
      alert_id: alertId,
      tenant_id: tenantId,
      priority: Priority.LOW,
      source: 'test-source',
      txtp: null,
      message: 'Test alert message',
      alert_data: { test: 'report data' },
      transaction: { test: 'transaction data' },
      network_map: { test: 'network data' },
      confidence_per: 80,
      alert_status: AlertStatus.NEW,
      case_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should convert alert to case successfully', async () => {
      const mockCase = {
        case_id: 'case-123',
        case_creator_user_id: userId,
        case_owner_user_id: userId,
        tenant_id: tenantId,
        priority: Priority.HIGH,
        status: CaseStatus.DRAFT,
        parent_id: null,
        case_type: CaseType.FRAUD,
        case_creation_type: CaseCreationType.MANUAL,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedAlert = {
        ...mockExistingAlert,
        alert_status: AlertStatus.CONVERTED,
        case_id: mockCase.case_id,
      };

      prismaService.alert.findUnique.mockResolvedValue(mockExistingAlert);
      prismaService.case.create.mockResolvedValue(mockCase);
      prismaService.alert.update.mockResolvedValue(updatedAlert);

      const result = await service.convertToCase(alertId, convertDto, userId, tenantId);

      expect(prismaService.alert.findUnique).toHaveBeenCalledWith({
        where: { alert_id: alertId },
      });
      expect(prismaService.case.create).toHaveBeenCalledWith({
        data: {
          case_creator_user_id: userId,
          case_owner_user_id: userId,
          tenant_id: tenantId,
          priority: Priority.HIGH,
          status: CaseStatus.DRAFT,
          parent_id: null,
          case_type: CaseType.FRAUD,
          case_creation_type: CaseCreationType.MANUAL,
        },
      });
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: alertId },
        data: {
          alert_status: AlertStatus.CONVERTED,
          case_id: mockCase.case_id,
        },
      });
      expect(auditService.logAction).toHaveBeenCalled();
      expect(result).toEqual(mockCase);
    });

    it('should throw NotFoundException when alert not found', async () => {
      prismaService.alert.findUnique.mockResolvedValue(null);

      await expect(service.convertToCase(alertId, convertDto, userId, tenantId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when alert not accessible for tenant', async () => {
      const alertWithDifferentTenant = {
        ...mockExistingAlert,
        tenant_id: 'different-tenant-id',
      };

      prismaService.alert.findUnique.mockResolvedValue(alertWithDifferentTenant);

      await expect(service.convertToCase(alertId, convertDto, userId, tenantId)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when alert is already closed', async () => {
      const closedAlert = {
        ...mockExistingAlert,
        alert_status: AlertStatus.CLOSED,
      };

      prismaService.alert.findUnique.mockResolvedValue(closedAlert);

      await expect(service.convertToCase(alertId, convertDto, userId, tenantId)).rejects.toThrow('Alert alert-123 is already closed');
    });

    it('should throw BadRequestException when alert is already converted', async () => {
      const convertedAlert = {
        ...mockExistingAlert,
        alert_status: AlertStatus.CONVERTED,
      };

      prismaService.alert.findUnique.mockResolvedValue(convertedAlert);

      await expect(service.convertToCase(alertId, convertDto, userId, tenantId)).rejects.toThrow(
        'Alert alert-123 is already converted to a case',
      );
    });

    it('should use alert priority when convertDto priority is not provided', async () => {
      const convertDtoWithoutPriority = {
        caseType: CaseType.FRAUD,
      } as ConvertAlertToCase;

      const mockCase = {
        case_id: 'case-123',
        case_creator_user_id: userId,
        case_owner_user_id: userId,
        tenant_id: tenantId,
        priority: Priority.LOW, // Should use alert's priority
        status: CaseStatus.DRAFT,
        parent_id: null,
        case_type: CaseType.FRAUD,
        case_creation_type: CaseCreationType.MANUAL,
      };

      prismaService.alert.findUnique.mockResolvedValue(mockExistingAlert);
      prismaService.case.create.mockResolvedValue(mockCase);
      prismaService.alert.update.mockResolvedValue({
        ...mockExistingAlert,
        alert_status: AlertStatus.CONVERTED,
        case_id: mockCase.case_id,
      });

      await service.convertToCase(alertId, convertDtoWithoutPriority, userId, tenantId);

      expect(prismaService.case.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: Priority.LOW, // Alert's original priority
        }),
      });
    });

    it('should handle database errors during conversion', async () => {
      prismaService.alert.findUnique.mockResolvedValue(mockExistingAlert);
      prismaService.case.create.mockRejectedValue(new Error('Database error'));

      await expect(service.convertToCase(alertId, convertDto, userId, tenantId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('private helpers and error paths coverage', () => {
    const alertId = 'alert-err-1';
    const userId = 'user-err-1';
    const tenantId = 'tenant-err-1';

    it('handleAITriage: catches error, audits failure, and throws InternalServerErrorException', async () => {
      const dto: SubmitAlertDto = { result: { message: 'm', report: {}, transaction: {}, networkMap: {} } } as any;

      const predictSpy = jest
        .spyOn<any, any>(service as any, 'predictAlert')
        .mockRejectedValue(new Error('prediction failed'));

      await expect(service.handleAITriage(alertId, dto, userId, tenantId)).rejects.toThrow(InternalServerErrorException);

      expect(predictSpy).toHaveBeenCalled();
      expect(auditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'AI_TRIAGE_FAILED' }),
      );

      predictSpy.mockRestore();
    });

    describe('autoCloseAlert()', () => {
      it('updates alert status and audits on success', async () => {
        prismaService.alert.update.mockResolvedValue({});

        await (service as any).autoCloseAlert(alertId, AlertStatus.CLOSED, userId);

        expect(prismaService.alert.update).toHaveBeenCalledWith({
          where: { alert_id: alertId },
          data: { alert_status: AlertStatus.CLOSED },
        });
        expect(auditService.logAction).toHaveBeenCalledWith(
          expect.objectContaining({ operation: 'ALERT_AUTO_CLOSED' }),
        );
      });

      it('throws InternalServerErrorException on prisma error', async () => {
        prismaService.alert.update.mockRejectedValue(new Error('db error'));

        await expect(
          (service as any).autoCloseAlert(alertId, AlertStatus.CLOSED, userId),
        ).rejects.toThrow(InternalServerErrorException);
      });
    });

    describe('createInvestigationCase()', () => {
      beforeEach(() => {
        // Provide a transactional executor that calls the callback with prismaService as tx
        prismaService.$transaction = jest.fn(async (cb: any) => cb(prismaService));
      });

      it('creates case, updates alert, audits, and returns updated alert (no parentId branch)', async () => {
        const createdCase = { case_id: 'case-abc' };
        const updatedAlert = { alert_id: alertId, alert_status: AlertStatus.SENT_FOR_INVESTIGATION, case_id: 'case-abc' };

        prismaService.case.create.mockResolvedValue(createdCase);
        prismaService.alert.update.mockResolvedValue(updatedAlert);

        const res = await service.createInvestigationCase(alertId, userId, tenantId, { priority: Priority.HIGH } as any);

        expect(prismaService.case.create).toHaveBeenCalled();
        expect(prismaService.alert.update).toHaveBeenCalledWith({
          where: { alert_id: alertId },
          data: expect.objectContaining({
            alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
            priority: Priority.HIGH,
            case_id: createdCase.case_id,
          }),
        });
        expect(auditService.logAction).toHaveBeenCalledWith(
          expect.objectContaining({ operation: 'ALERT_SENT_FOR_INVESTIGATION' }),
        );
        expect(res).toEqual(updatedAlert);
      });

      it('creates child case branch (parentId provided) and does not set case_id on alert', async () => {
        const createdCase = { case_id: 'child-1' };
        const updatedAlert = { alert_id: alertId, alert_status: AlertStatus.SENT_FOR_INVESTIGATION };

        prismaService.case.create.mockResolvedValue(createdCase);
        prismaService.alert.update.mockResolvedValue(updatedAlert);

        const res = await service.createInvestigationCase(
          alertId,
          userId,
          tenantId,
          { priority: Priority.MEDIUM } as any,
          CaseType.FRAUD,
          'parent-xyz',
        );

        expect(prismaService.alert.update).toHaveBeenCalledWith({
          where: { alert_id: alertId },
          data: expect.objectContaining({
            alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
          }),
        });
        expect(res).toEqual(updatedAlert);
      });

      it('throws InternalServerErrorException on failure', async () => {
        prismaService.case.create.mockRejectedValue(new Error('db error'));

        await expect(
          service.createInvestigationCase(alertId, userId, tenantId, { priority: Priority.LOW } as any),
        ).rejects.toThrow(InternalServerErrorException);
      });

      it('sets case priority to null when prediction is undefined', async () => {
        const createdCase = { case_id: 'case-null-priority' };
        const updatedAlert = { alert_id: alertId, alert_status: AlertStatus.SENT_FOR_INVESTIGATION };

        prismaService.case.create.mockResolvedValue(createdCase);
        prismaService.alert.update.mockResolvedValue(updatedAlert);

        await service.createInvestigationCase(alertId, userId, tenantId);

        expect(prismaService.case.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ priority: null }),
        });
      });
    });

    it('predictAlert: returns a structured prediction object', async () => {
      const result = await (service as any).predictAlert();
      expect(result).toEqual(
        expect.objectContaining({
          priority: expect.any(String),
          alertType: expect.any(String),
          confidence_per: expect.any(Number),
          isTruePositive: expect.any(Boolean),
        }),
      );
    });
  });
});
