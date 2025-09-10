/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { CaseService } from '../../src/case/case.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../src/audit/auditLog.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CreateCaseDto } from '../../src/case/dto/create-case.dto';
import { UpdateCaseDto } from '../../src/case/dto/update-case.dto';
import { CaseStatus, CaseType, Priority, CaseCreationType } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { Outcome } from '../../src/audit/types/outcome';
import { FlowableService } from 'src/flowable/flowable.service';
import { ConfigService } from '@nestjs/config/dist';

describe('CaseService', () => {
  let service: CaseService;
  let prismaService: jest.Mocked<typeof mockPrismaService>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let loggerService: jest.Mocked<LoggerService>;

  const mockPrismaService = {
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
    $transaction: jest.fn(),
  };
  describe('createCaseSystemTransmission', () => {
    const mockPayload = {
      tenantId: 'tenant-123',
      alertData: { /* ... */ },
      priority: 'NEW',
      caseType: 'FRAUD',
      confidencePercentage: 97,
      fraudType: 'Money-Laundering',
    };
    const clientId = 'system-uuid';

    beforeEach(() => {
      // Mock all required service methods and Prisma transactions for this test
      prismaService.$transaction = jest.fn().mockImplementation(fn => fn(prismaService));
      prismaService.case.create.mockResolvedValue({ case_id: 'case-1' });
      prismaService.alert.create.mockResolvedValue({});
      prismaService.task.create.mockResolvedValue({ task_id: 'atm-task-1' });
      prismaService.task.update.mockResolvedValue({});
      (service as any).autocloseCase = jest.fn().mockResolvedValue(undefined);
      (service as any).createInvestigationTask = jest.fn().mockResolvedValue(undefined);
      (service as any).flowableService = {
        startProcessInstance: jest.fn().mockResolvedValue({ id: 'proc-1' }),
        getProcessTasks: jest.fn().mockResolvedValue([]),
      };
      (service as any).configService = { get: jest.fn().mockReturnValue(clientId) };
    });

    it('should autoclose as confirmed when confidence >= 95% and fraudType is true positive', async () => {
      await service.createCaseSystemTransmission(mockPayload, clientId);
      expect(prismaService.case.create).toBeDefined();
      expect(auditLogService.logAction).toBeCalled();
      expect((service as any).autocloseCase).toBeCalledWith('case-1', clientId, CaseStatus.AUTOCLOSED_CONFIRMED_71);
    });

    it('should create investigation task when confidence < 95%', async () => {
      const payload = { ...mockPayload, confidencePercentage: 80 };
      await service.createCaseSystemTransmission(payload, clientId);
      expect((service as any).createInvestigationTask).toBeCalled();
      expect(prismaService.task.update).toBeCalled();
      expect(auditLogService.logAction).toBeCalled();
    });
  });

  const mockAuditLogService = {
    logAction: jest.fn(),
  };

  const mockLoggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  const mockFlowableService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseService,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: FlowableService,
          useValue: mockFlowableService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('mockedValue'),
          },
        },
      ],
    }).compile();

    service = module.get<CaseService>(CaseService);
    // Always use the mockPrismaService object directly
    prismaService = mockPrismaService as jest.Mocked<typeof mockPrismaService>;
    auditLogService = module.get(AuditLogService);
    loggerService = module.get(LoggerService);
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
      status: CaseStatus.DRAFT_00,
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
        status: CaseStatus.DRAFT_00,
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
        status: CaseStatus.DRAFT_00,
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
      status: CaseStatus.CLOSED_CONFIRMED_82,
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
        status: CaseStatus.DRAFT_00,
        priority: Priority.URGENT,
        case_type: CaseType.AML,
        case_creation_type: CaseCreationType.MANUAL,
        created_at: new Date(),
        updated_at: new Date(),
        parent_id: null,
      };

      const updatedMockCase = {
        ...mockCase,
        status: CaseStatus.CLOSED_CONFIRMED_82,
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
      const partialUpdate = { status: CaseStatus.DRAFT_00 };
      const mockCase = {
        case_id: 'case-123',
        tenant_id: 'tenant-123',
        case_creator_user_id: 'creator-123',
        case_owner_user_id: 'owner-123',
        status: CaseStatus.DRAFT_00,
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
          status: CaseStatus.DRAFT_00,
          case_owner_user_id: undefined,
        },
      });
      expect(result).toEqual(mockCase);
    });
  });
});