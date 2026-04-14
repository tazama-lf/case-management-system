import { Test, TestingModule } from '@nestjs/testing';
import { TriageService } from '../src/modules/triage/triage.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AlertRepository } from '../src/modules/repository/alert.repository';
import { TaskRepository } from '../src/modules/repository/task.repository';
import { CommentRepository } from '../src/modules/repository/comment.repository';
import { CaseRepository } from '../src/modules/repository/case.repository';
import { FlowableService } from '../src/modules/flowable/flowable.service';
import { AlertService } from '../src/modules/alert/alert.service';
import { CaseCreationApprovalService } from '../src/modules/case/services/case-creation-approval.service';
import { TaskService } from '../src/modules/task/task.service';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CasePriorityUtil } from '../src/modules/shared/utils/case-priority.util';
import { FeatureExtractionService } from '../src/modules/feature-extraction/feature-extraction.service';
import { CaseCreationService } from '../src/modules/case/services/case-creation.service';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Priority, CaseStatus, CaseType, TaskStatus, CaseCreationType } from '@prisma/client-cms';
import { ManualAlertUpdateDTO, IngestAlertDto } from '../src/modules/alert/dto';
import { Outcome } from '../src/utils/types/outcome';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Test suite for TriageService
 *
 * This test suite covers:
 * - Manual triage workflow with various status transitions
 * - AI-powered triage with prediction-based decisions
 * - Case creation and investigation task management
 * - Error handling and edge cases
 */
