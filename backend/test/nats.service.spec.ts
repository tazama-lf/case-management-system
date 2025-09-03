import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConfigService } from '@nestjs/config';
import { NatsStartupService } from 'src/nats/nats.service';
import { TriageService } from 'src/triage/triage.service';
import { TaskService } from 'src/task/task.service';
import { AlertMessageDto } from 'src/nats/dto/AlertMessageDto.dto';
import { TaskStatus } from '@prisma/client';

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
      handleNewAlert: jest.fn(), 
      handleAITriage: jest.fn() 
    };
    taskService = { 
      createTask: jest.fn() 
    };
    logger = { 
      log: jest.fn(), 
      error: jest.fn() 
    };
    configService = { 
      get: jest.fn() 
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

      expect(logger.log).toHaveBeenCalledWith(
        'NATS Relay Plugin initialized',
        NatsStartupService.name
      );
      expect(mockStartupFactory.init).toHaveBeenCalledWith(
        expect.any(Function),
        logger
      );
    });

  describe('handleMessage', () => {
    const mockAlert = { alert_id: 'alert1', case_id: 'case1' };
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

      triageService.handleNewAlert.mockResolvedValue(mockAlert);
      configService.get.mockImplementation((key) => {
        if (key === 'AI_TRIAGE_ENABLED') return 'true';
        if (key === 'SYSTEM_UUID') return 'system-id';
        return 'default-value';
      });

      await service.handleMessage(dtoWithoutTenantId);

      expect(triageService.handleNewAlert).toHaveBeenCalledWith(
        expect.anything(),
        'system-id',
        'a9a8ff94-c7e4-4e6c-b421-e6d5d75a76e1', // Default tenant ID
        'NATS'
      );
    });

    it('should use default tenant ID when transaction.TenantId is undefined', async () => {
      const dtoWithoutTenantId = {
        ...mockDto,
        transaction: {} as any,
      };

      triageService.handleNewAlert.mockResolvedValue(mockAlert);
      configService.get.mockImplementation((key) => {
        if (key === 'AI_TRIAGE_ENABLED') return 'true';
        if (key === 'SYSTEM_UUID') return 'system-id';
        return 'default-value';
      });

      await service.handleMessage(dtoWithoutTenantId);

      expect(triageService.handleNewAlert).toHaveBeenCalledWith(
        expect.anything(),
        'system-id',
        'a9a8ff94-c7e4-4e6c-b421-e6d5d75a76e1', // Default tenant ID
        'NATS'
      );
    });

    it('should use default system ID when SYSTEM_UUID is not configured', async () => {
      triageService.handleNewAlert.mockResolvedValue(mockAlert);
      configService.get.mockImplementation((key) => {
        if (key === 'AI_TRIAGE_ENABLED') return 'true';
        if (key === 'SYSTEM_UUID') return undefined;
        return 'default-value';
      });

      await service.handleMessage(mockDto);

      expect(triageService.handleNewAlert).toHaveBeenCalledWith(
        expect.anything(),
        'f62edd31-3d72-4ec7-a0b7-cf2f0b0747a9', // Default system ID
        'tenant1',
        'NATS'
      );
    });

    it('should handle AI triage enabled', async () => {
      triageService.handleNewAlert.mockResolvedValue(mockAlert);
      configService.get.mockImplementation((key) => {
        if (key === 'AI_TRIAGE_ENABLED') return 'true';
        if (key === 'SYSTEM_UUID') return 'systemId';
        return 'default-value';
      });

      await service.handleMessage(mockDto);

      expect(triageService.handleAITriage).toHaveBeenCalledWith(
        'alert1', 
        'case1', 
        expect.objectContaining({
          message: 'msg',
          report: {},
          transaction: { TenantId: 'tenant1' },
          networkMap: {},
        }), 
        'systemId', 
        'tenant1'
      );
      expect(logger.log).toHaveBeenCalledWith(
        'AI Triage enabled doing ai triage on: alert1', 
        NatsStartupService.name
      );
    });

    it('should handle AI triage enabled with case-insensitive TRUE', async () => {
      triageService.handleNewAlert.mockResolvedValue(mockAlert);
      configService.get.mockImplementation((key) => {
        if (key === 'AI_TRIAGE_ENABLED') return 'TRUE';
        if (key === 'SYSTEM_UUID') return 'systemId';
        return 'default-value';
      });

      await service.handleMessage(mockDto);

      expect(triageService.handleAITriage).toHaveBeenCalledWith(
        'alert1', 
        'case1', 
        expect.anything(), 
        'systemId', 
        'tenant1'
      );
    });

    it('should handle AI triage disabled and create manual task', async () => {
      triageService.handleNewAlert.mockResolvedValue(mockAlert);
      configService.get.mockImplementation((key) => {
        if (key === 'AI_TRIAGE_ENABLED') return 'false';
        if (key === 'SYSTEM_UUID') return 'systemId';
        return 'default-value';
      });

      await service.handleMessage(mockDto);

      expect(taskService.createTask).toHaveBeenCalledWith(
        {
          caseId: 'case1',
          assignedUserId: 'systemId',
          status: TaskStatus.ASSIGNED_10,
          name: 'Investigate case',
          description: 'Task to investigate: case1',
        },
        'systemId'
      );
      expect(logger.log).toHaveBeenCalledWith(
        'AI Triage disabled creating manual investiation task for alert: alert1', 
        NatsStartupService.name
      );
    });

    it('should handle AI triage disabled with default value', async () => {
      triageService.handleNewAlert.mockResolvedValue(mockAlert);
      configService.get.mockImplementation((key, defaultValue) => {
        if (key === 'AI_TRIAGE_ENABLED') return defaultValue; // Will return 'false' (the default)
        if (key === 'SYSTEM_UUID') return 'systemId';
        return 'default-value';
      });

      await service.handleMessage(mockDto);

      expect(taskService.createTask).toHaveBeenCalled();
      expect(triageService.handleAITriage).not.toHaveBeenCalled();
    });

    it('should log successful alert ingestion', async () => {
      triageService.handleNewAlert.mockResolvedValue(mockAlert);
      configService.get.mockImplementation((key) => {
        if (key === 'AI_TRIAGE_ENABLED') return 'false';
        if (key === 'SYSTEM_UUID') return 'systemId';
        return 'default-value';
      });

      await service.handleMessage(mockDto);

      expect(logger.log).toHaveBeenCalledWith(
        'Alert ingested from NATS for tenant: tenant1',
        NatsStartupService.name
      );
    });

    it('should log error if handleNewAlert throws', async () => {
      const error = new Error('fail');
      triageService.handleNewAlert.mockRejectedValue(error);
      configService.get.mockReturnValue('systemId');

      await service.handleMessage(mockDto);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to persist or publish alert | error=fail | tenantId=tenant1 | alertData={}',
        error.stack,
        NatsStartupService.name
      );
    });

    it('should log error if handleAITriage throws', async () => {
      const error = new Error('AI triage failed');
      triageService.handleNewAlert.mockResolvedValue(mockAlert);
      triageService.handleAITriage.mockRejectedValue(error);
      configService.get.mockImplementation((key) => {
        if (key === 'AI_TRIAGE_ENABLED') return 'true';
        if (key === 'SYSTEM_UUID') return 'systemId';
        return 'default-value';
      });

      await service.handleMessage(mockDto);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to persist or publish alert | error=AI triage failed | tenantId=tenant1 | alertData={}',
        error.stack,
        NatsStartupService.name
      );
    });

    it('should log error if createTask throws', async () => {
      const error = new Error('Task creation failed');
      triageService.handleNewAlert.mockResolvedValue(mockAlert);
      taskService.createTask.mockRejectedValue(error);
      configService.get.mockImplementation((key) => {
        if (key === 'AI_TRIAGE_ENABLED') return 'false';
        if (key === 'SYSTEM_UUID') return 'systemId';
        return 'default-value';
      });

      await service.handleMessage(mockDto);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to persist or publish alert | error=Task creation failed | tenantId=tenant1 | alertData={}',
        error.stack,
        NatsStartupService.name
      );
    });

    it('should handle non-Error exceptions', async () => {
      const nonErrorException = 'String error';
      triageService.handleNewAlert.mockRejectedValue(nonErrorException);
      configService.get.mockReturnValue('systemId');

      await service.handleMessage(mockDto);

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to persist or publish alert | error=String error | tenantId=tenant1 | alertData={}',
        undefined,
        NatsStartupService.name
      );
    });

    it('should log the request at the beginning', async () => {
      triageService.handleNewAlert.mockResolvedValue(mockAlert);
      configService.get.mockReturnValue('systemId');

      await service.handleMessage(mockDto);

      expect(logger.log).toHaveBeenCalledWith(
        `Request: ${JSON.stringify(mockDto)}`,
        NatsStartupService.name
      );
    });
  });
});
});