import { Test, TestingModule } from '@nestjs/testing';
import { AlertPriorityService } from '../src/modules/alert-priority/alert-priority.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Priority } from '@prisma/client-cms';

describe('AlertPriorityService', () => {
  let service: AlertPriorityService;
  let prismaService: jest.Mocked<PrismaService>;
  let configService: jest.Mocked<ConfigService>;

  const mockAlerts = [
    {
      alert_id: 1,
      tenant_id: 'tenant-123',
      priority: Priority.NEW,
      priority_score: 0.1,
      case_id: 1,
      created_at: new Date(Date.now() - 10 * 60 * 60 * 1000), // 10 hours ago
      updated_at: new Date(),
    },
    {
      alert_id: 2,
      tenant_id: 'tenant-123',
      priority: Priority.NEW,
      priority_score: 0.2,
      case_id: 2,
      created_at: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30 hours ago
      updated_at: new Date(),
    },
    {
      alert_id: 3,
      tenant_id: 'tenant-123',
      priority: Priority.NEW,
      priority_score: 0.3,
      case_id: 3,
      created_at: new Date(Date.now() - 50 * 60 * 60 * 1000), // 50 hours ago
      updated_at: new Date(),
    },
    {
      alert_id: 4,
      tenant_id: 'tenant-123',
      priority: Priority.NEW,
      priority_score: 0.4,
      case_id: null,
      created_at: new Date(Date.now() - 80 * 60 * 60 * 1000), // 80 hours ago
      updated_at: new Date(),
    },
  ];

  beforeEach(async () => {
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
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          PRIORITY_FIRST_HALF: '0.33',
          PRIORITY_SECOND_HALF: '0.66',
          PRIORITY_THIRD_HALF: '1.0',
          DEFAULT_SLA_HOURS: '72',
        };
        return config[key];
      }),
    };

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
      ],
    }).compile();

    service = module.get<AlertPriorityService>(AlertPriorityService);
    prismaService = module.get(PrismaService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should log initialization message', () => {
      const logSpy = jest.spyOn(service['logger'], 'log');
      service.onModuleInit();
      expect(logSpy).toHaveBeenCalledWith(
        'Alert priority service initialized. Recalculation will run via configurable scheduled task.',
      );
    });
  });

  describe('runRecalculation', () => {
    it('should log when no alerts are found', async () => {
      (prismaService.alert.findMany as jest.Mock).mockResolvedValue([]);
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.runRecalculation();

      expect(prismaService.alert.findMany).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith('Starting alert priority recalculation job...');
      expect(logSpy).toHaveBeenCalledWith('No alerts to process.');
      expect(prismaService.alert.update).not.toHaveBeenCalled();
    });

    it('should recalculate priority for NEW alerts (< 33% SLA)', async () => {
      const newAlert = {
        ...mockAlerts[0],
        created_at: new Date(Date.now() - 10 * 60 * 60 * 1000), // 10 hours ago (13.9% of 72 hours)
      };
      (prismaService.alert.findMany as jest.Mock).mockResolvedValue([newAlert] as any);
      (prismaService.alert.update as jest.Mock).mockResolvedValue(newAlert as any);
      (prismaService.case.update as jest.Mock).mockResolvedValue({} as any);

      await service.runRecalculation();

      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 1 },
        data: {
          priority: Priority.NEW,
          priority_score: expect.any(Number),
        },
      });
      expect(prismaService.case.update).toHaveBeenCalledWith({
        where: { case_id: 1 },
        data: {
          priority: Priority.NEW,
        },
      });
    });

    it('should recalculate priority for URGENT alerts (33-66% SLA)', async () => {
      const urgentAlert = {
        ...mockAlerts[1],
        created_at: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30 hours ago (41.7% of 72 hours)
      };
      (prismaService.alert.findMany as jest.Mock).mockResolvedValue([urgentAlert] as any);
      (prismaService.alert.update as jest.Mock).mockResolvedValue(urgentAlert as any);
      (prismaService.case.update as jest.Mock).mockResolvedValue({} as any);

      await service.runRecalculation();

      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 2 },
        data: {
          priority: Priority.URGENT,
          priority_score: expect.any(Number),
        },
      });
    });

    it('should recalculate priority for CRITICAL alerts (66-100% SLA)', async () => {
      const criticalAlert = {
        ...mockAlerts[2],
        created_at: new Date(Date.now() - 50 * 60 * 60 * 1000), // 50 hours ago (69.4% of 72 hours)
      };
      (prismaService.alert.findMany as jest.Mock).mockResolvedValue([criticalAlert] as any);
      (prismaService.alert.update as jest.Mock).mockResolvedValue(criticalAlert as any);
      (prismaService.case.update as jest.Mock).mockResolvedValue({} as any);

      await service.runRecalculation();

      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 3 },
        data: {
          priority: Priority.CRITICAL,
          priority_score: expect.any(Number),
        },
      });
    });

    it('should recalculate priority for BREACH alerts (>= 100% SLA)', async () => {
      const breachAlert = {
        ...mockAlerts[3],
        created_at: new Date(Date.now() - 80 * 60 * 60 * 1000), // 80 hours ago (111% of 72 hours)
      };
      (prismaService.alert.findMany as jest.Mock).mockResolvedValue([breachAlert] as any);
      (prismaService.alert.update as jest.Mock).mockResolvedValue(breachAlert as any);

      await service.runRecalculation();

      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 4 },
        data: {
          priority: Priority.BREACH,
          priority_score: expect.any(Number),
        },
      });
    });

    it('should not update case priority when alert has no case_id', async () => {
      const alertWithoutCase = {
        ...mockAlerts[3],
        case_id: null,
        created_at: new Date(Date.now() - 10 * 60 * 60 * 1000),
      };
      (prismaService.alert.findMany as jest.Mock).mockResolvedValue([alertWithoutCase] as any);
      (prismaService.alert.update as jest.Mock).mockResolvedValue(alertWithoutCase as any);

      await service.runRecalculation();

      expect(prismaService.alert.update).toHaveBeenCalled();
      expect(prismaService.case.update).not.toHaveBeenCalled();
    });

    it('should process multiple alerts in batch', async () => {
      const alerts = [
        { ...mockAlerts[0], created_at: new Date(Date.now() - 10 * 60 * 60 * 1000) },
        { ...mockAlerts[1], created_at: new Date(Date.now() - 50 * 60 * 60 * 1000) },
        { ...mockAlerts[2], created_at: new Date(Date.now() - 80 * 60 * 60 * 1000) },
      ];
      (prismaService.alert.findMany as jest.Mock).mockResolvedValue(alerts as any);
      (prismaService.alert.update as jest.Mock).mockResolvedValue({} as any);
      (prismaService.case.update as jest.Mock).mockResolvedValue({} as any);

      await service.runRecalculation();

      expect(prismaService.alert.update).toHaveBeenCalledTimes(3);
      expect(prismaService.case.update).toHaveBeenCalledTimes(3);
    });

    it('should handle errors for individual alerts and continue processing', async () => {
      const alerts = [mockAlerts[0], mockAlerts[1]];
      (prismaService.alert.findMany as jest.Mock).mockResolvedValue(alerts as any);
      (prismaService.alert.update as jest.Mock)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({} as any);
      (prismaService.case.update as jest.Mock).mockResolvedValue({} as any);
      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service.runRecalculation();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process alert 1'),
        expect.any(String),
      );
      expect(prismaService.alert.update).toHaveBeenCalledTimes(2);
    });

    it('should log completion message', async () => {
      (prismaService.alert.findMany as jest.Mock).mockResolvedValue(mockAlerts as any);
      (prismaService.alert.update as jest.Mock).mockResolvedValue({} as any);
      (prismaService.case.update as jest.Mock).mockResolvedValue({} as any);
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.runRecalculation();

      expect(logSpy).toHaveBeenCalledWith('Alert priority recalculation job complete.');
    });

    it('should use custom configuration values', async () => {
      (configService.get as any) = jest.fn((key: string) => {
        const customConfig: Record<string, string> = {
          PRIORITY_FIRST_HALF: '0.25',
          PRIORITY_SECOND_HALF: '0.5',
          PRIORITY_THIRD_HALF: '0.75',
          DEFAULT_SLA_HOURS: '48',
        };
        return customConfig[key];
      });

      // Recreate service with custom config
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AlertPriorityService,
          {
            provide: PrismaService,
            useValue: prismaService,
          },
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const customService = module.get<AlertPriorityService>(AlertPriorityService);
      const urgentAlert = {
        ...mockAlerts[0],
        created_at: new Date(Date.now() - 15 * 60 * 60 * 1000), // 15 hours ago (31.25% of 48 hours)
      };
      (prismaService.alert.findMany as jest.Mock).mockResolvedValue([urgentAlert] as any);
      (prismaService.alert.update as jest.Mock).mockResolvedValue(urgentAlert as any);
      (prismaService.case.update as jest.Mock).mockResolvedValue({} as any);

      await customService.runRecalculation();

      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: 1 },
        data: {
          priority: Priority.URGENT,
          priority_score: expect.any(Number),
        },
      });
    });

    it('should handle case update errors gracefully', async () => {
      const alert = mockAlerts[0];
      (prismaService.alert.findMany as jest.Mock).mockResolvedValue([alert] as any);
      (prismaService.alert.update as jest.Mock).mockResolvedValue(alert as any);
      (prismaService.case.update as jest.Mock).mockRejectedValue(new Error('Case update failed'));
      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service.runRecalculation();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process alert 1'),
        expect.any(String),
      );
    });

    it('should calculate priority score correctly', async () => {
      const alert = {
        ...mockAlerts[0],
        created_at: new Date(Date.now() - 36 * 60 * 60 * 1000), // 36 hours ago (50% of 72 hours)
      };
      (prismaService.alert.findMany as jest.Mock).mockResolvedValue([alert] as any);
      (prismaService.alert.update as jest.Mock).mockResolvedValue(alert as any);
      (prismaService.case.update as jest.Mock).mockResolvedValue({} as any);

      await service.runRecalculation();

      const updateCall = (prismaService.alert.update as jest.Mock).mock.calls[0][0];
      const priorityScore = updateCall.data.priority_score;
      expect(priorityScore).toBeGreaterThan(0.4);
      expect(priorityScore).toBeLessThan(0.6);
    });

    it('should debug log priority calculations', async () => {
      (prismaService.alert.findMany as jest.Mock).mockResolvedValue([mockAlerts[0]] as any);
      (prismaService.alert.update as jest.Mock).mockResolvedValue(mockAlerts[0] as any);
      (prismaService.case.update as jest.Mock).mockResolvedValue({} as any);
      const debugSpy = jest.spyOn(service['logger'], 'debug');

      await service.runRecalculation();

      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Alert 1: priority_score='));
    });
  });
});
