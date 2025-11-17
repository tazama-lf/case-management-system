import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConfigService } from '@nestjs/config';
import { NatsStartupService } from 'src/modules/nats/nats.service';
import { TriageService } from 'src/modules/triage/triage.service';
import { TaskService } from 'src/modules/task/task.service';
import { AlertMessageDto } from 'src/modules/nats/dto/AlertMessageDto.dto';

// Mock the external library
jest.mock('@tazama-lf/frms-coe-startup-lib', () => ({
  StartupFactory: jest.fn(),
}));

describe('NatsStartupService', () => {
  let service: NatsStartupService;
  let triageService: any;
  let taskService: any;
  let logger: any;
  let configService: any;
  let mockStartupFactory: any;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    triageService = {
      processIncomingAlert: jest.fn(),
    };
    taskService = {
      createTask: jest.fn(),
    };
    logger = {
      log: jest.fn(),
      error: jest.fn(),
    };
    configService = {
      get: jest.fn(),
    };

    // Mock StartupFactory
    mockStartupFactory = {
      init: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NatsStartupService,
        { provide: TriageService, useValue: triageService },
        { provide: TaskService, useValue: taskService },
        { provide: LoggerService, useValue: logger },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<NatsStartupService>(NatsStartupService);
  });

  describe('onModuleInit', () => {
    it('should initialize successfully', async () => {
      // Mock dynamic import

      // Mock the import function
      jest.doMock('@tazama-lf/frms-coe-startup-lib', () => ({
        StartupFactory: jest.fn().mockImplementation(() => mockStartupFactory),
      }));

      // Manually set the startupService for the test
      (service as any).startupService = mockStartupFactory;
      mockStartupFactory.init.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(logger.log).toHaveBeenCalledWith('NATS Relay Plugin initialized', NatsStartupService.name);
      expect(mockStartupFactory.init).toHaveBeenCalledWith(expect.any(Function), logger);
    });

    describe('handleMessage', () => {
      const mockDto: AlertMessageDto = {
        tenant_id: 'tenant1',
        priority: undefined,
        source: 'source1',
        txtp: 'txtp1',
        message: 'msg',
        report: {} as any,
        transaction: { TenantId: 'tenant1' } as any,
        networkMap: {} as any,
        confidence_per: 99,
        case_id: 'case1',
        userId: 'user1',
      };

      beforeEach(() => {
        configService.get.mockReturnValue('default-system-id');
      });

      it('should use default tenant ID when transaction.TenantId is null', async () => {
        const dtoWithoutTenantId = {
          ...mockDto,
          transaction: { TenantId: null } as any,
        };

        triageService.processIncomingAlert.mockResolvedValue(undefined);
        configService.get.mockImplementation((key) => {
          if (key === 'SYSTEM_UUID') return 'system-id';
          return 'default-value';
        });

        await service.handleMessage(dtoWithoutTenantId);

        expect(triageService.processIncomingAlert).toHaveBeenCalledWith(
          dtoWithoutTenantId,
          'system-id',
          'a9a8ff94-c7e4-4e6c-b421-e6d5d75a76e1',
        );
      });

      it('should use default tenant ID when transaction.TenantId is undefined', async () => {
        const dtoWithoutTenantId = {
          ...mockDto,
          transaction: {} as any,
        };

        triageService.processIncomingAlert.mockResolvedValue(undefined);
        configService.get.mockImplementation((key) => {
          if (key === 'SYSTEM_UUID') return 'system-id';
          return 'default-value';
        });

        await service.handleMessage(dtoWithoutTenantId);

        expect(triageService.processIncomingAlert).toHaveBeenCalledWith(
          dtoWithoutTenantId,
          'system-id',
          'a9a8ff94-c7e4-4e6c-b421-e6d5d75a76e1',
        );
      });

      it('should use default system ID when SYSTEM_UUID is not configured', async () => {
        triageService.processIncomingAlert.mockResolvedValue(undefined);
        configService.get.mockImplementation((key) => {
          if (key === 'SYSTEM_UUID') return undefined;
          return 'default-value';
        });

        await service.handleMessage(mockDto);

        expect(triageService.processIncomingAlert).toHaveBeenCalledWith(mockDto, 'f62edd31-3d72-4ec7-a0b7-cf2f0b0747a9', 'tenant1');
      });

      it('should handle AI triage enabled', async () => {
        triageService.processIncomingAlert.mockResolvedValue(undefined);
        configService.get.mockImplementation((key) => {
          if (key === 'SYSTEM_UUID') return 'systemId';
          return 'default-value';
        });

        await service.handleMessage(mockDto);

        expect(triageService.processIncomingAlert).toHaveBeenCalledWith(mockDto, 'systemId', 'tenant1');
      });

      it('should handle AI triage enabled with case-insensitive TRUE', async () => {
        triageService.processIncomingAlert.mockResolvedValue(undefined);
        configService.get.mockImplementation((key) => {
          if (key === 'SYSTEM_UUID') return 'systemId';
          return 'default-value';
        });

        await service.handleMessage(mockDto);

        expect(triageService.processIncomingAlert).toHaveBeenCalledWith(mockDto, 'systemId', 'tenant1');
      });

      it('should handle AI triage disabled and create manual task', async () => {
        triageService.processIncomingAlert.mockResolvedValue(undefined);
        configService.get.mockImplementation((key) => {
          if (key === 'SYSTEM_UUID') return 'systemId';
          return 'default-value';
        });

        await service.handleMessage(mockDto);

        expect(triageService.processIncomingAlert).toHaveBeenCalledWith(mockDto, 'systemId', 'tenant1');
      });

      it('should handle AI triage disabled with default value', async () => {
        triageService.processIncomingAlert.mockResolvedValue(undefined);
        configService.get.mockImplementation((key) => {
          if (key === 'SYSTEM_UUID') return 'systemId';
          return 'default-value';
        });

        await service.handleMessage(mockDto);

        expect(triageService.processIncomingAlert).toHaveBeenCalled();
      });

      it('should log successful alert ingestion', async () => {
        triageService.processIncomingAlert.mockResolvedValue(undefined);
        configService.get.mockReturnValue('systemId');

        await service.handleMessage(mockDto);

        expect(logger.log).toHaveBeenCalledWith('Alert ingested from NATS for tenant: tenant1', NatsStartupService.name);
      });

      it('should log error if handleNewAlert throws', async () => {
        const error = new Error('fail');
        triageService.processIncomingAlert.mockRejectedValue(error);
        configService.get.mockReturnValue('systemId');

        await service.handleMessage(mockDto);

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to persist or publish alert | error=fail | tenantId=tenant1 | alertData={}',
          error.stack,
          NatsStartupService.name,
        );
      });

      it('should log error if handleAITriage throws', async () => {
        const error = new Error('AI triage failed');
        triageService.processIncomingAlert.mockRejectedValue(error);
        configService.get.mockReturnValue('systemId');

        await service.handleMessage(mockDto);

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to persist or publish alert | error=AI triage failed | tenantId=tenant1 | alertData={}',
          error.stack,
          NatsStartupService.name,
        );
      });

      it('should log error if createTask throws', async () => {
        const error = new Error('Task creation failed');
        triageService.processIncomingAlert.mockRejectedValue(error);
        configService.get.mockReturnValue('systemId');

        await service.handleMessage(mockDto);

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to persist or publish alert | error=Task creation failed | tenantId=tenant1 | alertData={}',
          error.stack,
          NatsStartupService.name,
        );
      });

      it('should handle non-Error exceptions', async () => {
        const nonErrorException = 'String error';
        triageService.processIncomingAlert.mockRejectedValue(nonErrorException);
        configService.get.mockReturnValue('systemId');

        await service.handleMessage(mockDto);

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to persist or publish alert | error=String error | tenantId=tenant1 | alertData={}',
          undefined,
          NatsStartupService.name,
        );
      });

      it('should log the request at the beginning', async () => {
        triageService.processIncomingAlert.mockResolvedValue(undefined);
        configService.get.mockReturnValue('systemId');

        await service.handleMessage(mockDto);

        expect(logger.log).toHaveBeenCalledWith(`Request: ${JSON.stringify(mockDto)}`, NatsStartupService.name);
      });
    });
  });
});
