import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AlertPriorityService } from '../../src/alert-priority/alert-priority.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AlertPriorityService', () => {
  let service: AlertPriorityService;
  let prismaService: PrismaService;
  let configService: ConfigService;
  let schedulerRegistry: SchedulerRegistry;

  const mockPrismaService = {
    alert: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        ALERT_DEFAULT_SLA_HOURS: '72',
        ALERT_PRIORITY_UPDATE_INTERVAL: '3600',
        ALERT_URGENCY_THRESHOLDS: '0.33,0.66,1.0',
      };
      return config[key];
    }),
  };

  const mockSchedulerRegistry = {
    addInterval: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertPriorityService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: SchedulerRegistry,
          useValue: mockSchedulerRegistry,
        },
      ],
    }).compile();

    service = module.get<AlertPriorityService>(AlertPriorityService);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize with default configuration', () => {
      service.onModuleInit();
      expect(configService.get).toHaveBeenCalledWith('ALERT_DEFAULT_SLA_HOURS');
      expect(configService.get).toHaveBeenCalledWith('ALERT_URGENCY_THRESHOLDS');
      expect(configService.get).toHaveBeenCalledWith('ALERT_PRIORITY_UPDATE_INTERVAL');
      expect(schedulerRegistry.addInterval).toHaveBeenCalled();
    });

    it('should handle malformed urgency thresholds', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'ALERT_URGENCY_THRESHOLDS') return 'invalid,data';
        if (key === 'ALERT_DEFAULT_SLA_HOURS') return '72';
        if (key === 'ALERT_PRIORITY_UPDATE_INTERVAL') return '3600';
        return undefined;
      });

      const loggerSpy = jest.spyOn(service['logger'], 'warn');
      service.onModuleInit();
      expect(loggerSpy).toHaveBeenCalledWith('ALERT_URGENCY_THRESHOLDS malformed. Using default thresholds.');
    });
  });

  describe('runRecalculation', () => {
    const mockAlert = {
      alert_id: 'test-alert-1',
      created_at: new Date('2025-01-01T12:00:00Z'),
      alert_data: { sla_hours: 72 },
      alert_status: 'NEW',
      confidence_per: 80,
      transaction: { amount: 1000 },
      txtp: 75,
    };

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should process alerts and update priority', async () => {
      mockPrismaService.alert.findMany.mockResolvedValue([mockAlert]);
      mockPrismaService.alert.update.mockResolvedValue({});

      await service.runRecalculation();

      expect(mockPrismaService.alert.findMany).toHaveBeenCalledWith({
        where: {
          alert_status: {
            not: 'CLOSED',
          },
        },
      });
      expect(mockPrismaService.alert.update).toHaveBeenCalled();
    });

    it('should handle empty alert list', async () => {
      mockPrismaService.alert.findMany.mockResolvedValue([]);
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.runRecalculation();

      expect(loggerSpy).toHaveBeenCalledWith('No alerts to process.');
      expect(mockPrismaService.alert.update).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const errorAlert = { ...mockAlert, alert_id: 'error-alert' };
      mockPrismaService.alert.findMany.mockResolvedValue([errorAlert]);
      mockPrismaService.alert.update.mockRejectedValue(new Error('Database error'));

      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.runRecalculation();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to process alert error-alert'), expect.any(String));
    });
  });

  describe('urgency classification based on time elapsed', () => {
    const baseAlert = {
      alert_id: 'test-alert',
      alert_data: { sla_hours: 72 },
      alert_status: 'NEW',
      confidence_per: 80,
      transaction: { amount: 1000 },
      txtp: 75,
    };

    beforeEach(() => {
      mockPrismaService.alert.findMany.mockResolvedValue([]);
      mockPrismaService.alert.update.mockResolvedValue({});
    });

    it('should classify as "New" for alerts within first 33% of SLA', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-02T12:00:00Z')); // 24 hours later

      const alert = {
        ...baseAlert,
        created_at: new Date('2025-01-01T12:00:00Z'),
      };

      mockPrismaService.alert.findMany.mockResolvedValue([alert]);
      await service.runRecalculation();

      const updateCall = mockPrismaService.alert.update.mock.calls[0];
      expect(updateCall[0].data.alert_data.urgency).toBe('New');

      jest.useRealTimers();
    });

    it('should classify as "Urgent" for alerts between 33-66% of SLA', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-02T12:00:00Z')); // 36 hours later

      const alert = {
        ...baseAlert,
        created_at: new Date('2025-01-01T00:00:00Z'),
      };

      mockPrismaService.alert.findMany.mockResolvedValue([alert]);
      await service.runRecalculation();

      const updateCall = mockPrismaService.alert.update.mock.calls[0];
      expect(updateCall[0].data.alert_data.urgency).toBe('Urgent');

      jest.useRealTimers();
    });

    it('should classify as "Critical" for alerts between 66-100% of SLA', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-04T00:00:00Z')); // 60 hours later

      const alert = {
        ...baseAlert,
        created_at: new Date('2025-01-01T12:00:00Z'),
      };

      mockPrismaService.alert.findMany.mockResolvedValue([alert]);
      await service.runRecalculation();

      const updateCall = mockPrismaService.alert.update.mock.calls[0];
      expect(updateCall[0].data.alert_data.urgency).toBe('Critical');

      jest.useRealTimers();
    });

    it('should classify as "Breach" for alerts beyond SLA deadline', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-05T00:00:00Z')); // 84 hours later

      const alert = {
        ...baseAlert,
        created_at: new Date('2025-01-01T12:00:00Z'),
      };

      mockPrismaService.alert.findMany.mockResolvedValue([alert]);
      await service.runRecalculation();

      const updateCall = mockPrismaService.alert.update.mock.calls[0];
      expect(updateCall[0].data.alert_data.urgency).toBe('Breach');

      jest.useRealTimers();
    });
  });

  describe('simplified priority system', () => {
    it('should use fixed priority score of 0.5', async () => {
      const alert = {
        alert_id: 'test-alert',
        created_at: new Date('2025-01-01T12:00:00Z'),
        alert_data: { sla_hours: 72 },
        alert_status: 'NEW',
      };

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-01T12:00:00Z'));

      mockPrismaService.alert.findMany.mockResolvedValue([alert]);
      mockPrismaService.alert.update.mockResolvedValue({});

      await service.runRecalculation();

      const updateCall = mockPrismaService.alert.update.mock.calls[0];
      expect(updateCall[0].data.alert_data.priority_score).toBe(0.5);

      jest.useRealTimers();
    });

    it('should focus only on time-based urgency classification', async () => {
      const alert = {
        alert_id: 'test-alert',
        created_at: new Date('2025-01-01T00:00:00Z'),
        alert_data: { sla_hours: 72 },
        alert_status: 'NEW',
      };

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-02T06:00:00Z')); // 30 hours later

      mockPrismaService.alert.findMany.mockResolvedValue([alert]);
      mockPrismaService.alert.update.mockResolvedValue({});

      await service.runRecalculation();

      const updateCall = mockPrismaService.alert.update.mock.calls[0];
      const updatedData = updateCall[0].data.alert_data;

      expect(updatedData.urgency).toBe('Urgent');
      expect(updatedData.priority_score).toBe(0.5);
      expect(updatedData.sla_progress).toBeCloseTo(0.4167, 3); // 30/72 hours

      jest.useRealTimers();
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle complete workflow for new alert', async () => {
      jest.setSystemTime(new Date('2025-01-01T12:00:00Z'));

      const newAlert = {
        alert_id: 'workflow-test',
        created_at: new Date('2025-01-01T12:00:00Z'),
        alert_data: { sla_hours: 72 },
        alert_status: 'NEW',
        confidence_per: 75,
        transaction: { amount: 2500 },
        txtp: 85,
      };

      mockPrismaService.alert.findMany.mockResolvedValue([newAlert]);
      mockPrismaService.alert.update.mockResolvedValue({});

      await service.runRecalculation();

      const updateCall = mockPrismaService.alert.update.mock.calls[0];
      const updatedData = updateCall[0].data.alert_data;

      expect(updatedData.urgency).toBe('New');
      expect(updatedData.priority_score).toBeDefined();
      expect(updatedData.sla_progress).toBe(0);
      expect(updatedData.last_priority_update).toBeDefined();
    });

    it('should handle alert progression through urgency levels', async () => {
      const alert = {
        alert_id: 'progression-test',
        created_at: new Date('2025-01-01T00:00:00Z'),
        alert_data: { sla_hours: 72 },
        alert_status: 'NEW',
        confidence_per: 75,
        transaction: { amount: 1000 },
        txtp: 80,
      };

      // Test at 20 hours (New)
      jest.setSystemTime(new Date('2025-01-01T20:00:00Z'));
      mockPrismaService.alert.findMany.mockResolvedValue([alert]);
      await service.runRecalculation();
      expect(mockPrismaService.alert.update.mock.calls[0][0].data.alert_data.urgency).toBe('New');

      // Test at 30 hours (Urgent)
      jest.setSystemTime(new Date('2025-01-02T06:00:00Z'));
      mockPrismaService.alert.update.mockClear();
      await service.runRecalculation();
      expect(mockPrismaService.alert.update.mock.calls[0][0].data.alert_data.urgency).toBe('Urgent');

      // Test at 60 hours (Critical)
      jest.setSystemTime(new Date('2025-01-03T12:00:00Z'));
      mockPrismaService.alert.update.mockClear();
      await service.runRecalculation();
      expect(mockPrismaService.alert.update.mock.calls[0][0].data.alert_data.urgency).toBe('Critical');

      // Test at 80 hours (Breach)
      jest.setSystemTime(new Date('2025-01-04T08:00:00Z'));
      mockPrismaService.alert.update.mockClear();
      await service.runRecalculation();
      expect(mockPrismaService.alert.update.mock.calls[0][0].data.alert_data.urgency).toBe('Breach');
    });
  });
});
