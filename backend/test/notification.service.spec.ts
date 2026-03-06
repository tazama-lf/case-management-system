import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../src/modules/notification/notification.service';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../src/modules/shared/cache.service';
import { AsyncTaskService } from '../src/modules/async-task/async-task.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let configService: jest.Mocked<ConfigService>;
  let cacheService: jest.Mocked<CacheService>;
  let asyncTaskService: jest.Mocked<AsyncTaskService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    const mockCacheService = {
      getUserEmailFromCache: jest.fn(),
    };

    const mockAsyncTaskService = {
      createEmailTask: jest.fn().mockResolvedValue({ ok: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: AsyncTaskService,
          useValue: mockAsyncTaskService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    configService = module.get(ConfigService);
    cacheService = module.get(CacheService);
    asyncTaskService = module.get(AsyncTaskService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendNotification', () => {
    it('should send notification to user with cache', async () => {
      (cacheService.getUserEmailFromCache as jest.Mock).mockResolvedValue('user@example.com');

      await service.sendNotification({
        userId: 'user-123',
        type: 'TASK_ASSIGNED',
        message: 'Task has been assigned to you',
        metadata: { taskTitle: 'Test Task' },
      });

      expect(cacheService.getUserEmailFromCache).toHaveBeenCalledWith('user-123');
      expect(asyncTaskService.createEmailTask).toHaveBeenCalledWith(
        'user@example.com',
        expect.stringContaining('Task Assigned'),
        expect.any(String),
        expect.objectContaining({ userId: 'user-123' }),
      );
    });

    it.each([
      ['null', null],
      ['error', new Error('Cache error')],
    ])('should use fallback email when cache returns %s', async (scenario, cacheResponse) => {
      if (cacheResponse instanceof Error) {
        (cacheService.getUserEmailFromCache as jest.Mock).mockRejectedValue(cacheResponse);
      } else {
        (cacheService.getUserEmailFromCache as jest.Mock).mockResolvedValue(cacheResponse);
      }

      await service.sendNotification({
        userId: 'user-123',
        type: 'TASK_ASSIGNED',
        message: 'Task assigned',
        metadata: {},
      });

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledWith(
        'user-user-123@example.com',
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  describe('sendGroupNotification', () => {
    it('should send notification to multiple users', async () => {
      const groupEmails = ['user1@example.com', 'user2@example.com', 'user3@example.com'];

      await service.sendGroupNotification({
        candidateGroup: 'investigators',
        type: 'WORK_QUEUE',
        message: 'New task available',
        metadata: { groupEmails, taskTitle: 'New Task' },
      });

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledTimes(3);
      expect(asyncTaskService.createEmailTask).toHaveBeenCalledWith(
        'user1@example.com',
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should handle empty group emails', async () => {
      await service.sendGroupNotification({
        candidateGroup: 'investigators',
        type: 'WORK_QUEUE',
        message: 'Test',
        metadata: { groupEmails: [] },
      });

      expect(asyncTaskService.createEmailTask).not.toHaveBeenCalled();
    });

    it('should handle missing groupEmails in metadata', async () => {
      await service.sendGroupNotification({
        candidateGroup: 'investigators',
        type: 'WORK_QUEUE',
        message: 'Test',
        metadata: {},
      });

      expect(asyncTaskService.createEmailTask).not.toHaveBeenCalled();
    });
  });

  describe('handleTaskAssigned', () => {
    it('should send task assigned notification', async () => {
      (cacheService.getUserEmailFromCache as jest.Mock).mockResolvedValue('user@example.com');

      await service.handleTaskAssigned({
        taskId: 'task-123',
        taskName: 'Investigation Task',
        taskType: 'Investigation',
        assignedUserId: 'user-123',
        caseId: 'case-456',
        caseNumber: 'CASE-001',
        casePriority: 'HIGH',
        slaDeadline: '2026-02-21',
        workQueueName: 'Fraud',
        tenantId: 'tenant-123',
        assignedBy: 'admin',
      });

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledWith(
        'user@example.com',
        'New Task Assigned: Investigation Task',
        expect.any(String),
        expect.objectContaining({
          taskTitle: 'Investigation Task',
          priority: 'HIGH',
        }),
      );
    });

    it('should use default deadline when not provided', async () => {
      (cacheService.getUserEmailFromCache as jest.Mock).mockResolvedValue('user@example.com');

      await service.handleTaskAssigned({
        taskId: 'task-123',
        taskName: 'Task',
        taskType: 'Review',
        assignedUserId: 'user-123',
        caseId: 'case-456',
        caseNumber: 'CASE-001',
        casePriority: 'MEDIUM',
        workQueueName: 'General',
        tenantId: 'tenant-123',
      });

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          deadline: 'Not set',
        }),
      );
    });
  });

  describe('handleTaskUnassigned', () => {
    it('should send task unassigned notification', async () => {
      (cacheService.getUserEmailFromCache as jest.Mock).mockResolvedValue('user@example.com');

      await service.handleTaskUnassigned({
        taskId: 'task-123',
        taskName: 'Investigation Task',
        assignedUserId: 'user-123',
        taskType: 'Investigation',
        caseId: 'case-456',
        caseNumber: 'CASE-001',
        casePriority: 'HIGH',
        workQueueName: 'Fraud',
        tenantId: 'tenant-123',
      });

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledWith(
        'user@example.com',
        'Task Unassigned: Investigation Task',
        expect.any(String),
        expect.objectContaining({
          taskTitle: 'Investigation Task',
        }),
      );
    });
  });

  describe('handleTaskReassigned', () => {
    it('should send notifications to both old and new assignees', async () => {
      (cacheService.getUserEmailFromCache as jest.Mock)
        .mockResolvedValueOnce('newuser@example.com')
        .mockResolvedValueOnce('olduser@example.com');

      await service.handleTaskReassigned({
        taskId: 'task-123',
        taskName: 'Investigation Task',
        taskType: 'Investigation',
        newAssignedUserId: 'new-user',
        previousAssignedUserId: 'old-user',
        caseId: 'case-456',
        caseNumber: 'CASE-001',
        casePriority: 'HIGH',
        slaDeadline: '2026-02-21',
        workQueueName: 'Fraud',
        tenantId: 'tenant-123',
        reassignedBy: 'admin',
        reason: 'Workload balancing',
      });

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledTimes(2);
      expect(asyncTaskService.createEmailTask).toHaveBeenCalledWith(
        'newuser@example.com',
        'Task Reassigned: Investigation Task',
        expect.any(String),
        expect.objectContaining({ reason: 'Workload balancing' }),
      );
      expect(asyncTaskService.createEmailTask).toHaveBeenCalledWith(
        'olduser@example.com',
        'Task Unassigned: Investigation Task',
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should use default reason when not provided', async () => {
      (cacheService.getUserEmailFromCache as jest.Mock).mockResolvedValueOnce('new@example.com').mockResolvedValueOnce('old@example.com');

      await service.handleTaskReassigned({
        taskId: 'task-123',
        taskName: 'Task',
        taskType: 'Review',
        newAssignedUserId: 'new-user',
        previousAssignedUserId: 'old-user',
        caseId: 'case-456',
        caseNumber: 'CASE-001',
        casePriority: 'MEDIUM',
        workQueueName: 'General',
        tenantId: 'tenant-123',
      });

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledWith(
        'new@example.com',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          reason: 'No reason provided',
        }),
      );
    });
  });

  describe('handleSlaWarning', () => {
    it('should send SLA warning notification to supervisor', async () => {
      (configService.get as jest.Mock).mockReturnValue('supervisor@example.com');

      await service.handleSlaWarning({
        taskId: 'task-123',
        taskName: 'Critical Task',
        caseId: 'case-456',
        casePriority: 'HIGH',
        workQueueId: 'queue-1',
        workQueueName: 'Fraud',
        tenantId: 'tenant-123',
        deadline: '2026-02-21',
        timeUntilDeadline: 2,
      });

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledWith(
        'supervisor@example.com',
        expect.stringContaining('SLA Warning'),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should notify both supervisor and assigned user', async () => {
      (configService.get as jest.Mock).mockReturnValue('supervisor@example.com');
      (cacheService.getUserEmailFromCache as jest.Mock).mockResolvedValue('user@example.com');

      await service.handleSlaWarning({
        taskId: 'task-123',
        taskName: 'Task',
        caseId: 'case-456',
        casePriority: 'MEDIUM',
        workQueueId: 'queue-1',
        workQueueName: 'General',
        assignedUserId: 'user-123',
        tenantId: 'tenant-123',
        deadline: '2026-02-21',
        timeUntilDeadline: 2,
      });

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledTimes(2);
    });

    it('should handle missing supervisor email', async () => {
      (configService.get as jest.Mock).mockReturnValue(null);

      await service.handleSlaWarning({
        taskId: 'task-123',
        taskName: 'Task',
        caseId: 'case-456',
        casePriority: 'LOW',
        workQueueId: 'queue-1',
        workQueueName: 'General',
        tenantId: 'tenant-123',
        deadline: '2026-02-21',
        timeUntilDeadline: 2,
      });

      expect(asyncTaskService.createEmailTask).not.toHaveBeenCalled();
    });
  });

  describe('handleSlaBreach', () => {
    it('should send SLA breach notification', async () => {
      (configService.get as jest.Mock).mockReturnValue('supervisor@example.com');
      (cacheService.getUserEmailFromCache as jest.Mock).mockResolvedValue('user@example.com');

      await service.handleSlaBreach({
        taskId: 'task-123',
        taskName: 'Critical Task',
        caseId: 'case-456',
        casePriority: 'HIGH',
        workQueueId: 'queue-1',
        workQueueName: 'Fraud',
        assignedUserId: 'user-123',
        tenantId: 'tenant-123',
        deadline: '2026-02-20',
        severity: 'HIGH',
        breachDuration: 5,
      });

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('SLA BREACH'),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should notify management for critical breaches', async () => {
      (configService.get as jest.Mock).mockReturnValueOnce('supervisor@example.com').mockReturnValueOnce('management@example.com');

      await service.handleSlaBreach({
        taskId: 'task-123',
        taskName: 'Critical Task',
        caseId: 'case-456',
        casePriority: 'CRITICAL',
        workQueueId: 'queue-1',
        workQueueName: 'Fraud',
        tenantId: 'tenant-123',
        deadline: '2026-02-20',
        severity: 'CRITICAL',
        breachDuration: 10,
      });

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledWith(
        'management@example.com',
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should not notify management for non-critical breaches', async () => {
      (configService.get as jest.Mock).mockReturnValue('supervisor@example.com');

      await service.handleSlaBreach({
        taskId: 'task-123',
        taskName: 'Task',
        caseId: 'case-456',
        casePriority: 'MEDIUM',
        workQueueId: 'queue-1',
        workQueueName: 'General',
        tenantId: 'tenant-123',
        deadline: '2026-02-20',
        severity: 'MEDIUM',
        breachDuration: 3,
      });

      expect(configService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleOverdueTask', () => {
    it('should send overdue task notification', async () => {
      (configService.get as jest.Mock).mockReturnValue('supervisor@example.com');

      await service.handleOverdueTask({
        taskId: 'task-123',
        taskName: 'Overdue Task',
        caseId: 'case-456',
        casePriority: 'HIGH',
        workQueueId: 'queue-1',
        workQueueName: 'Fraud',
        assignedUserId: 'user-123',
        tenantId: 'tenant-123',
        createdAt: '2026-01-01',
        hoursSinceCreation: 72,
      });

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledWith(
        'supervisor@example.com',
        expect.stringContaining('Overdue'),
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  describe('sendCaseSuspensionEmail (deprecated)', () => {
    it('should send case suspension email', async () => {
      await service.sendCaseSuspensionEmail('user@example.com', 'CASE-001', 'admin', 'Pending investigation');

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledWith(
        'user@example.com',
        'Case Suspended: CASE-001',
        expect.any(String),
        expect.objectContaining({
          caseId: 'CASE-001',
        }),
      );
    });
  });

  describe('sendCaseResumptionEmail (deprecated)', () => {
    it('should send case resumption email', async () => {
      await service.sendCaseResumptionEmail('user@example.com', 'CASE-001', 'admin', 'Investigation completed');

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledWith(
        'user@example.com',
        'Case Resumed: CASE-001',
        expect.any(String),
        expect.objectContaining({
          caseId: 'CASE-001',
        }),
      );
    });
  });

  describe('template mapping', () => {
    it('should use correct template for all notification types', async () => {
      (cacheService.getUserEmailFromCache as jest.Mock).mockResolvedValue('user@example.com');

      const notificationTypes = [
        'TASK_ASSIGNED',
        'TASK_UNASSIGNED',
        'TASK_REASSIGNED',
        'CASE_SUSPENDED',
        'CASE_RESUMED',
        'CASE_CLOSURE_PENDING',
        'CASE_CLOSURE_APPROVED',
        'CASE_CLOSURE_REJECTED',
        'CASE_REOPENED_ASSIGNED',
        'CASE_REOPENED_AVAILABLE',
        'CASE_REOPENING_REJECTED',
        'TASK_SLA_WARNING',
        'TASK_SLA_BREACH',
        'TASK_OVERDUE',
        'GENERIC',
      ];

      for (const type of notificationTypes) {
        await service.sendNotification({
          userId: 'user-123',
          type: type as any,
          message: 'Test notification',
          metadata: { taskTitle: 'Test', caseId: 'CASE-001' },
        });
      }

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledTimes(notificationTypes.length);
    });
  });

  describe('edge cases', () => {
    it('should handle very long user IDs', async () => {
      const longUserId = 'a'.repeat(1000);
      (cacheService.getUserEmailFromCache as jest.Mock).mockResolvedValue(null);

      await service.sendNotification({
        userId: longUserId,
        type: 'GENERIC',
        message: 'Test notification',
        metadata: {},
      });

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledWith(
        `user-${longUserId}@example.com`,
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should handle async task service failures gracefully', async () => {
      (cacheService.getUserEmailFromCache as jest.Mock).mockResolvedValue('user@example.com');
      (asyncTaskService.createEmailTask as jest.Mock).mockRejectedValue(new Error('Task creation failed'));

      await expect(
        service.sendNotification({
          userId: 'user-123',
          type: 'GENERIC',
          message: 'Test notification',
          metadata: {},
        }),
      ).rejects.toThrow('Task creation failed');
    });

    it('should handle parallel notifications', async () => {
      (cacheService.getUserEmailFromCache as jest.Mock).mockResolvedValue('user@example.com');

      const notifications = [
        service.sendNotification({ userId: 'user-1', type: 'GENERIC', message: 'Test 1', metadata: {} }),
        service.sendNotification({ userId: 'user-2', type: 'GENERIC', message: 'Test 2', metadata: {} }),
        service.sendNotification({ userId: 'user-3', type: 'GENERIC', message: 'Test 3', metadata: {} }),
      ];

      await Promise.all(notifications);

      expect(asyncTaskService.createEmailTask).toHaveBeenCalledTimes(3);
    });
  });
});
