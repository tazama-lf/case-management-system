import { Test, TestingModule } from '@nestjs/testing';
import { CaseCreationApprovalService } from '../src/modules/case/services/case-creation-approval.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConfigService } from '@nestjs/config';
import { TaskService } from '../src/modules/task/task.service';
import { AlertRepository } from '../src/modules/repository/alert.repository';
import { TaskRepository } from '../src/modules/repository/task.repository';
import { CaseRepository } from '../src/modules/repository/case.repository';
import { CommentRepository } from '../src/modules/repository/comment.repository';
import { CasePriorityUtil } from '../src/modules/shared/utils/case-priority.util';
import { FlowableService } from '../src/modules/flowable/flowable.service';
import { CaseQueryService } from '../src/modules/case/services/case-query.service';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { InvestigationGroupService } from '../src/modules/investigation-group/investigation-group.service';
import { BadRequestException, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { CaseStatus, TaskStatus, CaseType, Priority, CaseCreationType } from '@prisma/client-cms';
import { TASK_NAMES } from '../src/constants/case.constants';

describe('CaseCreationApprovalService', () => {
  let service: CaseCreationApprovalService;
  let logger: jest.Mocked<LoggerService>;
  let configService: jest.Mocked<ConfigService>;
  let taskService: jest.Mocked<TaskService>;
  let alertRepository: jest.Mocked<AlertRepository>;
  let taskRepository: jest.Mocked<TaskRepository>;
  let caseRepository: jest.Mocked<CaseRepository>;
  let commentRepository: jest.Mocked<CommentRepository>;
  let casePriorityUtil: jest.Mocked<CasePriorityUtil>;
  let flowableService: jest.Mocked<FlowableService>;
  let caseQueryService: jest.Mocked<CaseQueryService>;
  let loggingOrchestrationService: jest.Mocked<LoggingOrchestrationService>;
  let investigationGroupService: jest.Mocked<InvestigationGroupService>;

  const mockCase = {
    case_id: 1,
    tenant_id: 'tenant-123',
    case_creator_user_id: 'creator-123',
    case_owner_user_id: 'owner-123',
    status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
    case_type: CaseType.FRAUD,
    priority: Priority.CRITICAL,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockAlert = {
    alert_id: 100,
    tenant_id: 'tenant-123',
    case_id: null,
    alert_data: { status: 'NALT' },
    alert_type: CaseType.FRAUD,
  };

  const mockTask = {
    task_id: 1,
    case_id: 1,
    name: 'Approve Case Creation',
    status: TaskStatus.STATUS_01_UNASSIGNED,
    tenant_id: 'tenant-123',
  };

  // Helper function to setup successful transaction mock
  const setupSuccessfulTransaction = (caseRepository: any, caseData: any = mockCase) => {
    const mockTransaction = jest.fn(async (callback) => {
      const mockTx = {
        task: {
          update: jest.fn().mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED }),
        },
      };
      return await callback(mockTx);
    });
    caseRepository.executeTransaction.mockImplementation(mockTransaction);
    caseRepository.transaction.mockImplementation(mockTransaction);
    caseRepository.updateCase.mockResolvedValue(caseData as any);
  };

  beforeEach(async () => {
    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('DISABLED'),
    };

    const mockTaskService = {
      createTask: jest.fn(),
      updateTask: jest.fn(),
      getTasksByCaseId: jest.fn(),
    };

    const mockAlertRepository = {
      updateAlert: jest.fn(),
      getAlertByCaseId: jest.fn().mockResolvedValue(100),
    };

    const mockTaskRepository = {
      transaction: jest.fn(),
      findCaseBasic: jest.fn(),
      createTask: jest.fn(),
      findTasks: jest.fn().mockResolvedValue([]),
    };

    const mockCaseRepository = {
      findAlert: jest.fn(),
      executeTransaction: jest.fn(),
      createCase: jest.fn(),
      createDraftCase: jest.fn(),
      updateCase: jest.fn(),
      findCaseWithApprovalTask: jest.fn(),
      findCaseBasicInfo: jest.fn(),
      findTaskByNameAndStatus: jest.fn(),
      transaction: jest.fn(),
    };

    const mockCommentRepository = {
      createComment: jest.fn(),
    };

    const mockCasePriorityUtil = {
      determinePriority: jest.fn().mockReturnValue(Priority.CRITICAL),
    };

    const mockFlowableService = {
      handleCaseCreated: jest.fn().mockResolvedValue({}),
      handleTaskCompleted: jest.fn().mockResolvedValue({}),
      handleCaseStatusChanged: jest.fn().mockResolvedValue({}),
      handleTaskAssigned: jest.fn().mockResolvedValue({}),
    };

    const mockCaseQueryService = {
      retrieveCase: jest.fn(),
      updateCase: jest.fn(),
    };

    const mockLoggingOrchestrationService = {
      logActionsWithHistory: jest.fn().mockResolvedValue({}),
      logActions: jest.fn().mockResolvedValue({}),
    };

    const mockInvestigationGroupService = {
      createInvestigationGroup: jest.fn().mockResolvedValue({ id: 55 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseCreationApprovalService,
        { provide: LoggerService, useValue: mockLogger },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TaskService, useValue: mockTaskService },
        { provide: AlertRepository, useValue: mockAlertRepository },
        { provide: TaskRepository, useValue: mockTaskRepository },
        { provide: CaseRepository, useValue: mockCaseRepository },
        { provide: CommentRepository, useValue: mockCommentRepository },
        { provide: CasePriorityUtil, useValue: mockCasePriorityUtil },
        { provide: FlowableService, useValue: mockFlowableService },
        { provide: CaseQueryService, useValue: mockCaseQueryService },
        { provide: LoggingOrchestrationService, useValue: mockLoggingOrchestrationService },
        { provide: InvestigationGroupService, useValue: mockInvestigationGroupService },
      ],
    }).compile();

    service = module.get<CaseCreationApprovalService>(CaseCreationApprovalService);
    logger = module.get(LoggerService);
    configService = module.get(ConfigService);
    taskService = module.get(TaskService);
    alertRepository = module.get(AlertRepository);
    taskRepository = module.get(TaskRepository);
    caseRepository = module.get(CaseRepository);
    commentRepository = module.get(CommentRepository);
    casePriorityUtil = module.get(CasePriorityUtil);
    flowableService = module.get(FlowableService);
    caseQueryService = module.get(CaseQueryService);
    loggingOrchestrationService = module.get(LoggingOrchestrationService);
    investigationGroupService = module.get(InvestigationGroupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('saveCaseAsDraft', () => {
    const createDto = {
      alertId: 100,
      alertType: 'FRAUD',
      priorityScore: 85,
    };

    it('should save case as draft successfully', async () => {
      caseRepository.findAlert.mockResolvedValue(mockAlert as any);
      const draftCase = { ...mockCase, status: CaseStatus.STATUS_00_DRAFT };
      caseRepository.createDraftCase.mockResolvedValue({
        case: draftCase,
        alert: { ...mockAlert, case_id: 1 },
      } as any);
      taskService.createTask.mockResolvedValue({ task_id: 1, name: 'Complete New Case' } as any);

      const result = await service.saveCaseAsDraft(createDto as any, 'user-123', 'tenant-123', 'investigator');

      expect(result.success).toBe(true);
      expect(result.message).toContain('draft');
      expect(caseRepository.createDraftCase).toHaveBeenCalled();
      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Complete New Case',
          status: TaskStatus.STATUS_10_ASSIGNED,
          assignedUserId: 'user-123',
        }),
        'user-123',
        'tenant-123',
      );
    });

    it.each([
      {
        description: 'alert not found',
        mockSetup: () => caseRepository.findAlert.mockResolvedValue(null),
        error: BadRequestException,
      },
      {
        description: 'alert already has case',
        mockSetup: () => caseRepository.findAlert.mockResolvedValue({ ...mockAlert, case_id: 1 } as any),
        error: BadRequestException,
      },
      {
        description: 'alert is not NALT status',
        mockSetup: () => caseRepository.findAlert.mockResolvedValue({ ...mockAlert, alert_data: { status: 'ALRT' } } as any),
        error: BadRequestException,
      },
      {
        description: 'creation failure',
        mockSetup: () => {
          caseRepository.findAlert.mockResolvedValue(mockAlert as any);
          caseRepository.createDraftCase.mockRejectedValue(new Error('DB error'));
        },
        error: InternalServerErrorException,
      },
    ])('should throw $error.name when $description', async ({ mockSetup, error }) => {
      mockSetup();

      await expect(service.saveCaseAsDraft(createDto as any, 'user-123', 'tenant-123', 'investigator')).rejects.toThrow(error);
    });

    it('starts the Flowable process with isFraudNAML: false for a FRAUD_AND_AML draft, so it still routes through Complete New Case / Approve Case Creation instead of jumping straight to Investigate Case', async () => {
      caseRepository.findAlert.mockResolvedValue(mockAlert as any);
      const draftCase = { ...mockCase, status: CaseStatus.STATUS_00_DRAFT, case_type: CaseType.FRAUD_AND_AML };
      caseRepository.createDraftCase.mockResolvedValue({
        case: draftCase,
        alert: { ...mockAlert, case_id: 1 },
      } as any);
      taskService.createTask.mockResolvedValue({ task_id: 1, name: 'Complete New Case' } as any);

      await service.saveCaseAsDraft({ ...createDto, alertType: 'FRAUD_AND_AML' } as any, 'user-123', 'tenant-123', 'investigator');

      expect(flowableService.handleCaseCreated).toHaveBeenCalledWith(expect.objectContaining({ isFraudNAML: false }));
    });
  });

  describe('approveCaseCreation', () => {
    const pendingCase = {
      ...mockCase,
      status: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
      case_type: CaseType.FRAUD,
      priority: Priority.CRITICAL,
      case_creator_user_id: 'creator-123',
      tasks: [mockTask],
    };

    it('should approve case creation successfully', async () => {
      caseRepository.findCaseWithApprovalTask.mockResolvedValue(pendingCase as any);
      setupSuccessfulTransaction(caseRepository, { ...pendingCase, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT });
      taskService.createTask.mockResolvedValue({ task_id: 2, name: 'Investigate Case' } as any);

      const result = await service.approveCaseCreation(1, 'supervisor-123', 'tenant-123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('approved');
      expect(caseRepository.updateCase).toHaveBeenCalledWith(1, {
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      });
      expect(taskService.createTask).toHaveBeenCalled();
    });

    it('should approve FRAUD_AND_AML case by converting it to FRAUD and creating a sibling AML case with a mirrored task history', async () => {
      const fraudAmlCase = {
        ...pendingCase,
        case_type: CaseType.FRAUD_AND_AML,
        case_id: 1,
        case_creation_type: CaseCreationType.AUTOMATIC_SYSTEM,
      };
      const fraudCase = { ...fraudAmlCase, case_type: CaseType.FRAUD, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT, group_id: 55 };
      const amlCase = { ...fraudCase, case_id: 2, case_type: CaseType.AML };

      caseRepository.findCaseWithApprovalTask.mockResolvedValue(fraudAmlCase as any);
      setupSuccessfulTransaction(caseRepository, { ...fraudAmlCase, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT });
      // First updateCase call (inside the transaction) flips status; second call (post-transaction)
      // converts the case to FRAUD and assigns the investigation group.
      caseRepository.updateCase.mockResolvedValueOnce({ ...fraudAmlCase, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT } as any);
      caseRepository.updateCase.mockResolvedValueOnce(fraudCase as any);
      caseRepository.createCase.mockResolvedValue(amlCase as any);
      // Mock the backfill tasks fetched from the FRAUD case to mirror into AML
      taskRepository.findTasks.mockResolvedValue([
        { name: TASK_NAMES.COMPLETE_NEW_CASE, assigned_user_id: 'creator-123', candidateGroup: 'INVESTIGATIONS' },
        { name: TASK_NAMES.APPROVE_CASE_CREATION, assigned_user_id: 'supervisor-123', candidateGroup: 'SUPERVISORS' },
      ] as any);
      taskService.createTask.mockImplementation((dto: any) =>
        Promise.resolve({ task_id: Math.random(), case_id: dto.caseId, name: dto.name, status: dto.status } as any),
      );

      const result = await service.approveCaseCreation(1, 'supervisor-123', 'tenant-123');

      expect(alertRepository.getAlertByCaseId).toHaveBeenCalledWith(1);
      expect(investigationGroupService.createInvestigationGroup).toHaveBeenCalledWith(100, 'tenant-123');
      expect(caseRepository.updateCase).toHaveBeenCalledWith(1, {
        case_type: CaseType.FRAUD,
        group_id: 55,
      });
      expect(caseRepository.createCase).toHaveBeenCalledWith({
        tenantId: fraudCase.tenant_id,
        caseCreatorUserId: fraudCase.case_creator_user_id,
        caseOwnerUserId: fraudCase.case_owner_user_id,
        status: fraudCase.status,
        priority: fraudCase.priority,
        caseType: CaseType.AML,
        caseCreationType: fraudCase.case_creation_type,
        groupId: 55,
      });

      // AML gets its own completed "Complete New Case" + "Approve Case Creation" tasks,
      // mirroring the FRAUD case's history, plus an "Investigate Case" task like FRAUD.
      expect(taskService.createTask).toHaveBeenCalledTimes(4);
      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: amlCase.case_id,
          name: TASK_NAMES.COMPLETE_NEW_CASE,
          status: TaskStatus.STATUS_30_COMPLETED,
        }),
        'supervisor-123',
        'tenant-123',
      );
      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: amlCase.case_id,
          name: TASK_NAMES.APPROVE_CASE_CREATION,
          status: TaskStatus.STATUS_30_COMPLETED,
        }),
        'supervisor-123',
        'tenant-123',
      );
      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ caseId: fraudCase.case_id, name: TASK_NAMES.INVESTIGATE_CASE }),
        'supervisor-123',
        'tenant-123',
      );
      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ caseId: amlCase.case_id, name: TASK_NAMES.INVESTIGATE_CASE }),
        'supervisor-123',
        'tenant-123',
      );

      // AML gets its own Flowable process (isFraudNAML: true routes it straight to
      // Investigate Case, same as createCaseWithInvestigationTask's cases) and its
      // own status-changed call, in addition to the FRAUD case's own calls.
      expect(flowableService.handleCaseCreated).toHaveBeenCalledWith(
        expect.objectContaining({ caseId: amlCase.case_id, isFraudNAML: true }),
      );
      expect(flowableService.handleCaseStatusChanged).toHaveBeenCalledTimes(2);
      expect(flowableService.handleCaseStatusChanged).toHaveBeenCalledWith({
        caseId: amlCase.case_id,
        newStatus: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      });
      // No handleTaskCompleted for AML's backfilled "Complete New Case"/"Approve Case
      // Creation" tasks - BPMN never creates those tasks on the isFraudNAML=true route,
      // so there's nothing in Flowable to complete for them.
      expect(flowableService.handleTaskCompleted).toHaveBeenCalledTimes(1);
      expect(flowableService.handleTaskCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ caseId: 1, taskName: 'Approve Case Creation' }),
      );

      expect(result.case.case_type).toBe(CaseType.FRAUD);
    });

    it.each([
      {
        description: 'case not found',
        mockSetup: () => caseRepository.findCaseWithApprovalTask.mockResolvedValue(null),
        error: NotFoundException,
      },
      {
        description: 'case not pending approval',
        mockSetup: () =>
          caseRepository.findCaseWithApprovalTask.mockResolvedValue({
            ...pendingCase,
            status: CaseStatus.STATUS_00_DRAFT,
            tasks: [mockTask],
          } as any),
        error: ConflictException,
      },
      {
        description: 'missing required fields',
        mockSetup: () =>
          caseRepository.findCaseWithApprovalTask.mockResolvedValue({ ...pendingCase, case_type: null, tasks: [mockTask] } as any),
        error: BadRequestException,
      },
      {
        description: 'approval task not found',
        mockSetup: () => caseRepository.findCaseWithApprovalTask.mockResolvedValue({ ...pendingCase, tasks: [] } as any),
        error: NotFoundException,
      },
    ])('should throw $error.name when $description', async ({ mockSetup, error }) => {
      mockSetup();

      await expect(service.approveCaseCreation(1, 'supervisor-123', 'tenant-123')).rejects.toThrow(error);
    });
  });

  describe('rejectCaseCreation', () => {
    const pendingCase = {
      ...mockCase,
      status: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL,
      case_type: CaseType.FRAUD,
      priority: Priority.CRITICAL,
      case_creator_user_id: 'creator-123',
      tasks: [mockTask],
    };

    it('should reject case creation successfully', async () => {
      caseRepository.findCaseWithApprovalTask.mockResolvedValue(pendingCase as any);
      caseQueryService.retrieveCase.mockResolvedValue(pendingCase as any);

      const mockTransaction = jest.fn(async (callback) => {
        const mockTx = {
          task: {
            findFirst: jest.fn().mockResolvedValue(mockTask),
          },
        };
        return await callback(mockTx);
      });
      caseRepository.executeTransaction.mockImplementation(mockTransaction);
      caseRepository.transaction.mockImplementation(mockTransaction);
      caseRepository.updateCase.mockResolvedValue({ ...pendingCase, status: CaseStatus.STATUS_00_DRAFT } as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED } as any);
      taskService.createTask.mockResolvedValue({ task_id: 2, name: 'Complete New Case' } as any);
      commentRepository.createComment.mockResolvedValue({} as any);

      const result = await service.rejectCaseCreation(1, 'supervisor-123', 'tenant-123', 'Insufficient evidence');

      expect(result.success).toBe(true);
      expect(caseRepository.updateCase).toHaveBeenCalledWith(1, { status: CaseStatus.STATUS_00_DRAFT });
      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Complete New Case',
          assignedUserId: 'creator-123',
        }),
        'supervisor-123',
        'tenant-123',
        expect.anything(),
      );
      expect(commentRepository.createComment).toHaveBeenCalled();
    });

    it.each([
      {
        description: 'case not found',
        mockSetup: () => caseRepository.findCaseWithApprovalTask.mockResolvedValue(null),
        error: NotFoundException,
      },
      {
        description: 'case not pending approval',
        mockSetup: () =>
          caseRepository.findCaseWithApprovalTask.mockResolvedValue({
            ...pendingCase,
            status: CaseStatus.STATUS_00_DRAFT,
            tasks: [mockTask],
          } as any),
        error: ConflictException,
      },
      {
        description: 'approval task not found',
        mockSetup: () => caseRepository.findCaseWithApprovalTask.mockResolvedValue({ ...pendingCase, tasks: [] } as any),
        error: NotFoundException,
      },
    ])('should throw $error.name when $description', async ({ mockSetup, error }) => {
      mockSetup();

      await expect(service.rejectCaseCreation(1, 'supervisor-123', 'tenant-123', 'Valid reason')).rejects.toThrow(error);
    });
  });

  describe('completeCase', () => {
    const draftCase = {
      ...mockCase,
      case_id: 1,
      status: CaseStatus.STATUS_00_DRAFT,
      priority: Priority.CRITICAL,
      case_type: CaseType.FRAUD,
    };

    it('should complete draft case successfully', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(draftCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([
        { task_id: 1, name: 'Complete New Case', status: TaskStatus.STATUS_10_ASSIGNED },
      ] as any);

      const mockTransaction = jest.fn(async (callback) => {
        return await callback();
      });
      caseRepository.executeTransaction.mockImplementation(mockTransaction);
      caseQueryService.updateCase.mockResolvedValue({ ...draftCase, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT } as any);
      taskService.updateTask.mockResolvedValue({ task_id: 1, status: TaskStatus.STATUS_30_COMPLETED } as any);
      taskService.createTask.mockResolvedValue({ task_id: 2, name: 'Investigate Case' } as any);

      const result = await service.completeCase(1, 'user-123', 'tenant-123');

      expect(result.success).toBe(true);
      expect(caseQueryService.updateCase).toHaveBeenCalledWith(1, { status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT }, 'user-123');
      expect(taskService.createTask).toHaveBeenCalledWith(expect.objectContaining({ name: 'Investigate Case' }), 'user-123', 'tenant-123');
    });

    it.each([
      {
        description: 'case not found',
        mockSetup: () => caseQueryService.retrieveCase.mockResolvedValue(undefined as any),
        error: BadRequestException,
      },
      {
        description: 'case is not DRAFT',
        mockSetup: () => caseQueryService.retrieveCase.mockResolvedValue({ ...draftCase, status: CaseStatus.STATUS_20_IN_PROGRESS } as any),
        error: BadRequestException,
      },
      {
        description: 'missing priority',
        mockSetup: () => caseQueryService.retrieveCase.mockResolvedValue({ ...draftCase, priority: null } as any),
        error: BadRequestException,
      },
      {
        description: 'missing case_type',
        mockSetup: () => caseQueryService.retrieveCase.mockResolvedValue({ ...draftCase, case_type: null } as any),
        error: BadRequestException,
      },
      {
        description: 'Complete New Case task not found',
        mockSetup: () => {
          caseQueryService.retrieveCase.mockResolvedValue(draftCase as any);
          taskService.getTasksByCaseId.mockResolvedValue([]);
        },
        error: InternalServerErrorException,
      },
      {
        description: 'Complete New Case task already completed',
        mockSetup: () => {
          caseQueryService.retrieveCase.mockResolvedValue(draftCase as any);
          taskService.getTasksByCaseId.mockResolvedValue([
            { task_id: 1, name: 'Complete New Case', status: TaskStatus.STATUS_30_COMPLETED },
          ] as any);
        },
        error: InternalServerErrorException,
      },
      {
        description: 'transaction failure',
        mockSetup: () => {
          caseQueryService.retrieveCase.mockResolvedValue(draftCase as any);
          taskService.getTasksByCaseId.mockResolvedValue([
            { task_id: 1, name: 'Complete New Case', status: TaskStatus.STATUS_10_ASSIGNED },
          ] as any);
          caseRepository.executeTransaction.mockImplementation(async () => {
            throw new Error('Transaction failed');
          });
        },
        error: InternalServerErrorException,
      },
    ])('should throw $error.name when $description', async ({ mockSetup, error }) => {
      mockSetup();

      await expect(service.completeCase(1, 'user-123', 'tenant-123')).rejects.toThrow(error);
    });
  });

  describe('updateCaseStatus', () => {
    it('should update case status to READY_FOR_ASSIGNMENT and create investigate task', async () => {
      taskRepository.transaction.mockImplementation(async (callback) => {
        const mockTx = {} as any;
        return await callback(mockTx);
      });
      taskRepository.findCaseBasic.mockResolvedValue({ case_id: 1, tenant_id: 'tenant-123' } as any);
      taskRepository.createTask.mockResolvedValue({ task_id: 1 } as any);
      caseRepository.updateCase.mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT } as any);

      const result = await service.updateCaseStatus(
        1,
        CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        'user-123',
        'tenant-123',
        Priority.CRITICAL,
        CaseType.FRAUD,
      );

      expect(result.status).toBe(CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT);
      expect(taskRepository.createTask).toHaveBeenCalledWith(expect.objectContaining({ name: 'Investigate Case' }), expect.anything());
    });

    it('should not create investigate task for FRAUD_AND_AML', async () => {
      taskRepository.transaction.mockImplementation(async (callback) => {
        const mockTx = {} as any;
        return await callback(mockTx);
      });
      taskRepository.findCaseBasic.mockResolvedValue({ case_id: 1, tenant_id: 'tenant-123' } as any);
      caseRepository.updateCase.mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT } as any);

      await service.updateCaseStatus(
        1,
        CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        'user-123',
        'tenant-123',
        Priority.CRITICAL,
        CaseType.FRAUD_AND_AML,
      );

      expect(taskRepository.createTask).not.toHaveBeenCalled();
    });

    it('should update case status without creating task for other statuses', async () => {
      caseRepository.updateCase.mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_00_DRAFT } as any);

      const result = await service.updateCaseStatus(1, CaseStatus.STATUS_00_DRAFT, 'user-123', 'tenant-123');

      expect(result.status).toBe(CaseStatus.STATUS_00_DRAFT);
      expect(taskRepository.transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if case not found during task creation', async () => {
      taskRepository.transaction.mockImplementation(async (callback) => {
        const mockTx = {} as any;
        return await callback(mockTx);
      });
      taskRepository.findCaseBasic.mockResolvedValue(null);

      await expect(
        service.updateCaseStatus(1, CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT, 'user-123', 'tenant-123', Priority.CRITICAL, CaseType.FRAUD),
      ).rejects.toThrow(NotFoundException);
    });

    it('should log actions and handle flowable service', async () => {
      caseRepository.updateCase.mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_00_DRAFT } as any);

      await service.updateCaseStatus(1, CaseStatus.STATUS_00_DRAFT, 'user-123', 'tenant-123');

      expect(flowableService.handleCaseStatusChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 1,
          newStatus: CaseStatus.STATUS_00_DRAFT,
        }),
      );
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalled();
    });
  });
});
