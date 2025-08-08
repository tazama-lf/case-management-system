/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/unbound-method */
import 'reflect-metadata';

// Set required environment variables before any imports
process.env.STARTUP_TYPE = 'nats';

import { Test, TestingModule } from '@nestjs/testing';
import { NatsStartupService } from '../src/nats/nats.startup';
import { TriageService } from '../src/triage/triage.service';
import { Priority, AlertStatus } from '@prisma/client';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AlertMessageDto } from 'src/nats/dto/AlertMessageDto.dto';
import { Logger } from '@nestjs/common';

// Mock the startup factory
jest.mock('@tazama-lf/frms-coe-startup-lib', () => ({
  StartupFactory: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
    handleMessage: jest.fn(),
  })),
}));

// Mock only the validate function from class-validator
jest.mock('class-validator', () => ({
  ...jest.requireActual('class-validator'),
  validate: jest.fn(),
}));

// Mock only the plainToInstance function from class-transformer
jest.mock('class-transformer', () => ({
  ...jest.requireActual('class-transformer'),
  plainToInstance: jest.fn(),
}));

describe('NatsStartupService', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(jest.fn());
    jest.spyOn(Logger.prototype, 'error').mockImplementation(jest.fn());
  });
  let service: NatsStartupService;
  let triageService: TriageService;
  let mockValidate: jest.MockedFunction<typeof validate>;
  let mockPlainToInstance: jest.MockedFunction<typeof plainToInstance>;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NatsStartupService,
        {
          provide: TriageService,
          useValue: {
            handleNewAlert: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NatsStartupService>(NatsStartupService);
    triageService = module.get<TriageService>(TriageService);

    // Get the mocked functions
    mockValidate = jest.requireMock('class-validator')
      .validate as jest.MockedFunction<typeof validate>;
    mockPlainToInstance = jest.requireMock('class-transformer')
      .plainToInstance as jest.MockedFunction<typeof plainToInstance>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize the startup factory and server', async () => {
      const mockInit = jest.fn();
      const { StartupFactory } = jest.requireMock(
        '@tazama-lf/frms-coe-startup-lib',
      );
      StartupFactory.mockImplementation(() => ({ init: mockInit }));

      await service.onModuleInit();

      expect(mockInit).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object),
      );
    });
  });

  describe('handleMessage', () => {
    const validAlertPayload = {
      tenant_id: 'test-tenant',
      priority: Priority.HIGH,
      source: 'test-source',
      txtp: 'test-txtp',
      message: 'Test alert message',
      alert_data: { test: 'data' },
      transaction: {
        tenantId: 'test-tenant',
        TxTp: 'test-txtp',
        test: 'transaction',
      },
      network_map: { test: 'network' },
      alert_status: AlertStatus.NEW,
      confidence_per: 85,
      case_id: 'test-case-123',
    };

    const validAlertDto = new AlertMessageDto();
    Object.assign(validAlertDto, validAlertPayload);

    beforeEach(() => {
      mockPlainToInstance.mockReturnValue(validAlertDto);
    });

    it('should successfully process a valid alert message', async () => {
      mockValidate.mockResolvedValue([]);

      await service.handleMessage(validAlertPayload);

      expect(mockPlainToInstance).toHaveBeenCalledWith(
        AlertMessageDto,
        validAlertPayload,
      );
      expect(mockValidate).toHaveBeenCalledWith(validAlertDto);
      expect(triageService.handleNewAlert).toHaveBeenCalledWith(
        {
          result: {
            message: validAlertPayload.message,
            report: validAlertPayload.alert_data,
            transaction: validAlertPayload.transaction,
            networkMap: validAlertPayload.network_map,
            source: validAlertPayload.source,
            txtp: 'test-txtp',
          },
        },
        'nats',
        'test-tenant',
      );
    });

    it('should handle validation errors', async () => {
      const validationError = {
        property: 'message',
        constraints: { isNotEmpty: 'message should not be empty' },
      };
      mockValidate.mockResolvedValue([validationError] as any);

      await service.handleMessage(validAlertPayload);

      expect(triageService.handleNewAlert).not.toHaveBeenCalled();
      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('should handle missing tenantId', async () => {
      mockValidate.mockResolvedValue([]);
      const invalidPayload = {
        ...validAlertPayload,
        transaction: { TxTp: 'test-txtp' }, // Missing tenantId
      };
      mockPlainToInstance.mockReturnValue({
        ...validAlertDto,
        transaction: { TxTp: 'test-txtp' },
      } as any);

      await service.handleMessage(invalidPayload);

      expect(triageService.handleNewAlert).not.toHaveBeenCalled();
      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('should handle missing TxTp', async () => {
      mockValidate.mockResolvedValue([]);
      const invalidPayload = {
        ...validAlertPayload,
        transaction: { tenantId: 'test-tenant' }, // Missing TxTp
      };
      mockPlainToInstance.mockReturnValue({
        ...validAlertDto,
        transaction: { tenantId: 'test-tenant' },
      } as any);

      await service.handleMessage(invalidPayload);

      expect(triageService.handleNewAlert).not.toHaveBeenCalled();
      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('should handle invalid tenantId type', async () => {
      mockValidate.mockResolvedValue([]);
      const invalidPayload = {
        ...validAlertPayload,
        transaction: { tenantId: 123, TxTp: 'test-txtp' }, // Invalid type
      };
      mockPlainToInstance.mockReturnValue({
        ...validAlertDto,
        transaction: { tenantId: 123, TxTp: 'test-txtp' },
      } as any);

      await service.handleMessage(invalidPayload);

      expect(triageService.handleNewAlert).not.toHaveBeenCalled();
      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('should handle invalid TxTp type', async () => {
      mockValidate.mockResolvedValue([]);
      const invalidPayload = {
        ...validAlertPayload,
        transaction: { tenantId: 'test-tenant', TxTp: 123 }, // Invalid type
      };
      mockPlainToInstance.mockReturnValue({
        ...validAlertDto,
        transaction: { tenantId: 'test-tenant', TxTp: 123 },
      } as any);

      await service.handleMessage(invalidPayload);

      expect(triageService.handleNewAlert).not.toHaveBeenCalled();
      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('should handle triage service errors', async () => {
      mockValidate.mockResolvedValue([]);
      const error = new Error('Triage service failed');
      (triageService.handleNewAlert as jest.Mock).mockRejectedValue(error);

      await service.handleMessage(validAlertPayload);

      expect(triageService.handleNewAlert).toHaveBeenCalled();
      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions from triage service', async () => {
      mockValidate.mockResolvedValue([]);
      const error = 'String error';
      (triageService.handleNewAlert as jest.Mock).mockRejectedValue(error);

      await service.handleMessage(validAlertPayload);

      expect(triageService.handleNewAlert).toHaveBeenCalled();
      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('should handle alert with missing source field', async () => {
      mockValidate.mockResolvedValue([]);
      const payloadWithoutSource = { ...validAlertPayload };

      delete (payloadWithoutSource as any).source;

      const alertDtoWithoutSource = { ...validAlertDto };

      delete (alertDtoWithoutSource as any).source;
      mockPlainToInstance.mockReturnValue(alertDtoWithoutSource as any);

      await service.handleMessage(payloadWithoutSource);

      expect(triageService.handleNewAlert).toHaveBeenCalledWith(
        {
          result: {
            message: validAlertPayload.message,
            report: validAlertPayload.alert_data,
            transaction: validAlertPayload.transaction,
            networkMap: validAlertPayload.network_map,
            source: '', // Should default to empty string
            txtp: 'test-txtp',
          },
        },
        'nats',
        'test-tenant',
      );
    });
  });
});
