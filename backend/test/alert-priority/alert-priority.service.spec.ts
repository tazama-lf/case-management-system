/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AlertPriorityService } from '../../src/alert-priority/alert-priority.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';

// Mock Logger to prevent console output during tests
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});

describe('AlertPriorityService', () => {
  let service: AlertPriorityService;
  let prismaService: any;
  let configService: any;

  const mockDate = new Date('2023-01-01T12:00:00.000Z');

  beforeEach(async () => {
    // Mock Date to ensure consistent test results
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);

    const mockPrismaService = {
      alert: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      case: {
        update: jest.fn(),
      },
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        switch (key) {
          case 'PRIORITY_FIRST_HALF':
            return 0.33;
          case 'PRIORITY_SECOND_HALF':
            return 0.66;
          case 'PRIORITY_THIRD_HALF':
            return 1.0;
          case 'DEFAULT_SLA_HOURS':
            return 72;
          case 'ALERT_PRIORITY_UPDATE_INTERVAL_MS':
            return 3600000;
          default:
            return defaultValue;
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertPriorityService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AlertPriorityService>(AlertPriorityService);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = mockConfigService;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should log initialization message', () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      
      service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Alert priority service initialized. Recalculation will run via scheduled task every hour.'
      );
    });
  });

  describe('runRecalculation', () => {
    it('should log and return early when no alerts exist', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      prismaService.alert.findMany.mockResolvedValue([]);

      await service.runRecalculation();

      expect(loggerSpy).toHaveBeenCalledWith('Starting alert priority recalculation job...');
      expect(loggerSpy).toHaveBeenCalledWith('No alerts to process.');
      expect(prismaService.alert.update).not.toHaveBeenCalled();
    });

    it('should process alerts and update priority correctly for NEW priority', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      const debugSpy = jest.spyOn(service['logger'], 'debug');
      
      const mockAlert = {
        alert_id: 'alert-123',
        created_at: new Date('2023-01-01T11:00:00.000Z'), // 1 hour ago
        alert_data: { sla_hours: 72 },
        priority_score: null, // No AI priority score provided
        case_id: null, // No associated case
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockResolvedValue(mockAlert);

      await service.runRecalculation();

      const expectedSlaProgress = 1 / 72; // 1 hour elapsed / 72 hours SLA = ~0.0139
      
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 'alert-123' },
        data: {
          priority: 'NEW',
          priority_score: expectedSlaProgress,
          alert_data: {
            sla_hours: 72,
            sla_progress: Number(expectedSlaProgress.toFixed(4)),
            last_priority_update: mockDate.toISOString(),
          },
        },
      });

      expect(loggerSpy).toHaveBeenCalledWith('Starting alert priority recalculation job...');
      expect(loggerSpy).toHaveBeenCalledWith('Alert priority recalculation job complete.');
      expect(debugSpy).toHaveBeenCalledWith(`Alert alert-123: priority_score=${expectedSlaProgress} priority=NEW`);
    });

    it('should process alerts and update priority correctly for URGENT priority', async () => {
      const mockAlert = {
        alert_id: 'alert-456',
        created_at: new Date('2023-01-01T00:00:00.000Z'), // 12 hours ago
        alert_data: { sla_hours: 24 }, // Short SLA for testing
        priority_score: 0.5, // AI provided priority score above 0.33 threshold
        case_id: 'case-456', // Associated case
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockResolvedValue(mockAlert);

      await service.runRecalculation();

      const expectedSlaProgress = 12 / 24; // 12 hours elapsed / 24 hours SLA = 0.5
      
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 'alert-456' },
        data: {
          priority: 'URGENT',
          priority_score: 0.5,
          alert_data: {
            sla_hours: 24,
            sla_progress: Number(expectedSlaProgress.toFixed(4)),
            last_priority_update: mockDate.toISOString(),
          },
        },
      });

      // Should also update associated case priority
      expect(prismaService.case.update).toHaveBeenCalledWith({
        where: { case_id: 'case-456' },
        data: {
          priority: 'URGENT',
        },
      });
    });

    it('should process alerts and update priority correctly for CRITICAL priority', async () => {
      const mockAlert = {
        alert_id: 'alert-789',
        created_at: new Date('2022-12-31T18:00:00.000Z'), // 18 hours ago
        alert_data: { sla_hours: 24 },
        priority_score: 0.75, // AI provided priority score above 0.66 threshold
        case_id: 'case-789', // Associated case
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockResolvedValue(mockAlert);

      await service.runRecalculation();

      const expectedSlaProgress = 18 / 24; // 18 hours elapsed / 24 hours SLA = 0.75
      
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 'alert-789' },
        data: {
          priority: 'CRITICAL',
          priority_score: 0.75,
          alert_data: {
            sla_hours: 24,
            sla_progress: Number(expectedSlaProgress.toFixed(4)),
            last_priority_update: mockDate.toISOString(),
          },
        },
      });

      // Should also update associated case priority
      expect(prismaService.case.update).toHaveBeenCalledWith({
        where: { case_id: 'case-789' },
        data: {
          priority: 'CRITICAL',
        },
      });
    });

    it('should process alerts and update priority correctly for BREACH priority', async () => {
      const mockAlert = {
        alert_id: 'alert-breach',
        created_at: new Date('2022-12-31T00:00:00.000Z'), // 36 hours ago
        alert_data: { sla_hours: 24 },
        priority_score: 1.2, // AI provided priority score above 1.0 threshold
        case_id: 'case-breach', // Associated case
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockResolvedValue(mockAlert);

      await service.runRecalculation();

      const expectedSlaProgress = 36 / 24; // 36 hours elapsed / 24 hours SLA = 1.5
      
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 'alert-breach' },
        data: {
          priority: 'BREACH',
          priority_score: 1.2,
          alert_data: {
            sla_hours: 24,
            sla_progress: Number(expectedSlaProgress.toFixed(4)),
            last_priority_update: mockDate.toISOString(),
          },
        },
      });

      // Should also update associated case priority
      expect(prismaService.case.update).toHaveBeenCalledWith({
        where: { case_id: 'case-breach' },
        data: {
          priority: 'BREACH',
        },
      });
    });

    it('should use default SLA hours when not provided in alert data', async () => {
      const mockAlert = {
        alert_id: 'alert-default-sla',
        created_at: new Date('2023-01-01T11:00:00.000Z'), // 1 hour ago
        alert_data: {}, // No sla_hours provided
        priority_score: null, // No AI priority score
        case_id: null, // No associated case
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockResolvedValue(mockAlert);

      await service.runRecalculation();

      const expectedSlaProgress = 1 / 72; // 1 hour elapsed / 72 hours default SLA
      
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 'alert-default-sla' },
        data: {
          priority: 'NEW',
          priority_score: expectedSlaProgress,
          alert_data: {
            sla_hours: 72,
            sla_progress: Number(expectedSlaProgress.toFixed(4)),
            last_priority_update: mockDate.toISOString(),
          },
        },
      });
    });

    it('should handle alerts with null or undefined alert_data', async () => {
      const mockAlert = {
        alert_id: 'alert-no-data',
        created_at: new Date('2023-01-01T11:00:00.000Z'), // 1 hour ago
        alert_data: null,
        priority_score: null,
        case_id: null, // No associated case
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockResolvedValue(mockAlert);

      await service.runRecalculation();

      const expectedSlaProgress = 1 / 72; // 1 hour elapsed / 72 hours default SLA
      
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 'alert-no-data' },
        data: {
          priority: 'NEW',
          priority_score: expectedSlaProgress,
          alert_data: {
            sla_hours: 72,
            sla_progress: Number(expectedSlaProgress.toFixed(4)),
            last_priority_update: mockDate.toISOString(),
          },
        },
      });
    });

    it('should handle invalid SLA hours and use default', async () => {
      const mockAlert = {
        alert_id: 'alert-invalid-sla',
        created_at: new Date('2023-01-01T11:00:00.000Z'), // 1 hour ago
        alert_data: { sla_hours: 'invalid' },
        priority_score: null,
        case_id: null, // No associated case
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockResolvedValue(mockAlert);

      await service.runRecalculation();

      const expectedSlaProgress = 1 / 72; // 1 hour elapsed / 72 hours default SLA
      
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 'alert-invalid-sla' },
        data: {
          priority: 'NEW',
          priority_score: expectedSlaProgress,
          alert_data: {
            sla_hours: 72,
            sla_progress: Number(expectedSlaProgress.toFixed(4)),
            last_priority_update: mockDate.toISOString(),
          },
        },
      });
    });

    it('should preserve existing alert_data fields when updating', async () => {
      const mockAlert = {
        alert_id: 'alert-preserve-data',
        created_at: new Date('2023-01-01T11:00:00.000Z'), // 1 hour ago
        alert_data: { 
          sla_hours: 48,
          existing_field: 'preserve_me',
          another_field: 12345
        },
        priority_score: 0.25, // AI provided priority score
        case_id: null, // No associated case
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockResolvedValue(mockAlert);

      await service.runRecalculation();

      const expectedSlaProgress = 1 / 48; // 1 hour elapsed / 48 hours SLA
      
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 'alert-preserve-data' },
        data: {
          priority: 'NEW',
          priority_score: 0.25,
          alert_data: {
            existing_field: 'preserve_me',
            another_field: 12345,
            sla_hours: 48,
            sla_progress: Number(expectedSlaProgress.toFixed(4)),
            last_priority_update: mockDate.toISOString(),
          },
        },
      });
    });

    it('should handle database update errors gracefully', async () => {
      const errorSpy = jest.spyOn(service['logger'], 'error');
      const mockAlert = {
        alert_id: 'alert-error',
        created_at: new Date('2023-01-01T11:00:00.000Z'),
        alert_data: { sla_hours: 72 },
        priority_score: null,
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockRejectedValue(new Error('Database error'));

      await service.runRecalculation();

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to process alert alert-error: Error: Database error',
        expect.any(String)
      );
    });

    it('should handle multiple alerts correctly', async () => {
      const mockAlerts = [
        {
          alert_id: 'alert-1',
          created_at: new Date('2023-01-01T11:00:00.000Z'), // 1 hour ago
          alert_data: { sla_hours: 72 },
          priority_score: null,
          case_id: null, // No associated case
        },
        {
          alert_id: 'alert-2',
          created_at: new Date('2023-01-01T00:00:00.000Z'), // 12 hours ago
          alert_data: { sla_hours: 24 },
          priority_score: 0.5, // AI provided score above 0.33 threshold
          case_id: null, // No associated case
        },
      ];

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.update.mockResolvedValue({} as any);

      await service.runRecalculation();

      expect(prismaService.alert.update).toHaveBeenCalledTimes(2);
      
      // First alert - NEW priority (uses SLA progress as fallback)
      expect(prismaService.alert.update).toHaveBeenNthCalledWith(1, {
        where: { alert_id: 'alert-1' },
        data: expect.objectContaining({
          priority: 'NEW',
          priority_score: 1 / 72, // Raw SLA progress value
        }),
      });

      // Second alert - URGENT priority (AI score 0.5 above 0.33 threshold)
      expect(prismaService.alert.update).toHaveBeenNthCalledWith(2, {
        where: { alert_id: 'alert-2' },
        data: expect.objectContaining({
          priority: 'URGENT',
          priority_score: 0.5,
        }),
      });
    });

    it('should handle database findMany errors', async () => {
      const errorSpy = jest.spyOn(service['logger'], 'error');
      prismaService.alert.findMany.mockRejectedValue(new Error('Database connection error'));

      await expect(service.runRecalculation()).rejects.toThrow('Database connection error');
      expect(errorSpy).not.toHaveBeenCalled(); // Error should propagate up
    });
  });
});
