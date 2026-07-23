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
  let loggerService: jest.Mocked<LoggerService>;
  let configService: jest.Mocked<ConfigService>;
  let processAlertService: jest.Mocked<ProcessAlertService>;
  let mockStartupFactory: jest.Mock;

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NatsStartupService,
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: ProcessAlertService,
          useValue: {
            processIncomingAlert: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<NatsStartupService>(NatsStartupService);
    loggerService = module.get(LoggerService) as jest.Mocked<LoggerService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
    processAlertService = module.get(ProcessAlertService) as jest.Mocked<ProcessAlertService>;

    const { StartupFactory } = await import('@tazama-lf/frms-coe-startup-lib');
    mockStartupFactory = StartupFactory as jest.Mock;

    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize NATS Relay Plugin successfully', async () => {
      await service.onModuleInit();

      expect(loggerService.log).toHaveBeenCalledWith('NATS Relay Plugin initialized', 'NatsStartupService');
      expect(mockStartupFactory).toHaveBeenCalled();

      const startupInstance = mockStartupFactory.mock.results[0].value;
      expect(startupInstance.init).toHaveBeenCalledWith(expect.any(Function), loggerService);
    });

    it.each([
      ['Error object', new Error('NATS connection failed'), 'NATS connection failed'],
      ['String error', 'String error', 'String error'],
    ])('should handle initialization error: %s', async (_desc, error, expectedMessage) => {
      mockStartupFactory.mockImplementationOnce(() => {
        throw error;
      });

      await expect(service.onModuleInit()).rejects.toEqual(error);

      expect(loggerService.error).toHaveBeenCalledWith(`Failed to initialize NATS Relay Plugin : ${expectedMessage}`, 'NatsStartupService');
    });

    it('should handle initialization error when init fails', async () => {
      const error = new Error('Init failed');
      mockStartupFactory.mockImplementationOnce(() => ({
        init: jest.fn().mockRejectedValue(error),
      }));

      await expect(service.onModuleInit()).rejects.toThrow('Init failed');

      expect(loggerService.error).toHaveBeenCalledWith('Failed to initialize NATS Relay Plugin : Init failed', 'NatsStartupService');
    });
  });

  describe('handleMessage', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue('test-system-uuid');
      await service.onModuleInit();
      jest.clearAllMocks();
    });

    it('should process incoming alert with tenant ID from transaction', async () => {
      await service.handleMessage(mockIngestAlertDto);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(mockIngestAlertDto, 'NATS', 'test-system-uuid', 'tenant-001');
      expect(loggerService.log).toHaveBeenCalledWith(`Request: ${JSON.stringify(mockIngestAlertDto)}`, 'NatsStartupService');
      expect(loggerService.log).toHaveBeenCalledWith('Alert ingested from NATS for tenant: tenant-001', 'NatsStartupService');
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty string', ''],
    ])('should use DEFAULT tenant when TenantId is %s', async (_description, tenantIdValue) => {
      const dtoWithoutTenant = {
        ...mockIngestAlertDto,
        transaction: {
          ...mockIngestAlertDto.transaction,
          TenantId: tenantIdValue,
        } as any,
      };

      await service.handleMessage(dtoWithoutTenant);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(dtoWithoutTenant, 'NATS', 'test-system-uuid', 'DEFAULT');
    });

    it.each([
      ['custom UUID', 'custom-system-uuid', 'custom-system-uuid'],
      ['null', null, 'f62edd31-3d72-4ec7-a0b7-cf2f0b0747a9'],
      ['undefined', undefined, 'f62edd31-3d72-4ec7-a0b7-cf2f0b0747a9'],
    ])('should use system UUID: %s', async (_desc, configValue, expectedUuid) => {
      configService.get.mockReturnValue(configValue);

      await service.handleMessage(mockIngestAlertDto);

      expect(configService.get).toHaveBeenCalledWith('SYSTEM_UUID');
      expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(mockIngestAlertDto, 'NATS', expectedUuid, 'tenant-001');
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

        expect(processAlertService.processIncomingAlert).toHaveBeenCalledWith(dto, 'NATS', 'test-system-uuid', tenantId);
      }
    });

    it.each([
      ['Error object', new Error('Processing failed'), 'Processing failed', expect.any(String)],
      ['String error', 'String error', 'String error', undefined],
    ])('should handle %s from processAlertService', async (_desc, error, errorMessage, stack) => {
      processAlertService.processIncomingAlert.mockRejectedValue(error);

      await service.handleMessage(mockIngestAlertDto);

      expect(loggerService.error).toHaveBeenCalledWith(
        `Failed to persist or publish alert | error=${errorMessage} | tenantId=tenant-001 | alertData=${JSON.stringify(mockIngestAlertDto.report)}`,
        stack,
        'NatsStartupService',
      );
    });

    it('should not throw error when processing fails', async () => {
      processAlertService.processIncomingAlert.mockRejectedValue(new Error('Processing failed'));

      await expect(service.handleMessage(mockIngestAlertDto)).resolves.not.toThrow();
    });

    it('should handle null report in error logging', async () => {
      const error = new Error('Test error');
      processAlertService.processIncomingAlert.mockRejectedValue(error);
      const dtoWithNullReport = {
        ...mockIngestAlertDto,
        report: null as any,
      };

      await service.handleMessage(dtoWithNullReport);

      expect(loggerService.error).toHaveBeenCalledWith(expect.stringContaining('alertData=null'), expect.any(String), 'NatsStartupService');
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
      processAlertService.processIncomingAlert.mockRejectedValueOnce(new Error('First failed')).mockResolvedValueOnce(undefined);

      await service.handleMessage(mockIngestAlertDto);
      await service.handleMessage(mockIngestAlertDto);

      expect(processAlertService.processIncomingAlert).toHaveBeenCalledTimes(2);
      expect(loggerService.error).toHaveBeenCalledTimes(1);
      expect(loggerService.log).toHaveBeenCalledWith('Alert ingested from NATS for tenant: tenant-001', 'NatsStartupService');
    });
  });
});
