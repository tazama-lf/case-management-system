import { Test, TestingModule } from '@nestjs/testing';
import { CaseCreationService } from '../src/modules/case/services/case-creation.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CaseRepository } from '../src/modules/repository/case.repository';
import { TaskService } from '../src/modules/task/task.service';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { FlowableService } from '../src/modules/flowable/flowable.service';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { CaseCreationType, CaseStatus, CaseType, Priority, TaskStatus } from '@prisma/client-cms';
import { CreateCaseDto } from '../src/modules/case/dto';
import { CasePriorityUtil } from '../src/modules/shared/utils/case-priority.util';
import { AlertRepository } from '../src/modules/repository/alert.repository';
import { InvestigationGroupService } from '../src/modules/investigation-group/investigation-group.service';

describe('CaseCreationService', () => {
  let service: CaseCreationService;
  let logger: any;
  let caseRepository: any;
  let taskService: any;
  let loggingOrchestrationService: any;
  let flowableService: any;
  let casePriorityUtil: any;
  let alertRepository: any;
  let investigationGroupService: any;

  const mockCase = {
    case_id: 1,
    tenant_id: 'tenant-123',
    case_creator_user_id: 'user-123',
    case_owner_user_id: 'user-123',
    status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
    priority: Priority.HIGH,
    case_type: CaseType.FRAUD,
    case_creation_type: CaseCreationType.AUTOMATIC_SYSTEM,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const setupSuccessfulCaseCreation = () => {
    caseRepository.createCase.mockResolvedValueOnce(mockCase);
    flowableService.handleCaseCreated.mockResolvedValueOnce(undefined);
    loggingOrchestrationService.logActionsWithHistory.mockResolvedValueOnce(undefined);
  };

  const setupSuccessfulTaskCreation = () => {
    taskService.createTask.mockResolvedValueOnce({
      task_id: 1,
      name: 'Investigate Case',
      status: TaskStatus.STATUS_01_UNASSIGNED,
    });
    flowableService.handleTaskCompleted.mockResolvedValueOnce(undefined);
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
      findAlert: jest.fn(),
      transaction: jest.fn(),
    };

    const mockTaskService = {
      createTask: jest.fn(),
    };

    const mockLoggingOrchestrationService = {
      logActions: jest.fn(),
      logActionsWithHistory: jest.fn(),
    };

    const mockFlowableService = {
      handleCaseCreated: jest.fn(),
      handleTaskCompleted: jest.fn(),
    };

    const mockCasePriorityUtil = {
      determinePriority: jest.fn().mockResolvedValue(Priority.HIGH),
    };

    const mockAlertRepository = {
      updateAlert: jest.fn(),
    };

    const mockInvestigationGroupService = {
      createInvestigationGroup: jest.fn().mockResolvedValue({
        id: 123,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseCreationService,
        { provide: LoggerService, useValue: mockLogger },
        { provide: CaseRepository, useValue: mockCaseRepository },
        { provide: TaskService, useValue: mockTaskService },
        { provide: LoggingOrchestrationService, useValue: mockLoggingOrchestrationService },
        { provide: FlowableService, useValue: mockFlowableService },
        { provide: CasePriorityUtil, useValue: mockCasePriorityUtil },
        { provide: AlertRepository, useValue: mockAlertRepository },
        { provide: InvestigationGroupService, useValue: mockInvestigationGroupService },
      ],
    }).compile();

    service = module.get<CaseCreationService>(CaseCreationService);
    logger = module.get(LoggerService);
    caseRepository = module.get(CaseRepository);
    taskService = module.get(TaskService);
    loggingOrchestrationService = module.get(LoggingOrchestrationService);
    flowableService = module.get(FlowableService);
    casePriorityUtil = module.get(CasePriorityUtil);
    alertRepository = module.get(AlertRepository);
    investigationGroupService = module.get(InvestigationGroupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCase', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const userRole = 'SYSTEM';
    const createCaseDto: CreateCaseDto = {
      tenantId: 'tenant-123',
      caseCreatorUserId: 'user-123',
      caseOwnerUserId: 'user-123',
      status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      priority: Priority.HIGH,
      caseType: CaseType.FRAUD,
      caseCreationType: CaseCreationType.AUTOMATIC_SYSTEM,
    };

    it('should successfully create a case', async () => {
      setupSuccessfulCaseCreation();

      const result = await service.createCase(createCaseDto, userId, tenantId, userRole);

      expect(result).toEqual(mockCase);
      expect(logger.log).toHaveBeenCalledWith('Start - Create Case', 'CaseCreationService');
      expect(logger.log).toHaveBeenCalledWith('End - Create Case', 'CaseCreationService');
      expect(caseRepository.createCase).toHaveBeenCalledWith({
        tenantId: createCaseDto.tenantId,
        caseCreatorUserId: createCaseDto.caseCreatorUserId,
        caseOwnerUserId: createCaseDto.caseOwnerUserId,
        status: createCaseDto.status,
        priority: createCaseDto.priority,
        caseType: createCaseDto.caseType,
        caseCreationType: createCaseDto.caseCreationType,
      });
      expect(flowableService.handleCaseCreated).toHaveBeenCalledWith({
        caseId: mockCase.case_id,
        tenantId: mockCase.tenant_id,
        caseStatus: mockCase.status,
        creationType: createCaseDto.caseCreationType,
        creatorRole: userRole,
        isReopened: false,
        isFraudNAML: false,
      });
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalledWith(
        {
          userId,
          tenantId,
          operation: 'createCase',
          entityName: 'CaseCreationService',
          actionPerformed: `Case ${mockCase.case_id} created successfully`,
          outcome: 'SUCCESS',
        },
        mockCase.case_id,
        tenantId,
      );
    });

    it.each([
      ['status', { status: CaseStatus.STATUS_00_DRAFT }, { status: CaseStatus.STATUS_00_DRAFT }],
      ['priority', { priority: Priority.MEDIUM }, { priority: Priority.MEDIUM }],
      ['case type', { caseType: CaseType.AML }, { case_type: CaseType.AML }],
      ['creation type', { caseCreationType: CaseCreationType.MANUAL }, { case_creation_type: CaseCreationType.MANUAL }],
    ])('should create case with different %s', async (field, dtoOverride, caseOverride) => {
      const customDto: CreateCaseDto = { ...createCaseDto, ...dtoOverride };
      const customCase = { ...mockCase, ...caseOverride };
      caseRepository.createCase.mockResolvedValueOnce(customCase);
      flowableService.handleCaseCreated.mockResolvedValueOnce(undefined);
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValueOnce(undefined);

      const result = await service.createCase(customDto, userId, tenantId, userRole);

      expect(result).toMatchObject(caseOverride);
    });

    it.each([
      ['Database error', new Error('Database error')],
      ['InternalServerErrorException', new InternalServerErrorException('Internal error')],
    ])('should handle %s during case creation', async (errorType, error) => {
      caseRepository.createCase.mockRejectedValueOnce(error);

      await expect(service.createCase(createCaseDto, userId, tenantId, userRole)).rejects.toThrow(error);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[CaseWorkflow] Error creating case'),
        expect.any(String),
        'CaseCreationService',
      );
    });
  });

  describe('createCaseWithInvestigationTask', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const userRole = 'SYSTEM';

    it('should successfully create case with investigation task', async () => {
      setupSuccessfulCaseCreation();
      setupSuccessfulTaskCreation();
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValueOnce(undefined);

      const result = await service.createCaseWithInvestigationTask(
        CaseType.FRAUD,
        userId,
        tenantId,
        Priority.HIGH,
        CaseCreationType.AUTOMATIC_SYSTEM,
        userRole,
      );

      expect(result).toEqual({
        caseId: mockCase.case_id,
        message: 'Case created, BPMN will create investigation task',
        taskId: 1,
      });
      expect(caseRepository.createCase).toHaveBeenCalledWith({
        caseCreatorUserId: userId,
        caseOwnerUserId: undefined,
        tenantId,
        priority: Priority.HIGH,
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        caseType: CaseType.FRAUD,
        caseCreationType: CaseCreationType.AUTOMATIC_SYSTEM,
      });
      expect(flowableService.handleCaseCreated).toHaveBeenCalledTimes(1);
      expect(flowableService.handleCaseCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: mockCase.case_id,
          isFraudNAML: true,
        }),
      );
      expect(taskService.createTask).toHaveBeenNthCalledWith(
        1,
        {
          caseId: mockCase.case_id,
          status: TaskStatus.STATUS_30_COMPLETED,
          assignedUserId: userId,
          name: 'Complete New Case',
          description: `Investigation task for manually created case ${mockCase.case_id}`,
          candidateGroup: 'investigations',
        },
        userId,
        tenantId,
      );
      expect(taskService.createTask).toHaveBeenNthCalledWith(
        2,
        {
          caseId: mockCase.case_id,
          status: TaskStatus.STATUS_01_UNASSIGNED,
          name: 'Investigate Case',
          description: `Created for triaging alert for case:${mockCase.case_id}`,
          candidateGroup: 'investigations',
        },
        userId,
        tenantId,
      );
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalledWith(
        {
          userId,
          tenantId,
          operation: 'createCase',
          entityName: 'CaseCreationService',
          actionPerformed: `Case ${mockCase.case_id} created successfully`,
          outcome: 'SUCCESS',
        },
        mockCase.case_id,
        tenantId,
      );
    });

    it.each([
      ['FRAUD', CaseType.FRAUD],
      ['AML', CaseType.AML],
      ['FRAUD_AND_AML', CaseType.FRAUD_AND_AML],
    ])('should create %s case type', async (typeName, caseType) => {
      const customCase = { ...mockCase, case_type: caseType };
      caseRepository.createCase.mockResolvedValueOnce(customCase);
      setupSuccessfulTaskCreation();
      flowableService.handleCaseCreated.mockResolvedValueOnce(undefined);
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValueOnce(undefined);

      const result = await service.createCaseWithInvestigationTask(
        caseType,
        userId,
        tenantId,
        Priority.HIGH,
        CaseCreationType.AUTOMATIC_SYSTEM,
        userRole,
      );

      expect(result).toBeDefined();
      expect(caseRepository.createCase).toHaveBeenCalledWith(expect.objectContaining({ caseType }));
    });

    it('should create case with investigation group id', async () => {
      caseRepository.createCase.mockResolvedValueOnce({ ...mockCase, group_id: 123 });
      setupSuccessfulTaskCreation();
      flowableService.handleCaseCreated.mockResolvedValueOnce(undefined);
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValueOnce(undefined);

      const result = await service.createCaseWithInvestigationTask(
        CaseType.AML,
        userId,
        tenantId,
        Priority.HIGH,
        CaseCreationType.AUTOMATIC_SYSTEM,
        userRole,
        123,
      );

      expect(result).toBeDefined();
      expect(caseRepository.createCase).toHaveBeenCalledWith(expect.objectContaining({ groupId: 123 }));
    });

    it.each([
      ['HIGH', Priority.HIGH],
      ['MEDIUM', Priority.MEDIUM],
      ['LOW', Priority.LOW],
    ])('should create case with %s priority', async (priorityName, priority) => {
      const customCase = { ...mockCase, priority };
      caseRepository.createCase.mockResolvedValueOnce(customCase);
      setupSuccessfulTaskCreation();
      flowableService.handleCaseCreated.mockResolvedValueOnce(undefined);
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValueOnce(undefined);

      const result = await service.createCaseWithInvestigationTask(
        CaseType.FRAUD,
        userId,
        tenantId,
        priority,
        CaseCreationType.AUTOMATIC_SYSTEM,
        userRole,
      );

      expect(result).toBeDefined();
      expect(caseRepository.createCase).toHaveBeenCalledWith(expect.objectContaining({ priority }));
    });

    it('should throw InternalServerErrorException on case creation error', async () => {
      const error = new Error('Database connection failed');
      caseRepository.createCase.mockRejectedValueOnce(error);

      await expect(
        service.createCaseWithInvestigationTask(
          CaseType.FRAUD,
          userId,
          tenantId,
          Priority.HIGH,
          CaseCreationType.AUTOMATIC_SYSTEM,
          userRole,
        ),
      ).rejects.toThrow(InternalServerErrorException);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to create ${CaseType.FRAUD} case`),
        expect.any(String),
        'CaseCreationService',
      );
    });
  });

  describe('manualCaseCreation', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const userRole = 'SUPERVISOR';
    const mockAlert = {
      alert_id: 1,
      case_id: null,
      alert_data: { status: 'NALT' },
      tenant_id: tenantId,
    };
    const mockUpdatedAlert = { ...mockAlert, case_id: 1 };
    const manualCaseDto = {
      alertId: 1,
      alertType: CaseType.FRAUD,
      priorityScore: 85,
    };

    it('should create manual case as supervisor (no approval needed)', async () => {
      caseRepository.findAlert.mockResolvedValueOnce(mockAlert);
      caseRepository.createCase.mockResolvedValueOnce(mockCase);
      flowableService.handleCaseCreated.mockResolvedValueOnce(undefined);
      caseRepository.transaction.mockImplementationOnce(async (callback) => {
        alertRepository.updateAlert.mockResolvedValueOnce(mockUpdatedAlert);
        return callback();
      });
      taskService.createTask.mockResolvedValueOnce({ task_id: 1 });
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValueOnce(undefined);

      const result = await service.manualCaseCreation(manualCaseDto, userId, tenantId, userRole);

      expect(result.success).toBe(true);
      expect(result.case).toEqual(mockCase);
      expect(result.alert).toBeDefined();
      expect(caseRepository.createCase).toHaveBeenCalledWith(
        expect.objectContaining({
          status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
          caseOwnerUserId: userId,
          caseCreationType: CaseCreationType.MANUAL,
        }),
      );
      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Investigate Case',
          candidateGroup: 'investigations',
        }),
        userId,
        tenantId,
        undefined,
      );
      expect(flowableService.handleCaseCreated).toHaveBeenCalledTimes(1);
    });

    it('should create manual case as investigator (needs approval)', async () => {
      caseRepository.findAlert.mockResolvedValueOnce(mockAlert);
      const pendingCase = { ...mockCase, status: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL, case_owner_user_id: null };
      caseRepository.createCase.mockResolvedValueOnce(pendingCase);
      flowableService.handleCaseCreated.mockResolvedValueOnce(undefined);
      caseRepository.transaction.mockImplementationOnce(async (callback) => {
        alertRepository.updateAlert.mockResolvedValueOnce(mockUpdatedAlert);
        return callback();
      });
      taskService.createTask.mockResolvedValueOnce({ task_id: 1 });
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValueOnce(undefined);

      const result = await service.manualCaseCreation(manualCaseDto, userId, tenantId, 'INVESTIGATOR');

      expect(result.success).toBe(true);
      expect(caseRepository.createCase).toHaveBeenCalledWith(
        expect.objectContaining({
          status: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
          caseOwnerUserId: undefined,
        }),
      );
      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Approve Case Creation',
          candidateGroup: 'supervisors',
        }),
        userId,
        tenantId,
        undefined,
      );
    });

    it('should create separate FRAUD and AML cases for FRAUD_AND_AML manual creation', async () => {
      const fraudAndAmlDto = { ...manualCaseDto, alertType: CaseType.FRAUD_AND_AML };
      const fraudCase = { ...mockCase, case_type: CaseType.FRAUD };

      caseRepository.findAlert.mockResolvedValueOnce(mockAlert);
      caseRepository.createCase.mockResolvedValueOnce(fraudCase);
      flowableService.handleCaseCreated.mockResolvedValue(undefined);

      caseRepository.createCase.mockResolvedValueOnce({ ...mockCase, case_type: CaseType.AML });

      caseRepository.transaction.mockImplementationOnce(async (callback) => {
        alertRepository.updateAlert.mockResolvedValueOnce(mockUpdatedAlert);
        taskService.createTask.mockResolvedValue({ task_id: 1 });
        return callback();
      });

      loggingOrchestrationService.logActions.mockResolvedValue(undefined);
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValueOnce(undefined);

      const result = await service.manualCaseCreation(fraudAndAmlDto, userId, tenantId, userRole);

      expect(result.success).toBe(true);
      expect(result.case).toEqual(fraudCase);
      expect(caseRepository.createCase).toHaveBeenCalledTimes(2);
      expect(flowableService.handleCaseCreated).toHaveBeenCalledTimes(2);
      expect(investigationGroupService.createInvestigationGroup).toHaveBeenCalledWith(1, tenantId);
      expect(caseRepository.createCase).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          caseType: CaseType.FRAUD,
          groupId: 123,
        }),
      );
      expect(caseRepository.createCase).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          caseType: CaseType.AML,
          groupId: 123,
        }),
      );
      expect(caseRepository.createCase).not.toHaveBeenCalledWith(
        expect.objectContaining({
          caseType: CaseType.FRAUD_AND_AML,
        }),
      );
    });

    it('should throw BadRequestException if alert not found', async () => {
      caseRepository.findAlert.mockResolvedValueOnce(null);

      await expect(service.manualCaseCreation(manualCaseDto, userId, tenantId, userRole)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if case already exists', async () => {
      const alertWithCase = { ...mockAlert, case_id: 123 };
      caseRepository.findAlert.mockResolvedValueOnce(alertWithCase);

      await expect(service.manualCaseCreation(manualCaseDto, userId, tenantId, userRole)).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on creation failure', async () => {
      caseRepository.findAlert.mockResolvedValueOnce(mockAlert);
      caseRepository.createCase.mockRejectedValueOnce(new Error('DB Error'));

      await expect(service.manualCaseCreation(manualCaseDto, userId, tenantId, userRole)).rejects.toThrow(InternalServerErrorException);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
