import { Test, TestingModule } from '@nestjs/testing';
import { AsyncTaskService } from '../src/modules/async-task/async-task.service';
import { AsyncTaskRepository } from '../src/modules/repository/async-task.repository';

describe('AsyncTaskService', () => {
  let service: AsyncTaskService;
  let asyncTaskRepository: jest.Mocked<AsyncTaskRepository>;

  const mockTask = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    task_id: 1,
    task_type: 'email',
    status: 'pending',
    payload: {
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test HTML</p>',
    },
    metadata: { userId: 'user-123' },
    retry_count: 0,
    max_retries: 5,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    next_retry_at: null,
    processed_at: null,
  };

  const mockFailedTask = {
    ...mockTask,
    task_id: 2,
    status: 'failed',
    retry_count: 5,
  };

  // Helper function to create mock repository
  const createMockRepository = () => ({
    createEmailTask: jest.fn(),
    getTaskById: jest.fn(),
    getFailedTasks: jest.fn(),
    retryFailedTask: jest.fn(),
    markAsProcessing: jest.fn(),
    markAsCompleted: jest.fn(),
    markAsFailed: jest.fn(),
    scheduleRetry: jest.fn(),
    getPendingTasksForProcessing: jest.fn(),
  });

  beforeEach(async () => {
    const mockAsyncTaskRepository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsyncTaskService,
        {
          provide: AsyncTaskRepository,
          useValue: mockAsyncTaskRepository,
        },
      ],
    }).compile();

    service = module.get<AsyncTaskService>(AsyncTaskService);
    asyncTaskRepository = module.get(AsyncTaskRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createEmailTask', () => {
    it('should successfully create an email task', async () => {
      asyncTaskRepository.createEmailTask.mockResolvedValue(mockTask as any);

      const result = await service.createEmailTask('test@example.com', 'Test Subject', '<p>Test HTML</p>');

      expect(result).toBe(mockTask.id);
      expect(asyncTaskRepository.createEmailTask).toHaveBeenCalledWith('test@example.com', 'Test Subject', '<p>Test HTML</p>', undefined);
    });

    it.each([
      ['with metadata', { userId: 'user-123', caseId: 1 }],
      ['with empty metadata', {}],
    ])('should create email task %s', async (_desc, metadata) => {
      asyncTaskRepository.createEmailTask.mockResolvedValue(mockTask as any);

      const result = await service.createEmailTask('test@example.com', 'Test Subject', '<p>Test HTML</p>', metadata);

      expect(result).toBe(mockTask.id);
      expect(asyncTaskRepository.createEmailTask).toHaveBeenCalledWith('test@example.com', 'Test Subject', '<p>Test HTML</p>', metadata);
    });

    it('should log email task creation', async () => {
      asyncTaskRepository.createEmailTask.mockResolvedValue(mockTask as any);
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.createEmailTask('test@example.com', 'Test Subject', '<p>Test HTML</p>');

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Email task created:'));
    });

    it('should handle repository errors', async () => {
      const error = new Error('Database error');
      asyncTaskRepository.createEmailTask.mockRejectedValue(error);

      await expect(service.createEmailTask('test@example.com', 'Test Subject', '<p>Test HTML</p>')).rejects.toThrow('Database error');
    });
  });

  describe('getTaskById', () => {
    it('should successfully retrieve task by ID', async () => {
      asyncTaskRepository.getTaskById.mockResolvedValue(mockTask as any);

      const result = await service.getTaskById(1);

      expect(result).toEqual(mockTask);
      expect(asyncTaskRepository.getTaskById).toHaveBeenCalledWith(1);
    });

    it('should return null for non-existent task', async () => {
      asyncTaskRepository.getTaskById.mockResolvedValue(null);

      const result = await service.getTaskById(999);

      expect(result).toBeNull();
      expect(asyncTaskRepository.getTaskById).toHaveBeenCalledWith(999);
    });

    it('should handle repository errors', async () => {
      asyncTaskRepository.getTaskById.mockRejectedValue(new Error('Database error'));

      await expect(service.getTaskById(1)).rejects.toThrow('Database error');
    });
  });

  describe('getFailedTasks', () => {
    it.each([
      ['default limit', undefined, 100],
      ['custom limit', 50, 50],
    ])('should retrieve failed tasks with %s', async (_desc, inputLimit, expectedLimit) => {
      const failedTasks = [mockFailedTask];
      asyncTaskRepository.getFailedTasks.mockResolvedValue(failedTasks as any);

      const result = await service.getFailedTasks(inputLimit);

      expect(result).toEqual(failedTasks);
      expect(asyncTaskRepository.getFailedTasks).toHaveBeenCalledWith(expectedLimit);
    });

    it('should return empty array when no failed tasks', async () => {
      asyncTaskRepository.getFailedTasks.mockResolvedValue([]);

      const result = await service.getFailedTasks();

      expect(result).toEqual([]);
    });

    it('should handle repository errors', async () => {
      asyncTaskRepository.getFailedTasks.mockRejectedValue(new Error('Database error'));

      await expect(service.getFailedTasks()).rejects.toThrow('Database error');
    });
  });

  describe('retryFailedTask', () => {
    it('should successfully retry a failed task', async () => {
      asyncTaskRepository.retryFailedTask.mockResolvedValue(undefined);
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.retryFailedTask(1);

      expect(asyncTaskRepository.retryFailedTask).toHaveBeenCalledWith(1);
      expect(logSpy).toHaveBeenCalledWith('Task 1 reset for retry');
    });

    it('should handle repository errors', async () => {
      asyncTaskRepository.retryFailedTask.mockRejectedValue(new Error('Task not found'));

      await expect(service.retryFailedTask(999)).rejects.toThrow('Task not found');
    });
  });

  describe('markAsProcessing', () => {
    it('should mark task as processing', async () => {
      asyncTaskRepository.markAsProcessing.mockResolvedValue(undefined);

      await service.markAsProcessing(1);

      expect(asyncTaskRepository.markAsProcessing).toHaveBeenCalledWith(1);
    });

    it('should handle repository errors', async () => {
      asyncTaskRepository.markAsProcessing.mockRejectedValue(new Error('Database error'));

      await expect(service.markAsProcessing(1)).rejects.toThrow('Database error');
    });
  });

  describe('markAsCompleted', () => {
    it('should mark task as completed', async () => {
      asyncTaskRepository.markAsCompleted.mockResolvedValue(undefined);

      await service.markAsCompleted(1);

      expect(asyncTaskRepository.markAsCompleted).toHaveBeenCalledWith(1);
    });

    it('should handle repository errors', async () => {
      asyncTaskRepository.markAsCompleted.mockRejectedValue(new Error('Database error'));

      await expect(service.markAsCompleted(1)).rejects.toThrow('Database error');
    });
  });

  describe('markAsFailed', () => {
    it.each([
      ['with retry count', 3],
      ['with max retry count', 5],
    ])('should mark task as failed %s', async (_desc, retryCount) => {
      asyncTaskRepository.markAsFailed.mockResolvedValue(undefined);

      await service.markAsFailed(1, retryCount);

      expect(asyncTaskRepository.markAsFailed).toHaveBeenCalledWith(1, retryCount);
    });

    it('should handle repository errors', async () => {
      asyncTaskRepository.markAsFailed.mockRejectedValue(new Error('Database error'));

      await expect(service.markAsFailed(1, 3)).rejects.toThrow('Database error');
    });
  });

  describe('scheduleRetry', () => {
    it.each([
      ['1 minute delay', 1, 60000],
      ['5 minutes delay', 2, 300000],
    ])('should schedule task retry with %s', async (_desc, retryCount, delayMs) => {
      const nextRetryAt = new Date(Date.now() + delayMs);
      asyncTaskRepository.scheduleRetry.mockResolvedValue(undefined);

      await service.scheduleRetry(1, retryCount, nextRetryAt);

      expect(asyncTaskRepository.scheduleRetry).toHaveBeenCalledWith(1, retryCount, nextRetryAt);
    });

    it('should handle repository errors', async () => {
      const nextRetryAt = new Date();
      asyncTaskRepository.scheduleRetry.mockRejectedValue(new Error('Database error'));

      await expect(service.scheduleRetry(1, 1, nextRetryAt)).rejects.toThrow('Database error');
    });
  });

  describe('getPendingTasksForProcessing', () => {
    it.each([
      ['default limit', undefined, 10],
      ['custom limit', 5, 5],
      ['large batch', 50, 50],
    ])('should retrieve pending tasks with %s', async (_desc, inputLimit, expectedLimit) => {
      const pendingTasks = inputLimit === 50 ? Array.from({ length: 50 }, (_, i) => ({ ...mockTask, task_id: i + 1 })) : [mockTask];
      asyncTaskRepository.getPendingTasksForProcessing.mockResolvedValue(pendingTasks as any);

      const result = await service.getPendingTasksForProcessing(inputLimit);

      expect(result).toEqual(pendingTasks);
      expect(asyncTaskRepository.getPendingTasksForProcessing).toHaveBeenCalledWith(expectedLimit);
      if (inputLimit === 50) {
        expect(result).toHaveLength(50);
      }
    });

    it('should return empty array when no pending tasks', async () => {
      asyncTaskRepository.getPendingTasksForProcessing.mockResolvedValue([]);

      const result = await service.getPendingTasksForProcessing();

      expect(result).toEqual([]);
    });

    it('should handle repository errors', async () => {
      asyncTaskRepository.getPendingTasksForProcessing.mockRejectedValue(new Error('Database error'));

      await expect(service.getPendingTasksForProcessing()).rejects.toThrow('Database error');
    });
  });
});
