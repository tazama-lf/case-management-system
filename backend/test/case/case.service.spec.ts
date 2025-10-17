 
import { Test, TestingModule } from '@nestjs/testing';
import { CaseService } from '../../src/case/case.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../src/audit/auditLog.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { FlowableService } from '../../src/flowable/flowable.service';
import { ConfigService } from '@nestjs/config';
import { CreateCaseDto } from '../../src/case/dto/create-case.dto';
import { UpdateCaseDto } from '../../src/case/dto/update-case.dto';
import { CaseStatus, TaskStatus, Priority, CaseType, CaseCreationType } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Outcome } from '../../src/audit/types/outcome';

describe('CaseService', () => {
  let service: CaseService;
  let prismaService: any;
  let auditLogService: jest.Mocked<AuditLogService>;
  let loggerService: jest.Mocked<LoggerService>;
  let flowableService: jest.Mocked<FlowableService>;
  let configService: jest.Mocked<ConfigService>;
  let module: TestingModule;

  // Mock implementations
  const mockPrismaService = {
    $transaction: jest.fn(),
    case: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    alert: {
      create: jest.fn(),
    },
    task: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAuditLogService = {
    logAction: jest.fn(),
  };

  const mockLoggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  const mockFlowableService = {
    startProcessInstance: jest.fn(),
    getProcessTasks: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      providers: [
        CaseService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: FlowableService,
          useValue: mockFlowableService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CaseService>(CaseService);
    prismaService = module.get(PrismaService);
    auditLogService = module.get(AuditLogService);
    loggerService = module.get(LoggerService);
    flowableService = module.get(FlowableService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCase', () => {
    const userId = 'user-123';
    const createCaseDto: CreateCaseDto = {
      tenantId: 'tenant-123',
      caseCreatorUserId: 'creator-123',
      caseOwnerUserId: 'owner-123',
      status: CaseStatus.STATUS_00_DRAFT,
      priority: Priority.NEW,
      caseType: CaseType.FRAUD,
      caseCreationType: CaseCreationType.MANUAL,
    };

    it('should successfully create a case', async () => {
      const mockCase = {
        case_id: 'case-123',
        tenant_id: 'tenant-123',
        case_creator_user_id: 'creator-123',
        case_owner_user_id: 'owner-123',
        status: CaseStatus.STATUS_00_DRAFT,
        priority: Priority.NEW,
        case_type: CaseType.FRAUD,
        case_creation_type: CaseCreationType.MANUAL,
        created_at: new Date(),
        updated_at: new Date(),
        parent_id: null,
      };

      mockPrismaService.case.create.mockResolvedValue(mockCase);

      const result = await service.createCase(createCaseDto, userId);

      expect(mockLoggerService.log).toHaveBeenCalledWith('Creating case', CaseService.name);
      expect(mockPrismaService.case.create).toHaveBeenCalledWith({
        data: {
          tenant_id: createCaseDto.tenantId,
          case_creator_user_id: createCaseDto.caseCreatorUserId,
          case_owner_user_id: createCaseDto.caseOwnerUserId,
          status: createCaseDto.status,
          priority: createCaseDto.priority,
          case_type: createCaseDto.caseType,
          case_creation_type: createCaseDto.caseCreationType,
        },
      });
      expect(mockLoggerService.log).toHaveBeenCalledWith(
          `Case created successfully: ${mockCase.case_id}`,
          CaseService.name,
      );
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'createCase',
        entityName: CaseService.name,
        actionPerformed: 'Case created',
        outcome: Outcome.SUCCESS,
      });
      expect(result).toEqual(mockCase);
    });

    it('should handle errors during case creation', async () => {
      const error = new Error('Database error');
      mockPrismaService.case.create.mockRejectedValue(error);

      await expect(service.createCase(createCaseDto, userId)).rejects.toThrow('Database error');

      expect(mockLoggerService.log).toHaveBeenCalledWith('Creating case', CaseService.name);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
          `Error creating case: ${error.message}`,
          error.stack,
          CaseService.name,
      );
    });
  });

  describe('retrieveCase', () => {
    const caseId = 'case-123';

    it('should successfully retrieve a case', async () => {
      const mockCase = {
        case_id: 'case-123',
        tenant_id: 'tenant-123',
        case_creator_user_id: 'creator-123',
        case_owner_user_id: 'owner-123',
        status: CaseStatus.STATUS_00_DRAFT,
        priority: Priority.NEW,
        case_type: CaseType.FRAUD,
        case_creation_type: CaseCreationType.MANUAL,
        created_at: new Date(),
        updated_at: new Date(),
        parent_id: null,
      };

      mockPrismaService.case.findUnique.mockResolvedValue(mockCase);

      const result = await service.retrieveCase(caseId);

      expect(mockLoggerService.log).toHaveBeenCalledWith(
          `Retrieving case: ${caseId}`,
          CaseService.name,
      );
      expect(mockPrismaService.case.findUnique).toHaveBeenCalledWith({
        where: { case_id: caseId },
        include: { alert: true, tasks: true },
      });
      expect(result).toEqual(mockCase);
    });

    it('should throw NotFoundException when case is not found', async () => {
      mockPrismaService.case.findUnique.mockResolvedValue(null);

      await expect(service.retrieveCase(caseId)).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.case.findUnique).toHaveBeenCalledWith({
        where: { case_id: caseId },
        include: { alert: true, tasks: true },
      });
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
          `Case not found: ${caseId}`,
          CaseService.name,
      );
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockPrismaService.case.findUnique.mockRejectedValue(error);

      await expect(service.retrieveCase(caseId)).rejects.toThrow('Database error');

      expect(mockLoggerService.log).toHaveBeenCalledWith(
          `Retrieving case: ${caseId}`,
          CaseService.name,
      );
    });
  });

  describe('updateCase', () => {
    const caseId = 'case-123';
    const userId = 'user-123';
    const updateCaseDto: Partial<UpdateCaseDto> = {
      status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
      priority: Priority.URGENT,
      caseType: CaseType.AML,
      caseOwnerUserId: 'new-owner-123',
    };

    it('should successfully update a case', async () => {
      const mockCase = {
        case_id: 'case-123',
        tenant_id: 'tenant-123',
        case_creator_user_id: 'creator-123',
        case_owner_user_id: 'new-owner-123',
        status: CaseStatus.STATUS_00_DRAFT,
        priority: Priority.URGENT,
        case_type: CaseType.AML,
        case_creation_type: CaseCreationType.MANUAL,
        created_at: new Date(),
        updated_at: new Date(),
        parent_id: null,
      };

      const updatedMockCase = {
        ...mockCase,
        status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
        case_type: CaseType.AML,
        case_owner_user_id: 'new-owner-123',
      };

      mockPrismaService.case.update.mockResolvedValue(updatedMockCase);

      const result = await service.updateCase(caseId, updateCaseDto, userId);

      expect(mockLoggerService.log).toHaveBeenCalledWith(
          `Updating case: ${caseId}`,
          CaseService.name,
      );
      expect(mockPrismaService.case.update).toHaveBeenCalledWith({
        where: { case_id: caseId },
        data: {
          case_type: updateCaseDto.caseType,
          priority: updateCaseDto.priority,
          status: updateCaseDto.status,
          case_owner_user_id: updateCaseDto.caseOwnerUserId,
        },
      });
      expect(mockLoggerService.log).toHaveBeenCalledWith(
          `Case updated successfully: ${updatedMockCase.case_id}`,
          CaseService.name,
      );
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'updateCase',
        entityName: CaseService.name,
        actionPerformed: `Case updated successfully: ${updatedMockCase.case_id}`,
        outcome: Outcome.SUCCESS,
      });
      expect(result).toEqual(updatedMockCase);
    });

    it('should handle update errors and log audit failure', async () => {
      const error = new Error('Database error');
      mockPrismaService.case.update.mockRejectedValue(error);

      await expect(service.updateCase(caseId, updateCaseDto, userId)).rejects.toThrow(
          'Database error',
      );

      expect(mockLoggerService.log).toHaveBeenCalledWith(
          `Updating case: ${caseId}`,
          CaseService.name,
      );
      expect(mockLoggerService.error).toHaveBeenCalledWith(
          `Error updating case: ${error.message}`,
          error.stack,
          CaseService.name,
      );
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'updateCase',
        entityName: CaseService.name,
        actionPerformed: 'Error updating case',
        outcome: Outcome.FAILURE,
      });
    });

    it('should update case with partial data', async () => {
      const partialUpdate = { status: CaseStatus.STATUS_00_DRAFT };
      const mockCase = {
        case_id: 'case-123',
        tenant_id: 'tenant-123',
        case_creator_user_id: 'creator-123',
        case_owner_user_id: 'owner-123',
        status: CaseStatus.STATUS_00_DRAFT,
        priority: Priority.NEW,
        case_type: CaseType.FRAUD,
        case_creation_type: CaseCreationType.MANUAL,
        created_at: new Date(),
        updated_at: new Date(),
        parent_id: null,
      };

      mockPrismaService.case.update.mockResolvedValue(mockCase);

      const result = await service.updateCase(caseId, partialUpdate, userId);

      expect(mockPrismaService.case.update).toHaveBeenCalledWith({
        where: { case_id: caseId },
        data: {
          case_type: undefined,
          priority: undefined,
          status: CaseStatus.STATUS_00_DRAFT,
          case_owner_user_id: undefined,
        },
      });
      expect(result).toEqual(mockCase);
    });
  });

  describe('createCaseSystemTransmission', () => {
    const clientId = 'client-123';
    const systemUuid = 'system-uuid';

    beforeEach(() => {
      // Setup common mocks for system transmission tests
      configService.get.mockReturnValue(systemUuid);
      flowableService.startProcessInstance.mockResolvedValue({ id: 'process-123' });
      flowableService.getProcessTasks.mockResolvedValue([]);

      // Setup transaction mock
      prismaService.$transaction.mockImplementation(async (fn) => {
        const mockTx = {
          case: { create: jest.fn(), update: jest.fn() },
          alert: { create: jest.fn() },
          task: { create: jest.fn(), update: jest.fn() },
        };
        return fn(mockTx);
      });
    });

    describe('Validation error paths', () => {
      it('should validate missing tenantId', async () => {
        const payload = {
          alertData: { typology: 'Test' },
          // Missing tenantId
        };

        await expect(service.createCaseSystemTransmission(payload, clientId)).rejects.toThrow(BadRequestException);
      });

      it('should validate negative confidence percentage', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 50, indicators: {} },
          transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
          confidencePercentage: -5,
        };

        await expect(service.createCaseSystemTransmission(payload, clientId)).rejects.toThrow(BadRequestException);
      });

      it('should validate confidence percentage over 100', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 50, indicators: {} },
          transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
          confidencePercentage: 150,
        };

        await expect(service.createCaseSystemTransmission(payload, clientId)).rejects.toThrow(BadRequestException);
      });

      it('should handle payload without transaction or alertData', async () => {
        const payload = {
          tenantId: 'tenant-123',
          // No alertData or transaction
        };

        await expect(service.createCaseSystemTransmission(payload, clientId)).rejects.toThrow(BadRequestException);
      });

      it('should validate invalid report status', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test' },
          reportStatus: 'NALT', // Should be rejected
        };

        await expect(service.createCaseSystemTransmission(payload, clientId)).rejects.toThrow(BadRequestException);
      });

      it('should validate confidence percentage exactly 0', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 50, indicators: {} },
          confidencePercentage: 0, // Should be valid
        };

  const mockCase = { case_id: 'case-123', status: CaseStatus.STATUS_00_DRAFT };
        const mockTask = { task_id: 'task-123' };

        configService.get.mockReturnValue('system-uuid');
        prismaService.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            case: { create: jest.fn().mockResolvedValue(mockCase) },
            alert: { create: jest.fn().mockResolvedValue({}) },
            task: { create: jest.fn().mockResolvedValue(mockTask) },
          };
          return fn(mockTx);
        });

        flowableService.startProcessInstance.mockResolvedValue({ id: 'process-123' });
        prismaService.case.findUnique.mockResolvedValue(mockCase);
        prismaService.task.create.mockResolvedValue({ task_id: 'inv-123' });
        prismaService.task.update.mockResolvedValue({});
        prismaService.case.update.mockResolvedValue(mockCase);

        // Should not throw validation error for 0
        await expect(service.createCaseSystemTransmission(payload, clientId)).resolves.toBeDefined();
      });

      it('should validate confidence percentage exactly 100', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 50, indicators: {} },
          confidencePercentage: 100, // Should be valid
          fraudType: 'Money-Laundering',
        };

  const mockCase = { case_id: 'case-123', status: CaseStatus.STATUS_00_DRAFT };
        const mockTask = { task_id: 'task-123' };

        configService.get.mockReturnValue('system-uuid');
        prismaService.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            case: { create: jest.fn().mockResolvedValue(mockCase) },
            alert: { create: jest.fn().mockResolvedValue({}) },
            task: { create: jest.fn().mockResolvedValue(mockTask) },
          };
          return fn(mockTx);
        });

        flowableService.startProcessInstance.mockResolvedValue({ id: 'process-123' });
        prismaService.case.findUnique.mockResolvedValue(mockCase);
        prismaService.case.update.mockResolvedValue(mockCase);

        // Should not throw validation error for 100
        await expect(service.createCaseSystemTransmission(payload, clientId)).resolves.toBeDefined();
      });
    });

    describe('Autoclose eligibility paths', () => {
      it('should handle low confidence and low risk for autoclose', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 15, indicators: {} },
          transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
          confidencePercentage: 25,
          riskScore: 15,
        };

  const mockCase = { case_id: 'case-123', status: CaseStatus.STATUS_00_DRAFT };
        const mockTask = { task_id: 'task-123' };

        prismaService.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            case: { create: jest.fn().mockResolvedValue(mockCase) },
            alert: { create: jest.fn().mockResolvedValue({}) },
            task: { create: jest.fn().mockResolvedValue(mockTask) },
          };
          return fn(mockTx);
        });

        prismaService.case.findUnique.mockResolvedValue(mockCase);
        prismaService.task.update.mockResolvedValue({});
        prismaService.task.create.mockResolvedValue({ task_id: 'inv-123' });
        prismaService.case.update.mockResolvedValue(mockCase);

        await service.createCaseSystemTransmission(payload, clientId);

        expect(flowableService.startProcessInstance).toHaveBeenCalledWith(
            'caseCreationProcess',
            expect.objectContaining({
              autocloseEligible: true, // Low confidence and low risk should be eligible
            }),
            'case-123'
        );
      });

      it('should handle edge case where confidence is exactly 30 and risk is exactly 20', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 50, indicators: {} },
          transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
          confidencePercentage: 30, // Exactly 30
          riskScore: 20, // Exactly 20
        };

  const mockCase = { case_id: 'case-123', status: CaseStatus.STATUS_00_DRAFT };
        const mockTask = { task_id: 'task-123' };

        configService.get.mockReturnValue('system-uuid');
        prismaService.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            case: { create: jest.fn().mockResolvedValue(mockCase) },
            alert: { create: jest.fn().mockResolvedValue({}) },
            task: { create: jest.fn().mockResolvedValue(mockTask) },
          };
          return fn(mockTx);
        });

        flowableService.startProcessInstance.mockResolvedValue({ id: 'process-123' });
        prismaService.case.findUnique.mockResolvedValue(mockCase);
        prismaService.task.create.mockResolvedValue({ task_id: 'inv-123' });
        prismaService.task.update.mockResolvedValue({});
        prismaService.case.update.mockResolvedValue(mockCase);

        await service.createCaseSystemTransmission(payload, clientId);

        // Should not be autoclose eligible (confidence < 30 AND risk < 20)
        expect(flowableService.startProcessInstance).toHaveBeenCalledWith(
            'caseCreationProcess',
            expect.objectContaining({
              autocloseEligible: false,
            }),
            'case-123'
        );
      });
    });

    describe('High confidence autoclose scenarios', () => {
      it('should autoclose as confirmed when confidence >= 95% and fraudType is true positive', async () => {
        const mockPayload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 80, indicators: {} },
          transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
          priority: 'NEW',
          caseType: 'FRAUD',
          confidencePercentage: 97,
          fraudType: 'Money-Laundering',
        };

  const mockCase = { case_id: 'case-1', status: CaseStatus.STATUS_00_DRAFT };
        const mockTask = { task_id: 'atm-task-1' };

        prismaService.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            case: { create: jest.fn().mockResolvedValue(mockCase) },
            alert: { create: jest.fn().mockResolvedValue({}) },
            task: { create: jest.fn().mockResolvedValue(mockTask) },
          };
          return fn(mockTx);
        });

        prismaService.case.findUnique.mockResolvedValue(mockCase);
        prismaService.case.update.mockResolvedValue(mockCase);

        await service.createCaseSystemTransmission(mockPayload, clientId);

        expect(prismaService.case.update).toHaveBeenCalledWith({
          where: { case_id: 'case-1' },
          data: {
            status: CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
            updated_at: expect.any(Date),
          },
        });

        expect(auditLogService.logAction).toHaveBeenCalledWith({
          userId: systemUuid,
          operation: 'autocloseCase',
          entityName: CaseService.name,
          actionPerformed: `Case case-1 autoclosed with status ${CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED}`,
          outcome: Outcome.SUCCESS,
        });
      });

      it('should autoclose as refuted when confidence >= 95% and fraudType is false positive', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 80, indicators: {} },
          transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
          confidencePercentage: 96,
          fraudType: 'False-Positive', // Not in the true positive list
        };

  const mockCase = { case_id: 'case-1', status: CaseStatus.STATUS_00_DRAFT };
        const mockTask = { task_id: 'atm-task-1' };

        configService.get.mockReturnValue('system-uuid');
        prismaService.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            case: { create: jest.fn().mockResolvedValue(mockCase) },
            alert: { create: jest.fn().mockResolvedValue({}) },
            task: { create: jest.fn().mockResolvedValue(mockTask) },
          };
          return fn(mockTx);
        });

        flowableService.startProcessInstance.mockResolvedValue({ id: 'process-123' });
        prismaService.case.findUnique.mockResolvedValue(mockCase);
        prismaService.case.update.mockResolvedValue(mockCase);

        await service.createCaseSystemTransmission(payload, clientId);

        expect(prismaService.case.update).toHaveBeenCalledWith({
          where: { case_id: 'case-1' },
          data: {
            status: CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
            updated_at: expect.any(Date),
          },
        });
      });

      it('should autoclose as refuted when confidence >= 95% and no fraudType specified', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 80, indicators: {} },
          transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
          confidencePercentage: 95,
          // No fraudType specified
        };

  const mockCase = { case_id: 'case-1', status: CaseStatus.STATUS_00_DRAFT };
        const mockTask = { task_id: 'atm-task-1' };

        configService.get.mockReturnValue('system-uuid');
        prismaService.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            case: { create: jest.fn().mockResolvedValue(mockCase) },
            alert: { create: jest.fn().mockResolvedValue({}) },
            task: { create: jest.fn().mockResolvedValue(mockTask) },
          };
          return fn(mockTx);
        });

        flowableService.startProcessInstance.mockResolvedValue({ id: 'process-123' });
        prismaService.case.findUnique.mockResolvedValue(mockCase);
        prismaService.case.update.mockResolvedValue(mockCase);

        await service.createCaseSystemTransmission(payload, clientId);

        expect(prismaService.case.update).toHaveBeenCalledWith({
          where: { case_id: 'case-1' },
          data: {
            status: CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
            updated_at: expect.any(Date),
          },
        });
      });

      it('should test all true positive fraudType values', async () => {
        const truePositiveTypes = ['Money-Laundering', 'Fraud Only', 'Transaction Blocked'];

        for (const fraudType of truePositiveTypes) {
          const payload = {
            tenantId: 'tenant-123',
            alertData: { typology: 'Test', riskScore: 80, indicators: {} },
            transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
            confidencePercentage: 97,
            fraudType,
          };

          const mockCase = { case_id: `case-${fraudType}`, status: CaseStatus.STATUS_00_DRAFT };
          const mockTask = { task_id: `atm-task-${fraudType}` };

          jest.clearAllMocks();

          configService.get.mockReturnValue('system-uuid');
          prismaService.$transaction.mockImplementation(async (fn) => {
            const mockTx = {
              case: { create: jest.fn().mockResolvedValue(mockCase) },
              alert: { create: jest.fn().mockResolvedValue({}) },
              task: { create: jest.fn().mockResolvedValue(mockTask) },
            };
            return fn(mockTx);
          });

          flowableService.startProcessInstance.mockResolvedValue({ id: 'process-123' });
          prismaService.case.findUnique.mockResolvedValue(mockCase);
          prismaService.case.update.mockResolvedValue(mockCase);

          await service.createCaseSystemTransmission(payload, clientId);

          expect(prismaService.case.update).toHaveBeenCalledWith({
            where: { case_id: `case-${fraudType}` },
            data: {
              status: CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
              updated_at: expect.any(Date),
            },
          });
        }
      });

      it('should create investigation task when confidence < 95%', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 60, indicators: {} },
          transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
          priority: 'NEW',
          caseType: 'FRAUD',
          confidencePercentage: 80,
        };

  const mockCase = { case_id: 'case-1', status: CaseStatus.STATUS_00_DRAFT };
        const mockTask = { task_id: 'atm-task-1' };
        const mockInvTask = { task_id: 'inv-123' };

        prismaService.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            case: { create: jest.fn().mockResolvedValue(mockCase) },
            alert: { create: jest.fn().mockResolvedValue({}) },
            task: { create: jest.fn().mockResolvedValue(mockTask) },
          };
          return fn(mockTx);
        });

        prismaService.case.findUnique.mockResolvedValue(mockCase);
        prismaService.task.update.mockResolvedValue({});
        prismaService.task.create.mockResolvedValue(mockInvTask);
        prismaService.case.update.mockResolvedValue(mockCase);

        await service.createCaseSystemTransmission(payload, clientId);

        expect(prismaService.task.create).toHaveBeenCalledWith({
          data: {
            case_id: 'case-1',
            status: TaskStatus.STATUS_01_UNASSIGNED,
            assigned_user_id: null,
            name: 'Investigate Case',
            description: 'Investigate the reported suspicious activity',
          },
        });

        expect(prismaService.task.update).toHaveBeenCalledWith({
          where: { task_id: 'atm-task-1' },
          data: {
            status: TaskStatus.STATUS_30_COMPLETED,
            updated_at: expect.any(Date),
          },
        });
      });
    });

    describe('Error handling branches', () => {
      it('should handle transaction failure and log audit failure', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 50, indicators: {} },
          transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
        };

        configService.get.mockReturnValue('system-uuid');

        // Mock transaction failure
        const transactionError = new Error('Transaction failed');
        prismaService.$transaction.mockRejectedValue(transactionError);

        await expect(service.createCaseSystemTransmission(payload, clientId)).rejects.toThrow('Transaction failed');

        // Verify error logging and audit failure logging
        expect(loggerService.error).toHaveBeenCalledWith(
            `Error in system-to-system case creation: ${transactionError.message}`,
            transactionError.stack,
            CaseService.name
        );
        expect(auditLogService.logAction).toHaveBeenCalledWith({
          userId: 'system-uuid',
          operation: 'createCase',
          entityName: CaseService.name,
          actionPerformed: 'Failed to create case via system transmission',
          outcome: Outcome.FAILURE,
        });
      });

      it('should handle flowable service failure', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 50, indicators: {} },
          transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
        };

  const mockCase = { case_id: 'case-123', status: CaseStatus.STATUS_00_DRAFT };
        const mockTask = { task_id: 'task-123' };

        configService.get.mockReturnValue('system-uuid');

        prismaService.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            case: { create: jest.fn().mockResolvedValue(mockCase) },
            alert: { create: jest.fn().mockResolvedValue({}) },
            task: { create: jest.fn().mockResolvedValue(mockTask) },
          };
          return fn(mockTx);
        });

        // Mock flowable failure
        flowableService.startProcessInstance.mockRejectedValue(new Error('Flowable error'));

        await expect(service.createCaseSystemTransmission(payload, clientId)).rejects.toThrow('Flowable error');
      });

      it('should handle errors in routeToATM', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 50, indicators: {} },
          transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
          confidencePercentage: 80,
        };

  const mockCase = { case_id: 'case-123', status: CaseStatus.STATUS_00_DRAFT };
        const mockTask = { task_id: 'task-123' };

        configService.get.mockReturnValue('system-uuid');
        prismaService.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            case: { create: jest.fn().mockResolvedValue(mockCase) },
            alert: { create: jest.fn().mockResolvedValue({}) },
            task: { create: jest.fn().mockResolvedValue(mockTask) },
          };
          return fn(mockTx);
        });

        flowableService.startProcessInstance.mockResolvedValue({ id: 'process-123' });

        // Mock error in task update during routeToATM
        prismaService.task.update.mockRejectedValueOnce(new Error('Task update failed'));

        await expect(service.createCaseSystemTransmission(payload, clientId)).rejects.toThrow('Task update failed');
      });

      it('should handle errors in autocloseCase', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 80, indicators: {} },
          transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
          confidencePercentage: 96,
          fraudType: 'Money-Laundering',
        };

  const mockCase = { case_id: 'case-1', status: CaseStatus.STATUS_00_DRAFT };
        const mockTask = { task_id: 'atm-task-1' };

        configService.get.mockReturnValue('system-uuid');
        prismaService.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            case: { create: jest.fn().mockResolvedValue(mockCase) },
            alert: { create: jest.fn().mockResolvedValue({}) },
            task: { create: jest.fn().mockResolvedValue(mockTask) },
          };
          return fn(mockTx);
        });

        flowableService.startProcessInstance.mockResolvedValue({ id: 'process-123' });

        // Mock error in case update during autocloseCase
        prismaService.case.update.mockRejectedValueOnce(new Error('Case update failed'));

        await expect(service.createCaseSystemTransmission(payload, clientId)).rejects.toThrow('Case update failed');

        expect(loggerService.error).toHaveBeenCalledWith(
            'Failed to autoclose case: Case update failed',
            expect.any(String),
            CaseService.name
        );
      });

      it('should handle errors in createInvestigationTask', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 50, indicators: {} },
          transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
          confidencePercentage: 80,
        };

  const mockCase = { case_id: 'case-123', status: CaseStatus.STATUS_00_DRAFT };
        const mockTask = { task_id: 'task-123' };

        configService.get.mockReturnValue('system-uuid');
        prismaService.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            case: { create: jest.fn().mockResolvedValue(mockCase) },
            alert: { create: jest.fn().mockResolvedValue({}) },
            task: { create: jest.fn().mockResolvedValue(mockTask) },
          };
          return fn(mockTx);
        });

        flowableService.startProcessInstance.mockResolvedValue({ id: 'process-123' });
        prismaService.case.findUnique.mockResolvedValue(mockCase);

        // First task update (routeToATM) should succeed
        // Second task update (ATM completion) should succeed
        // Task create (investigation task) should fail
        prismaService.task.update
            .mockResolvedValueOnce({}) // routeToATM
            .mockResolvedValueOnce({}); // ATM completion

        prismaService.task.create.mockRejectedValueOnce(new Error('Investigation task creation failed'));

        await expect(service.createCaseSystemTransmission(payload, clientId)).rejects.toThrow('Investigation task creation failed');

        expect(loggerService.error).toHaveBeenCalledWith(
            'Failed to create investigation task: Investigation task creation failed',
            expect.any(String),
            CaseService.name
        );
      });
    });

    describe('Payload without alertData but with transaction', () => {
      it('should handle payload with transaction but no alertData', async () => {
        const payload = {
          tenantId: 'tenant-123',
          transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
          confidencePercentage: 80,
        };

  const mockCase = { case_id: 'case-123', status: CaseStatus.STATUS_00_DRAFT };
        const mockTask = { task_id: 'task-123' };

        configService.get.mockReturnValue('system-uuid');
        prismaService.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            case: { create: jest.fn().mockResolvedValue(mockCase) },
            alert: { create: jest.fn() },
            task: { create: jest.fn().mockResolvedValue(mockTask) },
          };
          return fn(mockTx);
        });

        flowableService.startProcessInstance.mockResolvedValue({ id: 'process-123' });
        prismaService.case.findUnique.mockResolvedValue(mockCase);
        prismaService.task.create.mockResolvedValue({ task_id: 'inv-123' });
        prismaService.task.update.mockResolvedValue({});
        prismaService.case.update.mockResolvedValue(mockCase);

        const result = await service.createCaseSystemTransmission(payload, clientId);

        expect(result).toBeDefined();
        expect(result.caseId).toBe('case-123');
      });
    });

    describe('Default values handling', () => {
      it('should handle payload with default priority and undefined values', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 50, indicators: {} },
          transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
          // No priority, confidencePercentage, etc.
        };

  const mockCase = { case_id: 'case-123', status: CaseStatus.STATUS_00_DRAFT };
        const mockTask = { task_id: 'task-123' };

        configService.get.mockReturnValue('system-uuid');
        prismaService.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            case: { create: jest.fn().mockResolvedValue(mockCase) },
            alert: { create: jest.fn().mockResolvedValue({}) },
            task: { create: jest.fn().mockResolvedValue(mockTask) },
          };
          return fn(mockTx);
        });

        flowableService.startProcessInstance.mockResolvedValue({ id: 'process-123' });
        prismaService.case.findUnique.mockResolvedValue(mockCase);
        prismaService.task.create.mockResolvedValue({ task_id: 'inv-123' });
        prismaService.task.update.mockResolvedValue({});
        prismaService.case.update.mockResolvedValue(mockCase);

        const result = await service.createCaseSystemTransmission(payload, clientId);

        expect(result).toBeDefined();
        expect(result.caseId).toBe('case-123');
      });
    });

    describe('FlowableService integration', () => {
      it('should handle flowableService.getProcessTasks returning tasks', async () => {
        const payload = {
          tenantId: 'tenant-123',
          alertData: { typology: 'Test', riskScore: 50, indicators: {} },
          transaction: { transactionId: 'txn-1', amount: 100, currency: 'USD', debtor: {}, creditor: {}, timestamp: '2024' },
          confidencePercentage: 80,
        };

  const mockCase = { case_id: 'case-123', status: CaseStatus.STATUS_00_DRAFT };
        const mockTask = { task_id: 'task-123' };

        configService.get.mockReturnValue('system-uuid');
        prismaService.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            case: { create: jest.fn().mockResolvedValue(mockCase) },
            alert: { create: jest.fn().mockResolvedValue({}) },
            task: { create: jest.fn().mockResolvedValue(mockTask) },
          };
          return fn(mockTx);
        });

        flowableService.startProcessInstance.mockResolvedValue({ id: 'process-123' });
        flowableService.getProcessTasks.mockResolvedValue([{ id: 'flowable-task-1' }]);
        prismaService.case.findUnique.mockResolvedValue(mockCase);
        prismaService.task.create.mockResolvedValue({ task_id: 'inv-123' });
        prismaService.task.update.mockResolvedValue({});
        prismaService.case.update.mockResolvedValue(mockCase);

        const result = await service.createCaseSystemTransmission(payload, clientId);

        expect(flowableService.getProcessTasks).toHaveBeenCalledWith('case-123');
        expect(result).toBeDefined();
      });
    });
  });
});