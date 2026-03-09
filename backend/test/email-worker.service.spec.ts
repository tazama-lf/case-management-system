import { Test, TestingModule } from '@nestjs/testing';
import { EmailWorkerService } from '../src/modules/async-task/email-worker.service';
import { AsyncTaskService } from '../src/modules/async-task/async-task.service';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('EmailWorkerService', () => {
  let service: EmailWorkerService;
  let asyncTaskService: jest.Mocked<AsyncTaskService>;
  let configService: jest.Mocked<ConfigService>;
  let mockTransporter: any;

  const mockTask = {
    task_id: 1,
    task_type: 'email',
    status: 'pending',
    payload: {
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test HTML</p>',
    },
    retry_count: 0,
    max_retries: 5,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
  };

  const createMockConfig = (overrides?: Record<string, string>) => ({
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        MAIL_FROM: '"CMS Notifications" <no-reply@cms.local>',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'user@example.com',
        SMTP_PASS: 'password',
        ...overrides,
      };
      return config[key] || defaultValue;
    }),
  });

  beforeEach(async () => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-message-id' }),
    };

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailWorkerService,
        {
          provide: AsyncTaskService,
          useValue: {
            getPendingTasksForProcessing: jest.fn(),
            markAsProcessing: jest.fn(),
            markAsCompleted: jest.fn(),
            markAsFailed: jest.fn(),
            scheduleRetry: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: createMockConfig(),
        },
      ],
    }).compile();

    service = module.get<EmailWorkerService>(EmailWorkerService);
    asyncTaskService = module.get(AsyncTaskService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with SMTP configuration', () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'user@example.com',
          pass: 'password',
        },
      });
    });

    it('should warn when SMTP_HOST not configured', async () => {
      const LoggerSpy = jest.spyOn(require('@nestjs/common').Logger.prototype, 'warn');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailWorkerService,
          { provide: AsyncTaskService, useValue: asyncTaskService },
          { provide: ConfigService, useValue: createMockConfig({ SMTP_HOST: '' }) },
        ],
      }).compile();

      expect(LoggerSpy).toHaveBeenCalledWith('SMTP_HOST not configured - emails will fail to send!');
      expect(LoggerSpy).toHaveBeenCalledWith('Please configure SMTP settings in .env file');

      LoggerSpy.mockRestore();
    });

    it('should initialize without SMTP auth when SMTP_USER not provided', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailWorkerService,
          { provide: AsyncTaskService, useValue: asyncTaskService },
          { provide: ConfigService, useValue: createMockConfig({ SMTP_USER: '' }) },
        ],
      }).compile();

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: undefined,
      });
    });
  });

  describe('processEmailQueue', () => {
    beforeEach(() => {
      asyncTaskService.markAsProcessing.mockResolvedValue(undefined);
      asyncTaskService.markAsCompleted.mockResolvedValue(undefined);
    });

    it('should skip processing when already processing', async () => {
      service['isProcessing'] = true;

      await service.processEmailQueue();

      expect(asyncTaskService.getPendingTasksForProcessing).not.toHaveBeenCalled();
    });

    it('should process pending email tasks', async () => {
      asyncTaskService.getPendingTasksForProcessing.mockResolvedValue([mockTask] as any);

      await service.processEmailQueue();

      expect(asyncTaskService.getPendingTasksForProcessing).toHaveBeenCalledWith(10);
      expect(asyncTaskService.markAsProcessing).toHaveBeenCalledWith(1);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
      expect(asyncTaskService.markAsCompleted).toHaveBeenCalledWith(1);
    });

    it('should not process when no tasks available', async () => {
      asyncTaskService.getPendingTasksForProcessing.mockResolvedValue([]);

      await service.processEmailQueue();

      expect(asyncTaskService.markAsProcessing).not.toHaveBeenCalled();
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should process multiple tasks', async () => {
      const tasks = [
        mockTask,
        { ...mockTask, task_id: 2, payload: { to: 'test2@example.com', subject: 'Test 2', html: '<p>Test 2</p>' } },
        { ...mockTask, task_id: 3, payload: { to: 'test3@example.com', subject: 'Test 3', html: '<p>Test 3</p>' } },
      ];
      asyncTaskService.getPendingTasksForProcessing.mockResolvedValue(tasks as any);
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.processEmailQueue();

      expect(logSpy).toHaveBeenCalledWith('Processing 3 email tasks');
      expect(asyncTaskService.markAsProcessing).toHaveBeenCalledTimes(3);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
      expect(asyncTaskService.markAsCompleted).toHaveBeenCalledTimes(3);
    });

    it('should handle queue processing errors', async () => {
      asyncTaskService.getPendingTasksForProcessing.mockRejectedValue(new Error('Queue error'));
      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service.processEmailQueue();

      expect(errorSpy).toHaveBeenCalledWith('Email queue processing error: Queue error', expect.any(String));
      expect(service['isProcessing']).toBe(false);
    });

    it.each([
      ['after completion', false],
      ['after error', true],
    ])('should reset isProcessing flag %s', async (_description, shouldError) => {
      if (shouldError) {
        asyncTaskService.getPendingTasksForProcessing.mockRejectedValue(new Error('Error'));
        jest.spyOn(service['logger'], 'error').mockImplementation();
      } else {
        asyncTaskService.getPendingTasksForProcessing.mockResolvedValue([mockTask] as any);
      }

      expect(service['isProcessing']).toBe(false);
      await service.processEmailQueue();
      expect(service['isProcessing']).toBe(false);
    });
  });

  describe('processTask', () => {
    beforeEach(() => {
      asyncTaskService.markAsProcessing.mockResolvedValue(undefined);
      asyncTaskService.markAsCompleted.mockResolvedValue(undefined);
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'sent-123' });
    });

    it('should successfully process and send email', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service['processTask'](mockTask);

      expect(asyncTaskService.markAsProcessing).toHaveBeenCalledWith(1);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: '"CMS Notifications" <no-reply@cms.local>',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
      });
      expect(asyncTaskService.markAsCompleted).toHaveBeenCalledWith(1);
      expect(logSpy).toHaveBeenCalledWith('Email sent successfully: 1 to test@example.com - Test Subject');
    });

    it('should debug log email sending attempt and response', async () => {
      const debugSpy = jest.spyOn(service['logger'], 'debug');

      await service['processTask'](mockTask);

      expect(debugSpy).toHaveBeenCalledWith('Attempting to send email: 1 to test@example.com');
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('SMTP response:'));
    });

    it('should handle email send failure and schedule retry', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));
      asyncTaskService.scheduleRetry.mockResolvedValue(undefined);
      const errorSpy = jest.spyOn(service['logger'], 'error');
      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['processTask'](mockTask);

      expect(errorSpy).toHaveBeenCalledWith('Email send failed for 1: SMTP error', expect.any(String));
      expect(asyncTaskService.scheduleRetry).toHaveBeenCalledWith(1, 1, expect.any(Date));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Email task retry scheduled: 1'));
    });

    it('should mark as failed after max retries exceeded', async () => {
      const taskWithMaxRetries = { ...mockTask, retry_count: 4 };
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));
      asyncTaskService.markAsFailed.mockResolvedValue(undefined);
      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service['processTask'](taskWithMaxRetries);

      expect(asyncTaskService.markAsFailed).toHaveBeenCalledWith(1, 5);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Email task failed permanently: 1 after 5 attempts'));
    });
  });

  describe('handleTaskFailure', () => {
    it('should schedule retry for first failure', async () => {
      asyncTaskService.scheduleRetry.mockResolvedValue(undefined);
      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service['handleTaskFailure'](mockTask, new Error('SMTP error'));

      expect(asyncTaskService.scheduleRetry).toHaveBeenCalledWith(1, 1, expect.any(Date));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Email task retry scheduled: 1 (attempt 1/5)'));
    });

    it('should mark as failed when max retries reached', async () => {
      const taskAtMaxRetries = { ...mockTask, retry_count: 4 };
      asyncTaskService.markAsFailed.mockResolvedValue(undefined);
      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service['handleTaskFailure'](taskAtMaxRetries, new Error('SMTP error'));

      expect(asyncTaskService.markAsFailed).toHaveBeenCalledWith(1, 5);
      expect(errorSpy).toHaveBeenCalledWith('Email task failed permanently: 1 after 5 attempts - SMTP error');
    });

    it('should handle error without message', async () => {
      asyncTaskService.scheduleRetry.mockResolvedValue(undefined);

      await service['handleTaskFailure'](mockTask, new Error());

      expect(asyncTaskService.scheduleRetry).toHaveBeenCalledWith(1, 1, expect.any(Date));
    });

    it('should schedule retry with correct retry count', async () => {
      const taskWithRetries = { ...mockTask, retry_count: 2 };
      asyncTaskService.scheduleRetry.mockResolvedValue(undefined);

      await service['handleTaskFailure'](taskWithRetries, new Error('SMTP error'));

      expect(asyncTaskService.scheduleRetry).toHaveBeenCalledWith(1, 3, expect.any(Date));
    });
  });

  describe('calculateNextRetry', () => {
    it.each([
      [1, 1, 59000, 61000], // 1 minute
      [2, 5, 299000, 301000], // 5 minutes
      [3, 15, 899000, 901000], // 15 minutes
      [4, 60, 3599000, 3601000], // 1 hour
      [5, 240, 14399000, 14401000], // 4 hours
      [10, 240, 14399000, 14401000], // capped at 4 hours
    ])('should calculate %i minute(s) delay for retry %i', (retryCount, _expectedMinutes, minMs, maxMs) => {
      const now = new Date();
      const nextRetry = service['calculateNextRetry'](retryCount);

      const timeDiff = nextRetry.getTime() - now.getTime();
      expect(timeDiff).toBeGreaterThanOrEqual(minMs);
      expect(timeDiff).toBeLessThanOrEqual(maxMs);
      expect(nextRetry).toBeInstanceOf(Date);
      expect(nextRetry.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('getWorkerStats', () => {
    it.each([[false], [true]])('should return worker statistics when isProcessing is %s', async (isProcessing) => {
      service['isProcessing'] = isProcessing;

      const stats = await service.getWorkerStats();

      expect(stats).toEqual({
        isProcessing,
        cronSchedule: 'Every 5 seconds',
      });
    });
  });
});