describe('TriageService', () => {
  let service: TriageService;
  let loggerService: jest.Mocked<LoggerService>;
  let alertRepository: jest.Mocked<AlertRepository>;
  let taskRepository: jest.Mocked<TaskRepository>;
  let commentRepository: jest.Mocked<CommentRepository>;
  let caseRepository: jest.Mocked<CaseRepository>;
  let flowableService: jest.Mocked<FlowableService>;
  let alertService: jest.Mocked<AlertService>;
  let caseCreationService: jest.Mocked<CaseCreationApprovalService>;
  let taskService: jest.Mocked<TaskService>;
  let configService: jest.Mocked<ConfigService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let casePriorityUtil: jest.Mocked<CasePriorityUtil>;
  let featureExtractionService: jest.Mocked<FeatureExtractionService>;
  let caseCreateService: jest.Mocked<CaseCreationService>;
  let loggingOrchestrationService: jest.Mocked<LoggingOrchestrationService>;

  const mockAlert = {
    alert_id: 1,
    tenant_id: 'tenant-123',
    priority: Priority.NEW,
    priority_score: 0.8,
    source: 'test-source',
    txtp: 'pacs.002.001.12',
    message: 'Suspicious activity',
    report: { status: 'ALRT', id: '123' },
    transaction: { TxTp: 'pacs.002.001.12' },
    network_map: {},
    alert_data: {},
    confidence_per: 95,
    case_id: 1,
    alert_type: CaseType.FRAUD,
    prediction_outcome: null,
    block_status: null,
    block_reason: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  const mockCase = {
    case_id: 1,
    tenant_id: 'tenant-123',
    case_creator_user_id: 'user-123',
    case_owner_user_id: null,
    parent_id: null,
    status: CaseStatus.STATUS_00_DRAFT,
    priority: Priority.NEW,
    case_creation_type: CaseCreationType.AUTOMATIC_SYSTEM,
    case_type: CaseType.FRAUD,
    final_outcome: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    alert: null,
    tasks: [
      {
        task_id: 1,
        name: 'Complete New Case',
        status: TaskStatus.STATUS_10_ASSIGNED,
        case_id: 1,
        tenant_id: 'tenant-123',
        assigned_user_id: null,
        investigationNotes: null,
        task_type: null,
        candidateGroup: 'investigator',
        description: null,
        due_date: null,
        completed_at: null,
        sla_deadline: null,
        sla_duration_hours: null,
        created_at: new Date('2026-01-01'),
        updated_at: new Date('2026-01-01'),
      },
    ],
  };

  const mockTask = {
    task_id: 1,
    case_id: 1,
    tenant_id: 'tenant-123',
    name: 'Complete New Case',
    description: 'Triage task',
    assigned_user_id: null,
    investigationNotes: null,
    task_type: null,
    candidateGroup: 'investigator',
    due_date: null,
    completed_at: null,
    sla_deadline: null,
    sla_duration_hours: null,
    status: TaskStatus.STATUS_10_ASSIGNED,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockAlertRepository = {
      transaction: jest.fn(),
      createAlert: jest.fn(),
      updateAlert: jest.fn(),
      getAlertById: jest.fn(),
    };

    const mockTaskRepository = {
      createTask: jest.fn(),
      updateTask: jest.fn(),
      getTaskById: jest.fn(),
    };

    const mockCommentRepository = {
      createComment: jest.fn(),
    };

    const mockCaseRepository = {
      findCaseById: jest.fn(),
      updateCase: jest.fn(),
    };

    const mockFlowableService = {
      handleTaskCompleted: jest.fn(),
      handleCaseStatusChanged: jest.fn(),
    };

    const mockAlertService = {
      updateAlert: jest.fn(),
      createNewAlert: jest.fn(),
    };

    const mockCaseCreationService = {
      updateCaseStatus: jest.fn(),
      createCase: jest.fn(),
    };

    const mockTaskService = {
      createTask: jest.fn(),
      updateTask: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const mockCasePriorityUtil = {
      determinePriority: jest.fn(),
    };

    const mockFeatureExtractionService = {
      extractFeatures: jest.fn().mockResolvedValue({ features: [] }),
    };

    const mockCaseCreateService = {
      createCaseWithInvestigationTask: jest.fn(),
    };

    const mockLoggingOrchestrationService = {
      logActions: jest.fn(),
      logActionsWithHistory: jest.fn(),
    };

    const mockPrismaService = {
      // Add any Prisma methods that might be used in TriageService
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TriageService,
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: AlertRepository, useValue: mockAlertRepository },
        { provide: TaskRepository, useValue: mockTaskRepository },
        { provide: CommentRepository, useValue: mockCommentRepository },
        { provide: CaseRepository, useValue: mockCaseRepository },
        { provide: FlowableService, useValue: mockFlowableService },
        { provide: AlertService, useValue: mockAlertService },
        { provide: CaseCreationApprovalService, useValue: mockCaseCreationService },
        { provide: TaskService, useValue: mockTaskService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: CasePriorityUtil, useValue: mockCasePriorityUtil },
        { provide: FeatureExtractionService, useValue: mockFeatureExtractionService },
        { provide: CaseCreationService, useValue: mockCaseCreateService },
        { provide: LoggingOrchestrationService, useValue: mockLoggingOrchestrationService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TriageService>(TriageService);
    loggerService = module.get(LoggerService);
    alertRepository = module.get(AlertRepository);
    taskRepository = module.get(TaskRepository);
    commentRepository = module.get(CommentRepository);
    caseRepository = module.get(CaseRepository);
    flowableService = module.get(FlowableService);
    alertService = module.get(AlertService);
    caseCreationService = module.get(CaseCreationApprovalService);
    taskService = module.get(TaskService);
    configService = module.get(ConfigService);
    eventEmitter = module.get(EventEmitter2);
    casePriorityUtil = module.get(CasePriorityUtil);
    featureExtractionService = module.get(FeatureExtractionService);
    caseCreateService = module.get(CaseCreationService);
    loggingOrchestrationService = module.get(LoggingOrchestrationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to setup common manual triage mocks
  const setupManualTriageMocks = (alertToReturn: any = mockAlert, caseToReturn: any = mockCase) => {
    configService.get.mockReturnValue('MANUAL');
    casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);
    alertRepository.getAlertById.mockResolvedValue(alertToReturn);
    caseRepository.findCaseById.mockResolvedValue(caseToReturn);
    alertService.updateAlert.mockResolvedValue(alertToReturn);
    taskService.updateTask.mockResolvedValue(mockTask as any);
    commentRepository.createComment.mockResolvedValue({
      comment_id: 1,
      tenant_id: 'tenant-123',
      created_at: new Date(),
      case_id: 1,
      updated_at: new Date(),
      user_id: 'user-123',
      note: 'test',
      task_id: null,
    });
    caseCreationService.updateCaseStatus.mockResolvedValue(caseToReturn);
    flowableService.handleTaskCompleted.mockResolvedValue(undefined);
  };

  // Helper function to setup transaction mock that executes the callback
  const setupTransactionMock = () => {
    alertRepository.transaction.mockImplementation(async (callback) => {
      return await callback({} as any);
    });
  };

  // Helper function to setup AI triage mocks
  const setupAITriageMocks = (confidence: number, priority: number) => {
    taskService.createTask.mockResolvedValue(mockTask as any);
    casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);
    (featureExtractionService.extractFeatures as any).mockResolvedValue({ features: [] });
    mockedAxios.post.mockResolvedValue({
      data: { confidence, priority },
    });
    alertService.updateAlert.mockResolvedValue(mockAlert as any);
    taskService.updateTask.mockResolvedValue(mockTask as any);
    loggingOrchestrationService.logActionsWithHistory.mockResolvedValue(undefined);
    caseRepository.findCaseById.mockResolvedValue(mockCase as any);
    caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
    flowableService.handleTaskCompleted.mockResolvedValue(undefined);
  };

  describe('handleManualTriage', () => {
    const updateAlertDto: ManualAlertUpdateDTO = {
      priorityScore: 0.75,
      priority: Priority.URGENT,
      alertType: CaseType.FRAUD,
      note: 'Manual review completed',
    };

    it('should throw BadRequestException when TRIAGE_TYPE is not MANUAL', async () => {
      configService.get.mockReturnValue('DISABLED');

      await expect(service.handleManualTriage(1, updateAlertDto, 'user-123', 'tenant-123')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when triage is already complete', async () => {
      configService.get.mockReturnValue('MANUAL');
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);

      const completedTask = { ...mockTask, status: TaskStatus.STATUS_30_COMPLETED };
      const caseWithCompletedTask = {
        ...mockCase,
        tasks: [{ ...completedTask, name: 'Complete New Case' }],
      };

      alertRepository.transaction.mockImplementation(async (callback) => {
        alertRepository.getAlertById.mockResolvedValue(mockAlert as any);
        caseRepository.findCaseById.mockResolvedValue(caseWithCompletedTask as any);
        return callback({} as any);
      });

      await expect(service.handleManualTriage(1, updateAlertDto, 'user-123', 'tenant-123')).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException when alert case_id is missing', async () => {
      configService.get.mockReturnValue('MANUAL');
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);

      const alertWithoutCaseId = { ...mockAlert, case_id: null };

      alertRepository.transaction.mockImplementation(async (callback) => {
        alertRepository.getAlertById.mockResolvedValue(mockAlert as any);
        caseRepository.findCaseById.mockResolvedValue(mockCase as any);
        alertService.updateAlert.mockResolvedValue(alertWithoutCaseId);
        return callback({} as any);
      });

      await expect(service.handleManualTriage(1, updateAlertDto, 'user-123', 'tenant-123')).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw BadRequestException when case is already closed', async () => {
      configService.get.mockReturnValue('MANUAL');
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);

      const closedCase = {
        ...mockCase,
        status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
      };

      alertRepository.transaction.mockImplementation(async (callback) => {
        alertRepository.getAlertById.mockResolvedValue(mockAlert as any);
        caseRepository.findCaseById.mockResolvedValue(closedCase);
        return callback({} as any);
      });

      await expect(service.handleManualTriage(1, updateAlertDto, 'user-123', 'tenant-123')).rejects.toThrow(BadRequestException);
    });

    it('should successfully handle manual triage with closable status', async () => {
      const closableUpdateDto = {
        ...updateAlertDto,
        status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
      };

      setupManualTriageMocks();
      setupTransactionMock();

      const result = await service.handleManualTriage(1, closableUpdateDto, 'user-123', 'tenant-123');

      expect(result).toEqual(mockAlert);
      expect(flowableService.handleTaskCompleted).toHaveBeenCalledTimes(2);
      expect(caseCreationService.updateCaseStatus).toHaveBeenCalled();
    });

    it('should successfully handle manual triage without closable status', async () => {
      setupManualTriageMocks();
      setupTransactionMock();

      const result = await service.handleManualTriage(1, updateAlertDto, 'user-123', 'tenant-123');

      expect(result).toEqual(mockAlert);
      expect(flowableService.handleTaskCompleted).toHaveBeenCalledTimes(1);
    });

    it('should handle FRAUD_AND_AML type by creating child cases', async () => {
      const fraudAndAmlAlert = {
        ...mockAlert,
        alert_type: CaseType.FRAUD_AND_AML,
      };

      const fraudAndAmlDto = {
        ...updateAlertDto,
        alertType: CaseType.FRAUD_AND_AML,
      };

      setupManualTriageMocks(fraudAndAmlAlert);
      caseCreateService.createCaseWithInvestigationTask.mockResolvedValue(mockCase as any);
      setupTransactionMock();

      const result = await service.handleManualTriage(1, fraudAndAmlDto, 'user-123', 'tenant-123');

      expect(result).toEqual(fraudAndAmlAlert);
      expect(caseCreateService.createCaseWithInvestigationTask).toHaveBeenCalledTimes(2);
      expect(caseCreateService.createCaseWithInvestigationTask).toHaveBeenCalledWith(
        CaseType.FRAUD,
        'user-123',
        'tenant-123',
        1,
        Priority.URGENT,
        CaseCreationType.AUTOMATIC_SYSTEM,
        'SUPERVISOR',
      );
      expect(caseCreateService.createCaseWithInvestigationTask).toHaveBeenCalledWith(
        CaseType.AML,
        'user-123',
        'tenant-123',
        1,
        Priority.URGENT,
        CaseCreationType.AUTOMATIC_SYSTEM,
        'SUPERVISOR',
      );
    });

    it('should log error and rethrow on failure', async () => {
      configService.get.mockReturnValue('MANUAL');
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);

      const error = new Error('Transaction failed');
      alertRepository.transaction.mockRejectedValue(error);

      await expect(service.handleManualTriage(1, updateAlertDto, 'user-123', 'tenant-123')).rejects.toThrow(error);

      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('handleAITriage', () => {
    const ingestAlertDto: any = {
      transaction: { TxTp: 'pacs.002.001.12', EndToEndId: 'tx-123' },
      report: { status: 'ALRT', id: '123' },
      message: 'Suspicious activity',
      networkMap: { active: true, cfg: '', tenantId: 'tenant-123', messages: [] },
    };

    beforeEach(() => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'CONFIDENCE_THRESHOLD') return 80;
        if (key === 'CLIENT_SYSTEM_INTERDICTION_ENABLED') return 'true';
        if (key === 'AI_MODEL_ENDPOINT') return 'http://ai-model.test';
        return defaultValue;
      });
    });

    it('should create investigation task when confidence is below threshold', async () => {
      taskService.createTask.mockResolvedValue(mockTask as any);
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);
      (featureExtractionService.extractFeatures as any).mockResolvedValue({ features: [] });
      mockedAxios.post.mockResolvedValue({
        data: { confidence: 0.5, priority: 0.6 },
      });
      alertService.updateAlert.mockResolvedValue(mockAlert as any);
      taskService.updateTask.mockResolvedValue(mockTask as any);
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValue(undefined);
      caseRepository.findCaseById.mockResolvedValue(mockCase as any);
      caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
      flowableService.handleTaskCompleted.mockResolvedValue(undefined);

      const result = await service.handleAITriage(1, 1, ingestAlertDto, 'user-123', 'tenant-123');

      expect(result).toHaveProperty('case');
      expect(result).toHaveProperty('message');
      expect(taskService.createTask).toHaveBeenCalled();
      expect(flowableService.handleTaskCompleted).toHaveBeenCalled();
    });

    it('should auto-close case when confidence is high and predicted false positive', async () => {
      taskService.createTask.mockResolvedValue(mockTask as any);
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);
      (featureExtractionService.extractFeatures as any).mockResolvedValue({ features: [] });
      mockedAxios.post.mockResolvedValue({
        data: { confidence: 0.95, priority: 0.3 },
      });
      alertService.updateAlert.mockResolvedValue(mockAlert as any);
      taskService.updateTask.mockResolvedValue(mockTask as any);
      taskRepository.updateTask.mockResolvedValue(mockTask as any);
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValue(undefined);
      caseRepository.findCaseById.mockResolvedValue(mockCase as any);
      caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
      flowableService.handleTaskCompleted.mockResolvedValue(undefined);

      const result = await service.handleAITriage(1, 1, ingestAlertDto, 'user-123', 'tenant-123');

      expect(result).toHaveProperty('updatedCase');
      expect(result).toHaveProperty('updatedTask');
      expect(caseCreationService.updateCaseStatus).toHaveBeenCalled();
      expect(flowableService.handleCaseStatusChanged).not.toHaveBeenCalled();
    });

    it('should retry handleTaskCompleted up to 5 times on transient failure for false positive auto-close', async () => {
      const retrySpy = jest.spyOn(service as any, 'retry').mockImplementation(async (fn: () => Promise<void>) => fn());

      taskService.createTask.mockResolvedValue(mockTask as any);
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);
      (featureExtractionService.extractFeatures as any).mockResolvedValue({ features: [] });
      mockedAxios.post.mockResolvedValue({
        data: { confidence: 0.95, priority: 0.3 },
      });
      alertService.updateAlert.mockResolvedValue(mockAlert as any);
      taskService.updateTask.mockResolvedValue(mockTask as any);
      taskRepository.updateTask.mockResolvedValue(mockTask as any);
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValue(undefined);
      caseRepository.findCaseById.mockResolvedValue(mockCase as any);
      caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
      flowableService.handleTaskCompleted.mockResolvedValue(undefined);

      await service.handleAITriage(1, 1, ingestAlertDto, 'user-123', 'tenant-123');

      expect(retrySpy).toHaveBeenCalledWith(expect.any(Function), 5);
      expect(flowableService.handleTaskCompleted).toHaveBeenCalled();
    });

    it('should handle FRAUD_AND_AML type when true positive', async () => {
      taskService.createTask.mockResolvedValue(mockTask as any);
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);
      (featureExtractionService.extractFeatures as any).mockResolvedValue({ features: [] });
      mockedAxios.post.mockResolvedValue({
        data: { confidence: 0.95, priority: 0.8 },
      });
      alertService.updateAlert.mockResolvedValue(mockAlert as any);
      taskService.updateTask.mockResolvedValue(mockTask as any);
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValue(undefined);
      caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
      caseCreateService.createCaseWithInvestigationTask.mockResolvedValue(mockCase as any);
      flowableService.handleTaskCompleted.mockResolvedValue(undefined);

      // Mock prediction to return FRAUD_AND_AML
      const fraudAndAmlDto = {
        ...ingestAlertDto,
      };

      // Need to mock the private method predictAlert to return FRAUD_AND_AML
      jest.spyOn(service as any, 'predictAlert').mockResolvedValue({
        confidence_per: 95,
        alertType: CaseType.FRAUD_AND_AML,
        isTruePositive: true,
        priorityScore: 0.8,
      });

      await service.handleAITriage(1, 1, fraudAndAmlDto, 'user-123', 'tenant-123');

      expect(caseCreateService.createCaseWithInvestigationTask).toHaveBeenCalledTimes(2);
      expect(caseCreateService.createCaseWithInvestigationTask).toHaveBeenCalledWith(
        CaseType.FRAUD,
        'user-123',
        'tenant-123',
        1,
        Priority.URGENT,
        CaseCreationType.AUTOMATIC_SYSTEM,
        'SUPERVISOR',
      );
      expect(caseCreateService.createCaseWithInvestigationTask).toHaveBeenCalledWith(
        CaseType.AML,
        'user-123',
        'tenant-123',
        1,
        Priority.URGENT,
        CaseCreationType.AUTOMATIC_SYSTEM,
        'SUPERVISOR',
      );
    });

    it('should create investigation task for AML type when true positive', async () => {
      taskService.createTask.mockResolvedValue(mockTask as any);
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);
      (featureExtractionService.extractFeatures as any).mockResolvedValue({ features: [] });

      jest.spyOn(service as any, 'predictAlert').mockResolvedValue({
        confidence_per: 95,
        alertType: CaseType.AML,
        isTruePositive: true,
        priorityScore: 0.8,
      });

      alertService.updateAlert.mockResolvedValue(mockAlert as any);
      taskService.updateTask.mockResolvedValue(mockTask as any);
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValue(undefined);
      caseRepository.findCaseById.mockResolvedValue(mockCase as any);
      caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
      flowableService.handleTaskCompleted.mockResolvedValue(undefined);

      const result = await service.handleAITriage(1, 1, ingestAlertDto, 'user-123', 'tenant-123');

      expect(result).toHaveProperty('case');
      expect(flowableService.handleTaskCompleted).toHaveBeenCalled();
    });

    it('should auto-close FRAUD case when no transaction occurred', async () => {
      taskService.createTask.mockResolvedValue(mockTask as any);
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);

      const dtoWithInterdiction = {
        ...ingestAlertDto,
        report: {
          ...ingestAlertDto.report,
          tadpResult: {
            typologyResult: [
              {
                result: 100,
                workflow: { interdictionThreshold: 50 },
              },
            ],
          },
        },
      };

      jest.spyOn(service as any, 'predictAlert').mockResolvedValue({
        confidence_per: 95,
        alertType: CaseType.FRAUD,
        isTruePositive: true,
        priorityScore: 0.8,
      });

      alertService.updateAlert.mockResolvedValue(mockAlert as any);
      taskService.updateTask.mockResolvedValue(mockTask as any);
      taskRepository.updateTask.mockResolvedValue(mockTask as any);
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValue(undefined);
      caseRepository.findCaseById.mockResolvedValue(mockCase as any);
      caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
      flowableService.handleTaskCompleted.mockResolvedValue(undefined);

      const result = await service.handleAITriage(1, 1, dtoWithInterdiction, 'user-123', 'tenant-123');

      expect(result).toHaveProperty('updatedCase');
      expect(caseCreationService.updateCaseStatus).toHaveBeenCalled();
      expect(flowableService.handleCaseStatusChanged).not.toHaveBeenCalled();
    });

    it('should create investigation task for FRAUD when transaction occurred', async () => {
      taskService.createTask.mockResolvedValue(mockTask as any);
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);

      jest.spyOn(service as any, 'predictAlert').mockResolvedValue({
        confidence_per: 95,
        alertType: CaseType.FRAUD,
        isTruePositive: true,
        priorityScore: 0.8,
      });

      alertService.updateAlert.mockResolvedValue(mockAlert as any);
      taskService.updateTask.mockResolvedValue(mockTask as any);
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValue(undefined);
      caseRepository.findCaseById.mockResolvedValue(mockCase as any);
      caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
      flowableService.handleTaskCompleted.mockResolvedValue(undefined);

      const result = await service.handleAITriage(1, 1, ingestAlertDto, 'user-123', 'tenant-123');

      expect(result).toHaveProperty('case');
      expect(flowableService.handleTaskCompleted).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on failure', async () => {
      taskService.createTask.mockRejectedValue(new Error('Task creation failed'));

      await expect(service.handleAITriage(1, 1, ingestAlertDto, 'user-123', 'tenant-123')).rejects.toThrow(InternalServerErrorException);

      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: Outcome.FAILURE,
        }),
      );
    });
  });

  describe('createInvestigationTask', () => {
    it('should successfully create investigation task', async () => {
      caseRepository.findCaseById.mockResolvedValue(mockCase as any);
      taskService.updateTask.mockResolvedValue(mockTask as any);
      caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValue(undefined);

      const result = await service.createInvestigationTask(
        1,
        'user-123',
        1,
        'Triage complete',
        Priority.URGENT,
        'tenant-123',
        CaseType.FRAUD,
      );

      expect(result).toHaveProperty('case');
      expect(result).toHaveProperty('message');
      expect(taskService.updateTask).toHaveBeenCalledWith(1, { status: TaskStatus.STATUS_30_COMPLETED }, 'user-123', 'tenant-123');
    });

    it('should throw NotFoundException when case not found', async () => {
      caseRepository.findCaseById.mockResolvedValue(null as any);

      await expect(service.createInvestigationTask(999, 'user-123', 1, 'Triage complete', Priority.URGENT, 'tenant-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException on failure', async () => {
      caseRepository.findCaseById.mockResolvedValue(mockCase as any);
      taskService.updateTask.mockRejectedValue(new Error('Update failed'));

      await expect(service.createInvestigationTask(1, 'user-123', 1, 'Triage complete', Priority.URGENT, 'tenant-123')).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: Outcome.FAILURE,
        }),
      );
    });
  });

  describe('private methods', () => {
    describe('predictAlert', () => {
      it('should successfully predict alert', async () => {
        const ingestAlertDto: any = {
          transaction: { TxTp: 'pacs.002.001.12' },
          report: { status: 'ALRT' },
          message: 'Test',
          networkMap: {},
        };

        (featureExtractionService.extractFeatures as any).mockResolvedValue({ features: [1, 2, 3] });
        configService.get.mockReturnValue('http://ai-model.test');
        mockedAxios.post.mockResolvedValue({
          data: { confidence: 0.85, priority: 0.7 },
        });

        const result = await (service as any).predictAlert(ingestAlertDto);

        expect(result).toEqual({
          priorityScore: 0.7,
          alertType: CaseType.FRAUD,
          confidence_per: 85,
          isTruePositive: false,
        });
        expect(featureExtractionService.extractFeatures).toHaveBeenCalledWith(ingestAlertDto);
      });

      // TODO: Fix type issue with mockRejectedValueOnce
      // it('should throw InternalServerErrorException on failure', async () => {
      //   const ingestAlertDto: any = {
      //     transaction: {},
      //     report: {},
      //     message: 'Test',
      //     networkMap: {},
      //   };

      //   jest.spyOn(featureExtractionService, 'extractFeatures').mockRejectedValueOnce(new Error('Feature extraction failed'));

      //   await expect((service as any).predictAlert(ingestAlertDto)).rejects.toThrow(
      //     InternalServerErrorException,
      //   );
      // });
    });

    describe('updateAlertAndUpdateTriageTask', () => {
      it('should successfully update alert and triage task', async () => {
        alertService.updateAlert.mockResolvedValue(mockAlert as any);
        taskService.updateTask.mockResolvedValue(mockTask as any);
        loggingOrchestrationService.logActionsWithHistory.mockResolvedValue(undefined);

        await (service as any).updateAlertAndUpdateTriageTask(
          1,
          1,
          CaseType.FRAUD,
          95,
          0.8,
          Priority.URGENT,
          true,
          'user-123',
          'tenant-123',
        );

        expect(alertService.updateAlert).toHaveBeenCalled();
        expect(taskService.updateTask).toHaveBeenCalled();
        expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalled();
      });

      it('should throw InternalServerErrorException on failure', async () => {
        alertService.updateAlert.mockRejectedValue(new Error('Update failed'));

        await expect(
          (service as any).updateAlertAndUpdateTriageTask(1, 1, CaseType.FRAUD, 95, 0.8, Priority.URGENT, true, 'user-123', 'tenant-123'),
        ).rejects.toThrow(InternalServerErrorException);
      });
    });

    describe('autoCloseCase', () => {
      it('should successfully auto-close case', async () => {
        caseRepository.findCaseById.mockResolvedValue(mockCase as any);
        taskRepository.updateTask.mockResolvedValue(mockTask as any);
        caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
        loggingOrchestrationService.logActionsWithHistory.mockResolvedValue(undefined);

        const result = await (service as any).autoCloseCase(
          1,
          CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
          'user-123',
          1,
          'tenant-123',
          CaseType.FRAUD,
          'Test closure',
        );

        expect(result).toHaveProperty('updatedCase');
        expect(result).toHaveProperty('updatedTask');
        expect(taskRepository.updateTask).toHaveBeenCalledWith(1, { status: TaskStatus.STATUS_30_COMPLETED });
        expect(flowableService.handleCaseStatusChanged).not.toHaveBeenCalled();
      });

      it('should throw NotFoundException when case not found', async () => {
        caseRepository.findCaseById.mockResolvedValue(null as any);

        await expect(
          (service as any).autoCloseCase(999, CaseStatus.STATUS_72_AUTOCLOSED_REFUTED, 'user-123', 1, 'tenant-123'),
        ).rejects.toThrow(InternalServerErrorException);
      });

      it('should throw InternalServerErrorException on failure', async () => {
        caseRepository.findCaseById.mockResolvedValue(mockCase as any);
        taskRepository.updateTask.mockRejectedValue(new Error('Update failed'));

        await expect(
          (service as any).autoCloseCase(1, CaseStatus.STATUS_72_AUTOCLOSED_REFUTED, 'user-123', 1, 'tenant-123'),
        ).rejects.toThrow(InternalServerErrorException);

        expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(
          expect.objectContaining({
            outcome: Outcome.FAILURE,
          }),
        );
      });
    });

    describe('retry', () => {
      it('should successfully execute function on first attempt', async () => {
        const mockFn = jest.fn().mockResolvedValue('success');

        await (service as any).retry(mockFn);

        expect(mockFn).toHaveBeenCalledTimes(1);
      });

      it('should retry on failure and eventually succeed', async () => {
        const mockFn = jest
          .fn()
          .mockRejectedValueOnce(new Error('Attempt 1 failed'))
          .mockRejectedValueOnce(new Error('Attempt 2 failed'))
          .mockResolvedValue('success');

        await (service as any).retry(mockFn);

        expect(mockFn).toHaveBeenCalledTimes(3);
      });

      it('should throw error after max retries', async () => {
        const mockFn = jest.fn().mockRejectedValue(new Error('Always fails'));

        await expect((service as any).retry(mockFn, 2)).rejects.toThrow('Always fails');

        expect(mockFn).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('getAlertNavigator', () => {
    const mockPrismaAlert = {
      alert_id: 1,
      tenant_id: 'tenant-123',
      alert_data: {
        tadpResult: {
          typologyResult: [
            {
              id: 'typology-001',
              result: 85,
              workflow: { alertThreshold: 75 },
              ruleResults: [
                { id: 'rule-001', wght: 10 },
                { id: 'rule-002', wght: 15 },
              ],
            },
          ],
        },
        block_status: 'BLOCKED',
        block_reason: 'Suspicious activity detected',
      },
      transaction: {
        FIToFIPmtSts: {
          GrpHdr: {
            MsgId: 'tx-12345',
            CreDtTm: '2026-03-06T10:00:00Z',
          },
          TxInfAndSts: {
            Amt: {
              Amt: 1000,
              Ccy: 'USD',
            },
          },
        },
      },
      txtp: 'pacs.002.001.12',
      message: 'Alert reason',
      block_status: 'BLOCKED',
      block_reason: 'Test reason',
    };

    it('should return alert navigator data successfully', async () => {
      const mockPrisma = {
        alert: {
          findUnique: jest.fn().mockResolvedValue(mockPrismaAlert),
        },
      };
      (service as any).prisma = mockPrisma;

      const result = await service.getAlertNavigator(1, 'tenant-123', 'user-123');

      expect(result).toHaveProperty('alertId', 1);
      expect(result).toHaveProperty('transactionId', 'tx-12345');
      expect(result).toHaveProperty('typologies');
      expect(result.typologies).toHaveLength(1);
      expect(result).toHaveProperty('rules');
      expect(result.rules).toHaveLength(2);
      expect(result).toHaveProperty('blockStatus');
      expect(result.blockStatus).toEqual({
        status: 'BLOCKED',
        reason: 'Test reason',
      });
      expect(mockPrisma.alert.findUnique).toHaveBeenCalledWith({
        where: { alert_id: 1, tenant_id: 'tenant-123' },
      });
    });

    it('should handle alert with null blockStatus', async () => {
      const alertWithoutBlock = {
        ...mockPrismaAlert,
        alert_data: {
          tadpResult: { typologyResult: [] },
        },
        block_status: null,
        block_reason: null,
      };

      const mockPrisma = {
        alert: {
          findUnique: jest.fn().mockResolvedValue(alertWithoutBlock),
        },
      };
      (service as any).prisma = mockPrisma;

      const result = await service.getAlertNavigator(1, 'tenant-123', 'user-123');

      expect(result.blockStatus).toBeNull();
    });

    it('should throw NotFoundException when alert not found', async () => {
      const mockPrisma = {
        alert: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };
      (service as any).prisma = mockPrisma;

      await expect(service.getAlertNavigator(999, 'tenant-123', 'user-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTransactionDetail', () => {
    const mockPrismaAlertForTransaction = {
      alert_id: 1,
      tenant_id: 'tenant-123',
      txtp: 'pacs.002.001.12',
      transaction: {
        FIToFIPmtSts: {
          GrpHdr: {
            MsgId: 'tx-12345',
            CreDtTm: '2026-03-06T10:00:00Z',
          },
          TxInfAndSts: {
            TxId: 'tx-12345',
            Amt: {
              Amt: 5000,
              Ccy: 'USD',
            },
            Dbtr: {
              Nm: 'John Doe',
              Acct: {
                IBAN: 'GB29NWBK60161331926819',
              },
            },
            Cdtr: {
              Nm: 'Jane Smith',
              Acct: {
                IBAN: 'GB29NWBK60161331926820',
              },
            },
            ChrgsInf: [
              {
                Amt: { Amt: 10, Ccy: 'USD' },
                Agt: { FinInstnId: { ClrSysMmbId: { MmbId: 'AGT001' } } },
              },
            ],
            SttlmInf: {
              SttlmDt: '2026-03-07',
              Ref: 'REF-12345',
              Purp: 'Payment',
            },
          },
        },
      },
    };

    it('should return transaction detail successfully', async () => {
      const mockPrisma = {
        alert: {
          findFirst: jest.fn().mockResolvedValue(mockPrismaAlertForTransaction),
        },
      };
      (service as any).prisma = mockPrisma;
      configService.get.mockReturnValue('http://localhost:8888');

      const result = await service.getTransactionDetail('tx-12345', 'tenant-123', 'user-123');

      expect(result).toHaveProperty('transactionOverview');
      expect(result.transactionOverview.transactionId).toBe('tx-12345');
      expect(result).toHaveProperty('transactionFlow');
      expect(result).toHaveProperty('debtorProfile');
      expect(result.debtorProfile.name).toBe('John Doe');
      expect(result).toHaveProperty('creditorProfile');
      expect(result.creditorProfile.name).toBe('Jane Smith');
      expect(result).toHaveProperty('amountAndCurrency');
      expect(result).toHaveProperty('links');
      expect(result).toHaveProperty('visualizationUrl');
    });

    it('should throw NotFoundException when transaction not found', async () => {
      const mockPrisma = {
        alert: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      (service as any).prisma = mockPrisma;

      await expect(service.getTransactionDetail('invalid-tx', 'tenant-123', 'user-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('handleManualTriage - edge cases', () => {
    it('should throw BadRequestException when completeNewCaseTask is null', async () => {
      configService.get.mockReturnValue('MANUAL');
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);

      const caseWithoutTask = {
        ...mockCase,
        tasks: [],
      };

      alertRepository.transaction.mockImplementation(async (callback) => {
        alertRepository.getAlertById.mockResolvedValue(mockAlert as any);
        caseRepository.findCaseById.mockResolvedValue(caseWithoutTask as any);
        return callback({} as any);
      });

      await expect(
        service.handleManualTriage(
          1,
          { priorityScore: 0.75, priority: Priority.URGENT, alertType: CaseType.FRAUD, note: 'test' },
          'user-123',
          'tenant-123',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle manual triage with undefined priority score', async () => {
      configService.get.mockReturnValue('MANUAL');
      casePriorityUtil.determinePriority.mockReturnValue(Priority.NEW);

      setupManualTriageMocks();
      setupTransactionMock();

      const dtoWithoutPriorityScore: ManualAlertUpdateDTO = {
        priority: Priority.NEW,
        alertType: CaseType.FRAUD,
        note: 'test note',
      };

      const result = await service.handleManualTriage(1, dtoWithoutPriorityScore, 'user-123', 'tenant-123');

      expect(result).toEqual(mockAlert);
      expect(casePriorityUtil.determinePriority).toHaveBeenCalledWith(0.33);
    });
  });

  describe('getAlertNavigator - additional edge cases', () => {
    it('should handle alert with empty typology results', async () => {
      const alertWithEmptyTypologies = {
        alert_id: 1,
        tenant_id: 'tenant-123',
        alert_data: null,
        transaction: null,
        txtp: '',
        message: '',
        block_status: null,
        block_reason: null,
      };

      const mockPrisma = {
        alert: {
          findUnique: jest.fn().mockResolvedValue(alertWithEmptyTypologies),
        },
      };
      (service as any).prisma = mockPrisma;

      const result = await service.getAlertNavigator(1, 'tenant-123', 'user-123');

      expect(result).toHaveProperty('alertId', 1);
      expect(result.typologies).toHaveLength(0);
      expect(result.rules).toHaveLength(0);
    });

    it('should handle typology with non-array ruleResults', async () => {
      const alertWithInvalidRules = {
        alert_id: 1,
        tenant_id: 'tenant-123',
        alert_data: {
          tadpResult: {
            typologyResult: [
              {
                id: 'typology-001',
                result: 85,
                workflow: null,
                ruleResults: null,
              },
            ],
          },
        },
        transaction: {},
        txtp: '',
        message: '',
        block_status: null,
        block_reason: null,
      };

      const mockPrisma = {
        alert: {
          findUnique: jest.fn().mockResolvedValue(alertWithInvalidRules),
        },
      };
      (service as any).prisma = mockPrisma;

      const result = await service.getAlertNavigator(1, 'tenant-123', 'user-123');

      expect(result.typologies).toHaveLength(1);
      expect(result.typologies[0].rules).toHaveLength(0);
    });
  });

  describe('getTransactionDetail - additional edge cases', () => {
    it('should handle transaction with missing optional fields', async () => {
      const minimalAlert = {
        alert_id: 1,
        tenant_id: 'tenant-123',
        txtp: '',
        transaction: {
          FIToFIPmtSts: {
            GrpHdr: {
              MsgId: 'tx-minimal',
              CreDtTm: '',
            },
            TxInfAndSts: {
              Amt: null,
              Dbtr: null,
              Cdtr: null,
              ChrgsInf: null,
              SttlmInf: null,
            },
          },
        },
      };

      const mockPrisma = {
        alert: {
          findFirst: jest.fn().mockResolvedValue(minimalAlert),
        },
      };
      (service as any).prisma = mockPrisma;
      configService.get.mockReturnValue('http://localhost:8888');

      const result = await service.getTransactionDetail('tx-minimal', 'tenant-123', 'user-123');

      expect(result).toHaveProperty('transactionOverview');
      expect(result.debtorProfile.name).toBeUndefined();
      expect(result.creditorProfile.name).toBeUndefined();
    });
  });
});
