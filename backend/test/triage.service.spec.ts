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
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  Priority,
  CaseStatus,
  CaseType,
  TaskStatus,
  CaseCreationType,
} from '@prisma/client-cms';
import { ManualAlertUpdateDTO, IngestAlertDto } from '../src/modules/alert/dto';
import { Outcome } from '../src/utils/types/outcome';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

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
      extractFeatures: jest.fn(),
    };

    const mockCaseCreateService = {
      createCaseWithInvestigationTask: jest.fn(),
    };

    const mockLoggingOrchestrationService = {
      logActions: jest.fn(),
      logActionsWithHistory: jest.fn(),
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

  describe('handleManualTriage', () => {
    const updateAlertDto: ManualAlertUpdateDTO = {
      priorityScore: 0.75,
      priority: Priority.URGENT,
      alertType: CaseType.FRAUD,
      note: 'Manual review completed',
    };

    it('should throw BadRequestException when TRIAGE_TYPE is not MANUAL', async () => {
      configService.get.mockReturnValue('DISABLED');

      await expect(
        service.handleManualTriage(1, updateAlertDto, 'user-123', 'tenant-123'),
      ).rejects.toThrow(BadRequestException);
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
        alertService.updateAlert.mockResolvedValue(mockAlert as any);
        caseRepository.findCaseById.mockResolvedValue(caseWithCompletedTask as any);
        return callback({} as any);
      });

      await expect(
        service.handleManualTriage(1, updateAlertDto, 'user-123', 'tenant-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException when alert case_id is missing', async () => {
      configService.get.mockReturnValue('MANUAL');
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);

      const alertWithoutCaseId = { ...mockAlert, case_id: null };

      alertRepository.transaction.mockImplementation(async (callback) => {
        alertService.updateAlert.mockResolvedValue(alertWithoutCaseId);
        return callback({} as any);
      });

      await expect(
        service.handleManualTriage(1, updateAlertDto, 'user-123', 'tenant-123'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw BadRequestException when case is already closed', async () => {
      configService.get.mockReturnValue('MANUAL');
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);

      const closedCase = {
        ...mockCase,
        status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
      };

      alertRepository.transaction.mockImplementation(async (callback) => {
        alertService.updateAlert.mockResolvedValue(mockAlert as any);
        caseRepository.findCaseById.mockResolvedValue(closedCase);
        return callback({} as any);
      });

      await expect(
        service.handleManualTriage(1, updateAlertDto, 'user-123', 'tenant-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully handle manual triage with closable status', async () => {
      configService.get.mockReturnValue('MANUAL');
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);

      const closableUpdateDto = {
        ...updateAlertDto,
        status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
      };

      alertRepository.transaction.mockImplementation(async (callback) => {
        alertService.updateAlert.mockResolvedValue(mockAlert as any);
        caseRepository.findCaseById.mockResolvedValue(mockCase as any);
        taskService.updateTask.mockResolvedValue(mockTask as any);
        commentRepository.createComment.mockResolvedValue({ comment_id: 1, tenant_id: "tenant-123", created_at: new Date(), case_id: 1, updated_at: new Date(), user_id: "user-123", note: "test", task_id: null });
        caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
        flowableService.handleTaskCompleted.mockResolvedValue(undefined);
        return callback({} as any);
      });

      const result = await service.handleManualTriage(
        1,
        closableUpdateDto,
        'user-123',
        'tenant-123',
      );

      expect(result).toEqual(mockAlert);
      expect(flowableService.handleTaskCompleted).toHaveBeenCalledTimes(2);
      expect(caseCreationService.updateCaseStatus).toHaveBeenCalled();
    });

    it('should successfully handle manual triage without closable status', async () => {
      configService.get.mockReturnValue('MANUAL');
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);

      alertRepository.transaction.mockImplementation(async (callback) => {
        alertService.updateAlert.mockResolvedValue(mockAlert as any);
        caseRepository.findCaseById.mockResolvedValue(mockCase as any);
        taskService.updateTask.mockResolvedValue(mockTask as any);
        commentRepository.createComment.mockResolvedValue({ comment_id: 1, tenant_id: "tenant-123", created_at: new Date(), case_id: 1, updated_at: new Date(), user_id: "user-123", note: "test", task_id: null });
        caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
        flowableService.handleTaskCompleted.mockResolvedValue(undefined);
        return callback({} as any);
      });

      const result = await service.handleManualTriage(
        1,
        updateAlertDto,
        'user-123',
        'tenant-123',
      );

      expect(result).toEqual(mockAlert);
      expect(flowableService.handleTaskCompleted).toHaveBeenCalledTimes(1);
    });

    it('should handle FRAUD_AND_AML type by creating child cases', async () => {
      configService.get.mockReturnValue('MANUAL');
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);

      const fraudAndAmlAlert = {
        ...mockAlert,
        alert_type: CaseType.FRAUD_AND_AML,
      };

      const fraudAndAmlDto = {
        ...updateAlertDto,
        alertType: CaseType.FRAUD_AND_AML,
      };

      alertRepository.transaction.mockImplementation(async (callback) => {
        alertService.updateAlert.mockResolvedValue(fraudAndAmlAlert);
        caseRepository.findCaseById.mockResolvedValue(mockCase as any);
        taskService.updateTask.mockResolvedValue(mockTask as any);
        commentRepository.createComment.mockResolvedValue({ comment_id: 1, tenant_id: "tenant-123", created_at: new Date(), case_id: 1, updated_at: new Date(), user_id: "user-123", note: "test", task_id: null });
        caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
        caseCreateService.createCaseWithInvestigationTask.mockResolvedValue(mockCase as any);
        flowableService.handleTaskCompleted.mockResolvedValue(undefined);
        return callback({} as any);
      });

      const result = await service.handleManualTriage(
        1,
        fraudAndAmlDto,
        'user-123',
        'tenant-123',
      );

      expect(result).toEqual(fraudAndAmlAlert);
      expect(caseCreateService.createCaseWithInvestigationTask).toHaveBeenCalledTimes(2);
    });

    it('should log error and rethrow on failure', async () => {
      configService.get.mockReturnValue('MANUAL');
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);

      const error = new Error('Transaction failed');
      alertRepository.transaction.mockRejectedValue(error);

      await expect(
        service.handleManualTriage(1, updateAlertDto, 'user-123', 'tenant-123'),
      ).rejects.toThrow(error);

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
      featureExtractionService.extractFeatures.mockResolvedValue({ features: [] });
      mockedAxios.post.mockResolvedValue({
        data: { confidence: 0.5, priority: 0.6 },
      });
      alertService.updateAlert.mockResolvedValue(mockAlert as any);
      taskService.updateTask.mockResolvedValue(mockTask as any);
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValue(undefined);
      caseRepository.findCaseById.mockResolvedValue(mockCase as any);
      caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
      flowableService.handleTaskCompleted.mockResolvedValue(undefined);

      const result = await service.handleAITriage(
        1,
        1,
        ingestAlertDto,
        'user-123',
        'tenant-123',
      );

      expect(result).toHaveProperty('case');
      expect(result).toHaveProperty('message');
      expect(taskService.createTask).toHaveBeenCalled();
      expect(flowableService.handleTaskCompleted).toHaveBeenCalled();
    });

    it('should auto-close case when confidence is high and predicted false positive', async () => {
      taskService.createTask.mockResolvedValue(mockTask as any);
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);
      featureExtractionService.extractFeatures.mockResolvedValue({ features: [] });
      mockedAxios.post.mockResolvedValue({
        data: { confidence: 0.95, priority: 0.3 },
      });
      alertService.updateAlert.mockResolvedValue(mockAlert as any);
      taskService.updateTask.mockResolvedValue(mockTask as any);
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValue(undefined);
      caseRepository.findCaseById.mockResolvedValue(mockCase as any);
      caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
      flowableService.handleTaskCompleted.mockResolvedValue(undefined);
      eventEmitter.emit.mockReturnValue(true);

      const result = await service.handleAITriage(
        1,
        1,
        ingestAlertDto,
        'user-123',
        'tenant-123',
      );

      expect(result).toHaveProperty('updatedCase');
      expect(result).toHaveProperty('updatedTask');
      expect(caseCreationService.updateCaseStatus).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'case.status.changed',
        expect.any(Object),
      );
    });

    it('should handle FRAUD_AND_AML type when true positive', async () => {
      taskService.createTask.mockResolvedValue(mockTask as any);
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);
      featureExtractionService.extractFeatures.mockResolvedValue({ features: [] });
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
      );
      expect(caseCreateService.createCaseWithInvestigationTask).toHaveBeenCalledWith(
        CaseType.AML,
        'user-123',
        'tenant-123',
        1,
        Priority.URGENT,
      );
    });

    it('should create investigation task for AML type when true positive', async () => {
      taskService.createTask.mockResolvedValue(mockTask as any);
      casePriorityUtil.determinePriority.mockReturnValue(Priority.URGENT);
      featureExtractionService.extractFeatures.mockResolvedValue({ features: [] });
      
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

      const result = await service.handleAITriage(
        1,
        1,
        ingestAlertDto,
        'user-123',
        'tenant-123',
      );

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
      loggingOrchestrationService.logActionsWithHistory.mockResolvedValue(undefined);
      caseRepository.findCaseById.mockResolvedValue(mockCase as any);
      caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
      flowableService.handleTaskCompleted.mockResolvedValue(undefined);
      eventEmitter.emit.mockReturnValue(true);

      const result = await service.handleAITriage(
        1,
        1,
        dtoWithInterdiction,
        'user-123',
        'tenant-123',
      );

      expect(result).toHaveProperty('updatedCase');
      expect(caseCreationService.updateCaseStatus).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalled();
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

      const result = await service.handleAITriage(
        1,
        1,
        ingestAlertDto,
        'user-123',
        'tenant-123',
      );

      expect(result).toHaveProperty('case');
      expect(flowableService.handleTaskCompleted).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on failure', async () => {
      taskService.createTask.mockRejectedValue(new Error('Task creation failed'));

      await expect(
        service.handleAITriage(1, 1, ingestAlertDto, 'user-123', 'tenant-123'),
      ).rejects.toThrow(InternalServerErrorException);

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
      expect(taskService.updateTask).toHaveBeenCalledWith(
        1,
        { status: TaskStatus.STATUS_30_COMPLETED },
        'user-123',
        'tenant-123',
      );
    });

    it('should throw NotFoundException when case not found', async () => {
      caseRepository.findCaseById.mockResolvedValue(null as any);

      await expect(
        service.createInvestigationTask(
          999,
          'user-123',
          1,
          'Triage complete',
          Priority.URGENT,
          'tenant-123',
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on failure', async () => {
      caseRepository.findCaseById.mockResolvedValue(mockCase as any);
      taskService.updateTask.mockRejectedValue(new Error('Update failed'));

      await expect(
        service.createInvestigationTask(
          1,
          'user-123',
          1,
          'Triage complete',
          Priority.URGENT,
          'tenant-123',
        ),
      ).rejects.toThrow(InternalServerErrorException);

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

        featureExtractionService.extractFeatures.mockResolvedValue({ features: [1, 2, 3] } as any);
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
        expect(featureExtractionService.extractFeatures).toHaveBeenCalledWith(
          ingestAlertDto,
        );
      });

      it('should throw InternalServerErrorException on failure', async () => {
        const ingestAlertDto: any = {
          transaction: {},
          report: {},
          message: 'Test',
          networkMap: {},
        };

        featureExtractionService.extractFeatures.mockRejectedValue(
          new Error('Feature extraction failed'),
        );

        await expect((service as any).predictAlert(ingestAlertDto)).rejects.toThrow(
          InternalServerErrorException,
        );
      });
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
          (service as any).updateAlertAndUpdateTriageTask(
            1,
            1,
            CaseType.FRAUD,
            95,
            0.8,
            Priority.URGENT,
            true,
            'user-123',
            'tenant-123',
          ),
        ).rejects.toThrow(InternalServerErrorException);
      });
    });

    describe('autoCloseCase', () => {
      it('should successfully auto-close case', async () => {
        caseRepository.findCaseById.mockResolvedValue(mockCase as any);
        taskService.updateTask.mockResolvedValue(mockTask as any);
        caseCreationService.updateCaseStatus.mockResolvedValue(mockCase as any);
        eventEmitter.emit.mockReturnValue(true);
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
        expect(eventEmitter.emit).toHaveBeenCalledWith(
          'case.status.changed',
          expect.any(Object),
        );
      });

      it('should throw NotFoundException when case not found', async () => {
        caseRepository.findCaseById.mockResolvedValue(null as any);

        await expect(
          (service as any).autoCloseCase(
            999,
            CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
            'user-123',
            1,
            'tenant-123',
          ),
        ).rejects.toThrow(InternalServerErrorException);
      });

      it('should throw InternalServerErrorException on failure', async () => {
        caseRepository.findCaseById.mockResolvedValue(mockCase as any);
        taskService.updateTask.mockRejectedValue(new Error('Update failed'));

        await expect(
          (service as any).autoCloseCase(
            1,
            CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
            'user-123',
            1,
            'tenant-123',
          ),
        ).rejects.toThrow(InternalServerErrorException);

        expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(
          expect.objectContaining({
            outcome: Outcome.FAILURE,
          }),
        );
      });
    });
  });
});









