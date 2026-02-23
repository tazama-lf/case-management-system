import { Test, TestingModule } from '@nestjs/testing';
import { CaseCreationService } from '../src/modules/case/services/case-creation.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CaseRepository } from '../src/modules/repository/case.repository';
import { TaskService } from '../src/modules/task/task.service';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { ConfigService } from '@nestjs/config';
import { FlowableService } from '../src/modules/flowable/flowable.service';
import { InternalServerErrorException } from '@nestjs/common';
import { CaseCreationType, CaseStatus, CaseType, Priority, TaskStatus } from '@prisma/client-cms';
import { CreateCaseDto } from '../src/modules/case/dto';

describe('CaseCreationService', () => {
  let service: CaseCreationService;
  let logger: any;
  let caseRepository: any;
  let taskService: any;
  let loggingOrchestrationService: any;
  let configService: any;
  let flowableService: any;

  const mockCase = {
    case_id: 1,
    tenant_id: 'tenant-123',
    case_creator_user_id: 'user-123',
    case_owner_user_id: 'user-123',
    status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
    priority: Priority.CRITICAL,
    parent_id: null,
    case_type: CaseType.FRAUD,
    case_creation_type: CaseCreationType.AUTOMATIC_SYSTEM,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockCaseRepository = {
      createCase: jest.fn(),
      updateCase: jest.fn(),
    };

    const mockTaskService = {
      createTask: jest.fn(),
    };

    const mockLoggingOrchestrationService = {
      logActions: jest.fn(),
      logActionsWithHistory: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockFlowableService = {
      handleCaseCreated: jest.fn(),
      handleTaskCompleted: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseCreationService,
        { provide: LoggerService, useValue: mockLogger },
        { provide: CaseRepository, useValue: mockCaseRepository },
        { provide: TaskService, useValue: mockTaskService },
        { provide: LoggingOrchestrationService, useValue: mockLoggingOrchestrationService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: FlowableService, useValue: mockFlowableService },
      ],
    }).compile();

    service = module.get<CaseCreationService>(CaseCreationService);
    logger = module.get(LoggerService);
    caseRepository = module.get(CaseRepository);
    taskService = module.get(TaskService);
    loggingOrchestrationService = module.get(LoggingOrchestrationService);
    configService = module.get(ConfigService);
    flowableService = module.get(FlowableService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    flowableService.handleCaseCreated.mockResolvedValue(undefined);
    taskService.createTask.mockResolvedValue({
      task_id: 1,
      name: 'Investigate Case',
      status: TaskStatus.STATUS_01_UNASSIGNED,
    });
  });

  describe('createCase', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const createCaseDto: CreateCaseDto = {
      tenantId: 'tenant-123',
      caseCreatorUserId: 'user-123',
      caseOwnerUserId: 'user-123',
      status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      priority: Priority.CRITICAL,
      caseType: CaseType.FRAUD,
      caseCreationType: CaseCreationType.AUTOMATIC_SYSTEM,
      parentId: undefined,
    };

    it('should successfully create a case', async () => {
      caseRepository.createCase.mockResolvedValueOnce(mockCase);

      const result = await service.createCase(createCaseDto, userId, tenantId);

      expect(result).toEqual(mockCase);
      expect(logger.log).toHaveBeenCalledWith('Start - Create Case', 'CaseCreationService');
      expect(logger.log).toHaveBeenCalledWith('End - Create Case', 'CaseCreationService');
      expect(caseRepository.createCase).toHaveBeenCalledWith({
        tenantId: createCaseDto.tenantId,
        caseCreatorUserId: createCaseDto.caseCreatorUserId,
        caseOwnerUserId: createCaseDto.caseOwnerUserId,
        status: createCaseDto.status,
        priority: createCaseDto.priority,
        parentId: null,
        caseType: createCaseDto.caseType,
        caseCreationType: createCaseDto.caseCreationType,
      });
      expect(flowableService.handleCaseCreated).toHaveBeenCalledWith({
        caseId: mockCase.case_id,
        tenantId: mockCase.tenant_id,
        caseStatus: mockCase.status,
        creationType: createCaseDto.caseCreationType,
        creatorRole: 'SYSTEM',
      });
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalledWith(
        {
          userId,
          operation: 'createCase',
          entityName: 'CaseCreationService',
          actionPerformed: `Case ${mockCase.case_id} created successfully`,
          outcome: 'SUCCESS',
        },
        mockCase.case_id,
        tenantId
      );
    });

    it('should create a case with parent id', async () => {
      const createCaseDtoWithParent: CreateCaseDto = {
        ...createCaseDto,
        parentId: 100,
      };
      const caseWithParent = { ...mockCase, parent_id: 100 };
      caseRepository.createCase.mockResolvedValueOnce(caseWithParent);

      const result = await service.createCase(createCaseDtoWithParent, userId, tenantId);

      expect(result).toEqual(caseWithParent);
      expect(caseRepository.createCase).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 100,
        })
      );
    });

    it('should handle null parent id', async () => {
      const createCaseDtoNoParent: CreateCaseDto = {
        ...createCaseDto,
        parentId: undefined,
      };
      caseRepository.createCase.mockResolvedValueOnce(mockCase);

      const result = await service.createCase(createCaseDtoNoParent, userId, tenantId);

      expect(result).toEqual(mockCase);
      expect(caseRepository.createCase).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: null,
        })
      );
    });

    it('should handle errors during case creation', async () => {
      const error = new Error('Database error');
      caseRepository.createCase.mockRejectedValueOnce(error);

      await expect(service.createCase(createCaseDto, userId, tenantId)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[CaseWorkflow] Error creating case'),
        expect.any(String),
        'CaseCreationService'
      );
    });

    it('should handle InternalServerErrorException', async () => {
      const error = new InternalServerErrorException('Internal error');
      caseRepository.createCase.mockRejectedValueOnce(error);

      await expect(service.createCase(createCaseDto, userId, tenantId)).rejects.toThrow(InternalServerErrorException);
    });

    it('should create case with different status', async () => {
      const createCaseDtoWithDraft: CreateCaseDto = {
        ...createCaseDto,
        status: CaseStatus.STATUS_00_DRAFT,
      };
      const draftCase = { ...mockCase, status: CaseStatus.STATUS_00_DRAFT };
      caseRepository.createCase.mockResolvedValueOnce(draftCase);

      const result = await service.createCase(createCaseDtoWithDraft, userId, tenantId);

      expect(result.status).toBe(CaseStatus.STATUS_00_DRAFT);
    });

    it('should create case with different priority', async () => {
      const createCaseDtoWithUrgent: CreateCaseDto = {
        ...createCaseDto,
        priority: Priority.URGENT,
      };
      const urgentCase = { ...mockCase, priority: Priority.URGENT };
      caseRepository.createCase.mockResolvedValueOnce(urgentCase);

      const result = await service.createCase(createCaseDtoWithUrgent, userId, tenantId);

      expect(result.priority).toBe(Priority.URGENT);
    });

    it('should create case with different case type', async () => {
      const createCaseDtoWithAML: CreateCaseDto = {
        ...createCaseDto,
        caseType: CaseType.AML,
      };
      const amlCase = { ...mockCase, case_type: CaseType.AML };
      caseRepository.createCase.mockResolvedValueOnce(amlCase);

      const result = await service.createCase(createCaseDtoWithAML, userId, tenantId);

      expect(result.case_type).toBe(CaseType.AML);
    });

    it('should create case with manual creation type', async () => {
      const createCaseDtoManual: CreateCaseDto = {
        ...createCaseDto,
        caseCreationType: CaseCreationType.MANUAL,
      };
      const manualCase = { ...mockCase, case_creation_type: CaseCreationType.MANUAL };
      caseRepository.createCase.mockResolvedValueOnce(manualCase);

      const result = await service.createCase(createCaseDtoManual, userId, tenantId);

      expect(result.case_creation_type).toBe(CaseCreationType.MANUAL);
    });
  });

  describe('createCaseWithInvestigationTask', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const parentCaseId = 100;
    const alertType = CaseType.FRAUD;
    const priority = Priority.CRITICAL;

    it('should successfully create case with investigation task', async () => {
      caseRepository.createCase.mockResolvedValueOnce(mockCase);
      taskService.createTask.mockResolvedValueOnce({
        task_id: 1,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      const result = await service.createCaseWithInvestigationTask(alertType, userId, tenantId, parentCaseId, priority);

      expect(result).toEqual({
        caseId: mockCase.case_id,
        message: 'Child case created, BPMN will create investigation task',
      });
      expect(caseRepository.createCase).toHaveBeenCalledWith({
        caseCreatorUserId: userId,
        caseOwnerUserId: userId,
        tenantId,
        priority,
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        parentId: parentCaseId,
        caseType: alertType,
        caseCreationType: CaseCreationType.AUTOMATIC_SYSTEM,
      });
      expect(flowableService.handleCaseCreated).toHaveBeenCalledWith({
        caseId: mockCase.case_id,
        tenantId: mockCase.tenant_id,
        caseStatus: mockCase.status,
        creationType: CaseCreationType.AUTOMATIC_SYSTEM,
        creatorRole: 'SYSTEM',
      });
      expect(flowableService.handleTaskCompleted).toHaveBeenCalledWith({
        caseId: mockCase.case_id,
        newStatus: TaskStatus.STATUS_30_COMPLETED,
        taskName: 'Complete New Case',
        completionVariables: {
          autoCloseEligible: false,
          caseType: mockCase.case_type,
          casePriority: mockCase.priority,
        },
      });
      expect(taskService.createTask).toHaveBeenCalledWith(
        {
          caseId: mockCase.case_id,
          status: TaskStatus.STATUS_01_UNASSIGNED,
          name: 'Investigate Case',
          description: `Investigation task for manually created case ${mockCase.case_id}`,
          candidateGroup: 'investigations',
        },
        userId,
        tenantId
      );
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith({
        userId: userId.toString(),
        operation: 'ADDITIONAL_CASE_CREATED',
        entityName: 'CaseCreationService',
        actionPerformed: expect.stringContaining(`Created ${alertType} child case ${mockCase.case_id}`),
        outcome: 'SUCCESS',
      });
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining(`Child case ${mockCase.case_id} (${alertType}) created`),
        'CaseCreationService'
      );
    });

    it('should create AML case with investigation task', async () => {
      const amlCase = { ...mockCase, case_type: CaseType.AML };
      caseRepository.createCase.mockResolvedValueOnce(amlCase);
      taskService.createTask.mockResolvedValueOnce({
        task_id: 1,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      const result = await service.createCaseWithInvestigationTask(CaseType.AML, userId, tenantId, parentCaseId, priority);

      expect(result).toBeDefined();
      expect(caseRepository.createCase).toHaveBeenCalledWith(
        expect.objectContaining({
          caseType: CaseType.AML,
        })
      );
    });

    it('should create case with FRAUD_AND_AML type', async () => {
      const fraudAndAmlCase = { ...mockCase, case_type: CaseType.FRAUD_AND_AML };
      caseRepository.createCase.mockResolvedValueOnce(fraudAndAmlCase);
      taskService.createTask.mockResolvedValueOnce({
        task_id: 1,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      const result = await service.createCaseWithInvestigationTask(
        CaseType.FRAUD_AND_AML,
        userId,
        tenantId,
        parentCaseId,
        priority
      );

      expect(result).toBeDefined();
    });

    it('should create case with URGENT priority', async () => {
      const urgentCase = { ...mockCase, priority: Priority.URGENT };
      caseRepository.createCase.mockResolvedValueOnce(urgentCase);
      taskService.createTask.mockResolvedValueOnce({
        task_id: 1,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      const result = await service.createCaseWithInvestigationTask(alertType, userId, tenantId, parentCaseId, Priority.URGENT);

      expect(result).toBeDefined();
      expect(caseRepository.createCase).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: Priority.URGENT,
        })
      );
    });

    it('should create case with NEW priority', async () => {
      const newCase = { ...mockCase, priority: Priority.NEW };
      caseRepository.createCase.mockResolvedValueOnce(newCase);
      taskService.createTask.mockResolvedValueOnce({
        task_id: 1,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      const result = await service.createCaseWithInvestigationTask(alertType, userId, tenantId, parentCaseId, Priority.NEW);

      expect(result).toBeDefined();
    });

    it('should create case with BREACH priority', async () => {
      const breachCase = { ...mockCase, priority: Priority.BREACH };
      caseRepository.createCase.mockResolvedValueOnce(breachCase);
      taskService.createTask.mockResolvedValueOnce({
        task_id: 1,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      const result = await service.createCaseWithInvestigationTask(alertType, userId, tenantId, parentCaseId, Priority.BREACH);

      expect(result).toBeDefined();
    });

    it('should throw InternalServerErrorException on case creation error', async () => {
      const error = new Error('Database connection failed');
      caseRepository.createCase.mockRejectedValueOnce(error);

      await expect(
        service.createCaseWithInvestigationTask(alertType, userId, tenantId, parentCaseId, priority)
      ).rejects.toThrow(InternalServerErrorException);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to create ${alertType} case`),
        expect.any(String),
        'CaseCreationService'
      );
    });

    it('should handle different parent case IDs', async () => {
      const differentParentId = 200;
      caseRepository.createCase.mockResolvedValueOnce(mockCase);
      taskService.createTask.mockResolvedValueOnce({
        task_id: 1,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      const result = await service.createCaseWithInvestigationTask(alertType, userId, tenantId, differentParentId, priority);

      expect(result).toBeDefined();
      expect(caseRepository.createCase).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: differentParentId,
        })
      );
    });

    it('should handle different user IDs', async () => {
      const differentUserId = 'user-456';
      caseRepository.createCase.mockResolvedValueOnce(mockCase);
      taskService.createTask.mockResolvedValueOnce({
        task_id: 1,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      const result = await service.createCaseWithInvestigationTask(alertType, differentUserId, tenantId, parentCaseId, priority);

      expect(result).toBeDefined();
      expect(caseRepository.createCase).toHaveBeenCalledWith(
        expect.objectContaining({
          caseCreatorUserId: differentUserId,
          caseOwnerUserId: differentUserId,
        })
      );
    });

    it('should handle different tenant IDs', async () => {
      const differentTenantId = 'tenant-456';
      caseRepository.createCase.mockResolvedValueOnce(mockCase);
      taskService.createTask.mockResolvedValueOnce({
        task_id: 1,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      const result = await service.createCaseWithInvestigationTask(alertType, userId, differentTenantId, parentCaseId, priority);

      expect(result).toBeDefined();
      expect(caseRepository.createCase).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: differentTenantId,
        })
      );
    });
  });
});
