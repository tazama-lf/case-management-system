/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
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
  let schedulerRegistry: any;

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
    };

    const mockSchedulerRegistry = {
      addInterval: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertPriorityService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SchedulerRegistry, useValue: mockSchedulerRegistry },
      ],
    }).compile();

    service = module.get<AlertPriorityService>(AlertPriorityService);
    prismaService = module.get<PrismaService>(PrismaService);
    schedulerRegistry = mockSchedulerRegistry;

    // Mock setInterval to prevent actual scheduling during tests
    global.setInterval = jest.fn().mockReturnValue('mock-interval-id' as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should schedule interval and add to scheduler registry', () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      
      service.onModuleInit();

      expect(global.setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        3600000 // 1 hour in milliseconds
      );
      expect(schedulerRegistry.addInterval).toHaveBeenCalledWith(
        'alert-priority-interval',
        'mock-interval-id'
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        'Alert priority recalculation scheduled every 3600 seconds.'
      );
    });

    it('should catch and log errors from runRecalculation', () => {
      jest.spyOn(service, 'runRecalculation').mockRejectedValue(new Error('Test error'));
      
      service.onModuleInit();

      // Get the callback function passed to setInterval
      const setIntervalCallback = (global.setInterval as jest.Mock).mock.calls[0][0];
      
      // Execute the callback - it should catch and log the error
      // The callback itself is async but doesn't return a promise, it catches errors internally
      expect(() => setIntervalCallback()).not.toThrow();
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

    it('should process alerts and update priority correctly for NEW urgency', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      const debugSpy = jest.spyOn(service['logger'], 'debug');
      
      const mockAlert = {
        alert_id: 'alert-123',
        created_at: new Date('2023-01-01T11:00:00.000Z'), // 1 hour ago
        alert_data: { sla_hours: 72 },
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockResolvedValue(mockAlert);

      await service.runRecalculation();

      const expectedSlaProgress = 1 / 72; // 1 hour elapsed / 72 hours SLA = ~0.0139
      
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 'alert-123' },
        data: {
          alert_data: {
            sla_hours: 72,
            priority_score: 0.5,
            urgency: 'New',
            sla_progress: Number(expectedSlaProgress.toFixed(4)),
            last_priority_update: mockDate.toISOString(),
          },
        },
      });

      expect(loggerSpy).toHaveBeenCalledWith('Starting alert priority recalculation job...');
      expect(loggerSpy).toHaveBeenCalledWith('Alert priority recalculation job complete.');
      expect(debugSpy).toHaveBeenCalledWith('Alert alert-123: priority=0.5 urgency=New');
    });

    it('should process alerts and update priority correctly for URGENT urgency', async () => {
      const mockAlert = {
        alert_id: 'alert-456',
        created_at: new Date('2023-01-01T00:00:00.000Z'), // 12 hours ago
        alert_data: { sla_hours: 24 }, // Short SLA for testing
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockResolvedValue(mockAlert);

      await service.runRecalculation();

      const expectedSlaProgress = 12 / 24; // 12 hours elapsed / 24 hours SLA = 0.5 (above 0.33 threshold)
      
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 'alert-456' },
        data: {
          alert_data: {
            sla_hours: 24,
            priority_score: 0.5,
            urgency: 'Urgent',
            sla_progress: Number(expectedSlaProgress.toFixed(4)),
            last_priority_update: mockDate.toISOString(),
          },
        },
      });
    });

    it('should process alerts and update priority correctly for CRITICAL urgency', async () => {
      const mockAlert = {
        alert_id: 'alert-789',
        created_at: new Date('2022-12-31T18:00:00.000Z'), // 18 hours ago
        alert_data: { sla_hours: 24 },
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockResolvedValue(mockAlert);

      await service.runRecalculation();

      const expectedSlaProgress = 18 / 24; // 18 hours elapsed / 24 hours SLA = 0.75 (above 0.66 threshold)
      
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 'alert-789' },
        data: {
          alert_data: {
            sla_hours: 24,
            priority_score: 0.5,
            urgency: 'Critical',
            sla_progress: Number(expectedSlaProgress.toFixed(4)),
            last_priority_update: mockDate.toISOString(),
          },
        },
      });
    });

    it('should process alerts and update priority correctly for BREACH urgency', async () => {
      const mockAlert = {
        alert_id: 'alert-breach',
        created_at: new Date('2022-12-31T00:00:00.000Z'), // 36 hours ago
        alert_data: { sla_hours: 24 },
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockResolvedValue(mockAlert);

      await service.runRecalculation();

      const expectedSlaProgress = 36 / 24; // 36 hours elapsed / 24 hours SLA = 1.5 (above 1.0 threshold)
      
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 'alert-breach' },
        data: {
          alert_data: {
            sla_hours: 24,
            priority_score: 0.5,
            urgency: 'Breach',
            sla_progress: Number(expectedSlaProgress.toFixed(4)),
            last_priority_update: mockDate.toISOString(),
          },
        },
      });
    });

    it('should use default SLA hours when not provided in alert data', async () => {
      const mockAlert = {
        alert_id: 'alert-default-sla',
        created_at: new Date('2023-01-01T11:00:00.000Z'), // 1 hour ago
        alert_data: {}, // No sla_hours provided
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockResolvedValue(mockAlert);

      await service.runRecalculation();

      const expectedSlaProgress = 1 / 72; // 1 hour elapsed / 72 hours default SLA
      
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 'alert-default-sla' },
        data: {
          alert_data: {
            sla_hours: 72,
            priority_score: 0.5,
            urgency: 'New',
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
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockResolvedValue(mockAlert);

      await service.runRecalculation();

      const expectedSlaProgress = 1 / 72; // 1 hour elapsed / 72 hours default SLA
      
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 'alert-no-data' },
        data: {
          alert_data: {
            sla_hours: 72,
            priority_score: 0.5,
            urgency: 'New',
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
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockResolvedValue(mockAlert);

      await service.runRecalculation();

      const expectedSlaProgress = 1 / 72; // 1 hour elapsed / 72 hours default SLA
      
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 'alert-invalid-sla' },
        data: {
          alert_data: {
            sla_hours: 72,
            priority_score: 0.5,
            urgency: 'New',
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
      };

      prismaService.alert.findMany.mockResolvedValue([mockAlert]);
      prismaService.alert.update.mockResolvedValue(mockAlert);

      await service.runRecalculation();

      const expectedSlaProgress = 1 / 48; // 1 hour elapsed / 48 hours SLA
      
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 'alert-preserve-data' },
        data: {
          alert_data: {
            existing_field: 'preserve_me',
            another_field: 12345,
            sla_hours: 48,
            priority_score: 0.5,
            urgency: 'New',
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
        },
        {
          alert_id: 'alert-2',
          created_at: new Date('2023-01-01T00:00:00.000Z'), // 12 hours ago
          alert_data: { sla_hours: 24 },
        },
      ];

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.update.mockResolvedValue({} as any);

      await service.runRecalculation();

      expect(prismaService.alert.update).toHaveBeenCalledTimes(2);
      
      // First alert - NEW urgency
      expect(prismaService.alert.update).toHaveBeenNthCalledWith(1, {
        where: { alert_id: 'alert-1' },
        data: {
          alert_data: expect.objectContaining({
            urgency: 'New',
            sla_progress: Number((1 / 72).toFixed(4)),
          }),
        },
      });

      // Second alert - URGENT urgency (12/24 = 0.5, above 0.33 threshold)
      expect(prismaService.alert.update).toHaveBeenNthCalledWith(2, {
        where: { alert_id: 'alert-2' },
        data: {
          alert_data: expect.objectContaining({
            urgency: 'Urgent',
            sla_progress: Number((12 / 24).toFixed(4)),
          }),
        },
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
