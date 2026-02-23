import { Test, TestingModule } from '@nestjs/testing';
import { NatsStartupService } from '../src/modules/nats/nats.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConfigService } from '@nestjs/config';
import { ProcessAlertService } from '../src/modules/process-alert/process-alert.service';
import { IngestAlertDto } from '../src/modules/alert/dto/IngestAlert.dto';

// Mock the external library
jest.mock('@tazama-lf/frms-coe-startup-lib', () => ({
  StartupFactory: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('NatsStartupService', () => {
  let service: NatsStartupService;
  let loggerService: any;
  let configService: any;
  let processAlertService: any;
  let mockStartupFactory: any;

  const mockIngestAlertDto: IngestAlertDto = {
    message: 'Alert message text',
    report: {
      status: 'ALRT',
    } as any,
    transaction: {
      TxTp: 'pacs.002.001.12',
      TxID: 'tx-123',
      TenantId: 'tenant-001',
    } as any,
    networkMap: {
      active: true,
      cfg: '1.0',
      tenantId: 'tenant-001',
      messages: [],
    } as any,
  };

  beforeEach(async () => {
    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockProcessAlertService = {
      processIncomingAlert: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NatsStartupService,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ProcessAlertService,
          useValue: mockProcessAlertService,
        },
      ],
    }).compile();

    service = module.get<NatsStartupService>(NatsStartupService);
    loggerService = module.get(LoggerService);
    configService = module.get(ConfigService);
    processAlertService = module.get(ProcessAlertService);

    // Get the mock StartupFactory
    const { StartupFactory } = await import('@tazama-lf/frms-coe-startup-lib');
    mockStartupFactory = StartupFactory;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize NATS Relay Plugin successfully', async () => {
      await service.onModuleInit();

      expect(loggerService.log).toHaveBeenCalledWith('NATS Relay Plugin initialized', 'NatsStartupService');
      expect(mockStartupFactory).toHaveBeenCalled();
    });

    it('should call startupService.init with correct parameters', async () => {
      await service.onModuleInit();

      const startupInstance = mockStartupFactory.mock.results[0].value;
      expect(startupInstance.init).toHaveBeenCalledWith(expect.any(Function), loggerService);
    });

    it('should bind handleMessage correctly', async () => {
      await service.onModuleInit();

      const startupInstance = mockStartupFactory.mock.results[0].value;
      const boundHandler = startupInstance.init.mock.calls[0][0];

      expect(typeof boundHandler).toBe('function');
    });

    it('should handle initialization error and log it', async () => {
      const error = new Error('NATS connection failed');
      mockStartupFactory.mockImplementationOnce(() => {
        throw error;
      });

      await expect(service.onModuleInit()).rejects.toThrow('NATS connection failed');

      expect(loggerService.error).toHaveBeenCalledWith(
        'Failed to initialize NATS Relay Plugin : NATS connection failed',
        'NatsStartupService',
      );
    });

    it('should handle initialization error when init fails', async () => {
      const error = new Error('Init failed');
      mockStartupFactory.mockImplementationOnce(() => ({
        init: jest.fn().mockRejectedValue(error),
      }));

      await expect(service.onModuleInit()).rejects.toThrow('Init failed');

      expect(loggerService.error).toHaveBeenCalledWith(
        'Failed to initialize NATS Relay Plugin : Init failed',
        'NatsStartupService',
      );
    });

    it('should handle non-Error exceptions during initialization', async () => {
      mockStartupFactory.mockImplementationOnce(() => {
        throw 'String error';
      });

      // The code re-throws all errors after logging
      await expect(service.onModuleInit()).rejects.toEqual('String error');

      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should create StartupFactory instance', async () => {
      await service.onModuleInit();

      expect(mockStartupFactory).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple initialization attempts', async () => {
      await service.onModuleInit();
      await service.onModuleInit();

      expect(mockStartupFactory).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleMessage', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue('test-system-uuid');
      await service.onModuleInit();
    });

    it('should process incoming alert with tenant ID from transaction', async () => {
      await service.handleMessage(mockIngestAlertDto);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(
        mockIngestAlertDto,
        'NATS',
        'test-system-uuid',
        'tenant-001',
      );
      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('Request:'),
        'NatsStartupService',
      );
      expect(loggerService.log).toHaveBeenCalledWith(
        'Alert ingested from NATS for tenant: tenant-001',
        'NatsStartupService',
      );
    });

    it('should use DEFAULT tenant when TenantId is not provided', async () => {
      const dtoWithoutTenant = {
        ...mockIngestAlertDto,
        transaction: {
          ...mockIngestAlertDto.transaction,
          TenantId: undefined,
        } as any,
      };

      await service.handleMessage(dtoWithoutTenant);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(
        dtoWithoutTenant,
        'NATS',
        'test-system-uuid',
        'DEFAULT',
      );
    });

    it('should use DEFAULT tenant when TenantId is null', async () => {
      const dtoWithNullTenant = {
        ...mockIngestAlertDto,
        transaction: {
          ...mockIngestAlertDto.transaction,
          TenantId: null,
        } as any,
      };

      await service.handleMessage(dtoWithNullTenant);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(
        dtoWithNullTenant,
        'NATS',
        'test-system-uuid',
        'DEFAULT',
      );
    });

    it('should use system UUID from config', async () => {
      configService.get.mockReturnValue('custom-system-uuid');

      await service.handleMessage(mockIngestAlertDto);

      expect(configService.get).toHaveBeenCalledWith('SYSTEM_UUID');
      expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(
        mockIngestAlertDto,
        'NATS',
        'custom-system-uuid',
        'tenant-001',
      );
    });

    it('should use default UUID when config returns null', async () => {
      configService.get.mockReturnValue(null);

      await service.handleMessage(mockIngestAlertDto);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(
        mockIngestAlertDto,
        'NATS',
        'f62edd31-3d72-4ec7-a0b7-cf2f0b0747a9',
        'tenant-001',
      );
    });

    it('should use default UUID when config returns undefined', async () => {
      configService.get.mockReturnValue(undefined);

      await service.handleMessage(mockIngestAlertDto);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(
        mockIngestAlertDto,
        'NATS',
        'f62edd31-3d72-4ec7-a0b7-cf2f0b0747a9',
        'tenant-001',
      );
    });

    it('should use default UUID when config returns empty string', async () => {
      configService.get.mockReturnValue('');

      await service.handleMessage(mockIngestAlertDto);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(
        mockIngestAlertDto,
        'NATS',
        'f62edd31-3d72-4ec7-a0b7-cf2f0b0747a9',
        'tenant-001',
      );
    });

    it('should log the incoming request', async () => {
      await service.handleMessage(mockIngestAlertDto);

      expect(loggerService.log).toHaveBeenCalledWith(
        `Request: ${JSON.stringify(mockIngestAlertDto)}`,
        'NatsStartupService',
      );
    });

    it('should log success message after processing', async () => {
      await service.handleMessage(mockIngestAlertDto);

      expect(loggerService.log).toHaveBeenCalledWith(
        'Alert ingested from NATS for tenant: tenant-001',
        'NatsStartupService',
      );
    });

    it('should handle errors from processAlertService', async () => {
      const error = new Error('Processing failed');
      processAlertService.processIncomingAlert.mockRejectedValue(error);

      await service.handleMessage(mockIngestAlertDto);

      expect(loggerService.error).toHaveBeenCalledWith(
        `Failed to persist or publish alert | error=Processing failed | tenantId=tenant-001 | alertData=${JSON.stringify(mockIngestAlertDto.report)}`,
        error.stack,
        'NatsStartupService',
      );
    });

    it('should handle non-Error exceptions from processAlertService', async () => {
      processAlertService.processIncomingAlert.mockRejectedValue('String error');

      await service.handleMessage(mockIngestAlertDto);

      expect(loggerService.error).toHaveBeenCalledWith(
        `Failed to persist or publish alert | error=String error | tenantId=tenant-001 | alertData=${JSON.stringify(mockIngestAlertDto.report)}`,
        undefined,
        'NatsStartupService',
      );
    });

    it('should include tenant ID in error log', async () => {
      const error = new Error('Test error');
      processAlertService.processIncomingAlert.mockRejectedValue(error);

      await service.handleMessage(mockIngestAlertDto);

      expect(loggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('tenantId=tenant-001'),
        expect.any(String),
        'NatsStartupService',
      );
    });

    it('should include alert data in error log', async () => {
      const error = new Error('Test error');
      processAlertService.processIncomingAlert.mockRejectedValue(error);

      await service.handleMessage(mockIngestAlertDto);

      expect(loggerService.error).toHaveBeenCalledWith(
        expect.stringContaining(`alertData=${JSON.stringify(mockIngestAlertDto.report)}`),
        expect.any(String),
        'NatsStartupService',
      );
    });

    it('should not throw error when processing fails', async () => {
      const error = new Error('Processing failed');
      processAlertService.processIncomingAlert.mockRejectedValue(error);

      await expect(service.handleMessage(mockIngestAlertDto)).resolves.not.toThrow();
    });

    it('should handle different tenant IDs', async () => {
      const tenantIds = ['tenant-001', 'tenant-002', 'tenant-999', 'prod-tenant'];

      for (const tenantId of tenantIds) {
        const dto = {
          ...mockIngestAlertDto,
          transaction: {
            ...mockIngestAlertDto.transaction,
            TenantId: tenantId,
          } as any,
        };

        await service.handleMessage(dto);

        expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(
          dto,
          'NATS',
          expect.any(String),
          tenantId,
        );
      }
    });

    it('should always pass "NATS" as source', async () => {
      await service.handleMessage(mockIngestAlertDto);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(
        mockIngestAlertDto,
        'NATS',
        expect.any(String),
        expect.any(String),
      );
    });

    it('should handle complex alert data in request', async () => {
      const complexDto = {
        ...mockIngestAlertDto,
        report: {
          ...mockIngestAlertDto.report,
          additionalData: {
            nested: { value: 'test' },
            array: [1, 2, 3],
          },
        } as any,
      };

      await service.handleMessage(complexDto);

      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('"additionalData"'),
        'NatsStartupService',
      );
    });

    it('should handle missing transaction object gracefully', async () => {
      const dtoWithoutTransaction = {
        ...mockIngestAlertDto,
        transaction: {} as any,
      };

      await service.handleMessage(dtoWithoutTransaction);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(
        dtoWithoutTransaction,
        'NATS',
        expect.any(String),
        'DEFAULT',
      );
    });

    it('should handle null report in error logging', async () => {
      const error = new Error('Test error');
      processAlertService.processIncomingAlert.mockRejectedValue(error);
      const dtoWithNullReport = {
        ...mockIngestAlertDto,
        report: null as any,
      };

      await service.handleMessage(dtoWithNullReport);

      expect(loggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('alertData=null'),
        expect.any(String),
        'NatsStartupService',
      );
    });

    it('should log both request and success messages in correct order', async () => {
      // Reset the mock to clear initialization logs
      loggerService.log.mockClear();

      await service.handleMessage(mockIngestAlertDto);

      const logCalls = loggerService.log.mock.calls;
      expect(logCalls[0][0]).toContain('Request:');
      expect(logCalls[1][0]).toContain('Alert ingested from NATS');
    });
  });

  describe('Integration scenarios', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue('test-system-uuid');
      await service.onModuleInit();
    });

    it('should handle multiple messages sequentially', async () => {
      const dto1 = { ...mockIngestAlertDto, transaction: { ...mockIngestAlertDto.transaction, TenantId: 'tenant-1' } as any };
      const dto2 = { ...mockIngestAlertDto, transaction: { ...mockIngestAlertDto.transaction, TenantId: 'tenant-2' } as any };

      await service.handleMessage(dto1);
      await service.handleMessage(dto2);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledTimes(2);
      expect(loggerService.log).toHaveBeenCalledWith('Alert ingested from NATS for tenant: tenant-1', 'NatsStartupService');
      expect(loggerService.log).toHaveBeenCalledWith('Alert ingested from NATS for tenant: tenant-2', 'NatsStartupService');
    });

    it('should continue processing after one message fails', async () => {
      processAlertService.processIncomingAlert
        .mockRejectedValueOnce(new Error('First failed'))
        .mockResolvedValueOnce({});

      await service.handleMessage(mockIngestAlertDto);
      await service.handleMessage(mockIngestAlertDto);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledTimes(2);
      expect(loggerService.error).toHaveBeenCalledTimes(1);
      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('Alert ingested from NATS'),
        'NatsStartupService',
      );
    });

    it('should maintain correct state across multiple handleMessage calls', async () => {
      await service.handleMessage(mockIngestAlertDto);
      await service.handleMessage(mockIngestAlertDto);
      await service.handleMessage(mockIngestAlertDto);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledTimes(3);
    });

    it('should use consistent systemId across multiple calls', async () => {
      configService.get.mockReturnValue('consistent-uuid');

      await service.handleMessage(mockIngestAlertDto);
      await service.handleMessage(mockIngestAlertDto);

      const calls = processAlertService.processIncomingAlert.mock.calls;
      expect(calls[0][2]).toBe('consistent-uuid');
      expect(calls[1][2]).toBe('consistent-uuid');
    });
  });

  describe('Edge cases', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue('test-system-uuid');
      await service.onModuleInit();
    });

    it('should handle empty string tenant ID', async () => {
      const dto = {
        ...mockIngestAlertDto,
        transaction: {
          ...mockIngestAlertDto.transaction,
          TenantId: '',
        } as any,
      };

      await service.handleMessage(dto);

      // Empty string is truthy, so ?? operator doesn't trigger DEFAULT
      expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(
        dto,
        'NATS',
        'test-system-uuid',
        '',
      );
    });

    it('should handle very long tenant IDs', async () => {
      const longTenantId = 'a'.repeat(1000);
      const dto = {
        ...mockIngestAlertDto,
        transaction: {
          ...mockIngestAlertDto.transaction,
          TenantId: longTenantId,
        } as any,
      };

      await service.handleMessage(dto);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(
        dto,
        'NATS',
        'test-system-uuid',
        longTenantId,
      );
    });

    it('should handle special characters in tenant ID', async () => {
      const specialTenantId = 'tenant-123!@#$%^&*()';
      const dto = {
        ...mockIngestAlertDto,
        transaction: {
          ...mockIngestAlertDto.transaction,
          TenantId: specialTenantId,
        } as any,
      };

      await service.handleMessage(dto);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(
        dto,
        'NATS',
        'test-system-uuid',
        specialTenantId,
      );
    });

    it('should handle very large request objects', async () => {
      const largeDto = {
        ...mockIngestAlertDto,
        report: {
          ...mockIngestAlertDto.report,
          largeData: 'x'.repeat(10000),
        } as any,
      };

      await service.handleMessage(largeDto);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(
        largeDto,
        'NATS',
        expect.any(String),
        expect.any(String),
      );
    });
  });
});
