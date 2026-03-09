import { Test, TestingModule } from '@nestjs/testing';
import { FlowableProcessService } from '../src/modules/flowable/services/flowable-process.service';
import { FlowableClientFactory } from '../src/modules/flowable/services/flowable-client.factory';
import { LoggerService } from '@tazama-lf/frms-coe-lib';

describe('FlowableProcessService', () => {
  let service: FlowableProcessService;
  let loggerService: jest.Mocked<LoggerService>;

  const mockFlowableClient = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };

  const mockClientFactory = {
    getClient: jest.fn().mockReturnValue(mockFlowableClient),
    getBaseUrl: jest.fn().mockReturnValue('http://flowable:80'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlowableProcessService,
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: FlowableClientFactory,
          useValue: mockClientFactory,
        },
      ],
    }).compile();

    service = module.get<FlowableProcessService>(FlowableProcessService);
    loggerService = module.get(LoggerService);

    jest.clearAllMocks();
  });

  describe('startProcessInstance', () => {
    it('should start a process instance successfully', async () => {
      const variables = { caseId: '123', tenantId: 'tenant1' };
      const mockResponse = { id: 'process-123', processDefinitionKey: 'caseManagementProcess' };
      mockFlowableClient.post.mockResolvedValue({ data: mockResponse });

      const result = await service.startProcessInstance('caseManagementProcess', variables, 123, 'tenant1');

      expect(mockFlowableClient.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          processDefinitionKey: 'caseManagementProcess',
          businessKey: 123,
          variables: expect.arrayContaining([
            expect.objectContaining({ name: 'caseId', value: '123', type: 'string' }),
            expect.objectContaining({ name: 'tenantId', value: 'tenant1', type: 'string' }),
          ]),
        }),
      );
      expect(result).toEqual(mockResponse);
      expect(loggerService.log).toHaveBeenCalledTimes(2);
      expect(loggerService.log).toHaveBeenCalledWith(
        'Start - Start Process Instance With BusinessKey: 123',
        'FlowableProcessService'
      );
      expect(loggerService.log).toHaveBeenCalledWith(
        'End - Start Process Instance With BusinessKey: 123',
        'FlowableProcessService'
      );
    });

    it('should start a process instance without tenantId', async () => {
      const variables = { caseId: '456' };
      const mockResponse = { id: 'process-456' };
      mockFlowableClient.post.mockResolvedValue({ data: mockResponse });

      const result = await service.startProcessInstance('caseManagementProcess', variables, 456);

      expect(mockFlowableClient.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          processDefinitionKey: 'caseManagementProcess',
          businessKey: 456,
          variables: expect.arrayContaining([
            expect.objectContaining({ name: 'caseId', value: '456', type: 'string' }),
          ]),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should start a process instance with empty variables', async () => {
      const mockResponse = { id: 'process-789' };
      mockFlowableClient.post.mockResolvedValue({ data: mockResponse });

      const result = await service.startProcessInstance('caseManagementProcess', {}, 789);

      expect(mockFlowableClient.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          processDefinitionKey: 'caseManagementProcess',
          businessKey: 789,
          variables: [],
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failure', async () => {
      mockFlowableClient.post.mockRejectedValue(new Error('Start failed'));

      await expect(
        service.startProcessInstance('caseManagementProcess', {}, 123),
      ).rejects.toThrow('Start failed');
    });

    it('should handle undefined variable values', async () => {
      const variables = { caseId: '123', undefinedVar: undefined as any };

      // The formatVariables will still create entries, but with undefined values
      // This is actually handled by the service - it will throw when trying to format
      await expect(
        service.startProcessInstance('caseManagementProcess', variables, 123),
      ).rejects.toThrow();
    });
  });

  describe('getProcessInstanceByBusinessKey', () => {
    it('should get process instance by business key successfully', async () => {
      const mockProcess = { id: 'process-123', businessKey: 123 };
      mockFlowableClient.get.mockResolvedValue({ data: { data: [mockProcess] } });

      const result = await service.getProcessInstanceByBusinessKey(123);

      expect(mockFlowableClient.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: { businessKey: 123 },
        }),
      );
      expect(result).toEqual(mockProcess);
    });

    it.each([
      ['empty array', { data: [] }],
      ['missing data field', {}],
      ['null data', { data: null }],
    ])('should return null when response has %s', async (_desc, responseData) => {
      mockFlowableClient.get.mockResolvedValue({ data: responseData });

      const result = await service.getProcessInstanceByBusinessKey(999);

      expect(result).toBeNull();
    });

    it('should throw error on failure', async () => {
      mockFlowableClient.get.mockRejectedValue(new Error('Query failed'));

      await expect(service.getProcessInstanceByBusinessKey(123)).rejects.toThrow('Query failed');
    });
  });

  describe('updateProcessVariable', () => {
    it('should update process variable with string value', async () => {
      mockFlowableClient.put.mockResolvedValue({ data: {} });

      await service.updateProcessVariable('process-123', 'status', 'active');

      expect(mockFlowableClient.put).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'status',
          value: 'active',
          type: 'string',
        }),
      );
      expect(loggerService.log).toHaveBeenCalledWith(
        "Updated 'status' for process process-123",
        'FlowableProcessService',
      );
    });

    it.each([
      ['boolean true', true, 'true', 'boolean'],
      ['boolean false', false, 'false', 'boolean'],
      ['number', 42, '42', 'string'],
      ['string number', '123', '123', 'string'],
    ])('should handle %s value type', async (_desc, inputValue, expectedValue, expectedType) => {
      mockFlowableClient.put.mockResolvedValue({ data: {} });

      await service.updateProcessVariable('process-123', 'testVar', inputValue);

      expect(mockFlowableClient.put).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'testVar',
          value: expectedValue,
          type: expectedType,
        }),
      );
    });

    it('should throw error on failure', async () => {
      mockFlowableClient.put.mockRejectedValue(new Error('Update failed'));

      await expect(
        service.updateProcessVariable('process-123', 'status', 'active'),
      ).rejects.toThrow('Update failed');
    });
  });

  describe('terminateProcessInstance', () => {
    it('should terminate process instance with custom reason', async () => {
      const mockResponse = { deleted: true };
      mockFlowableClient.delete.mockResolvedValue({ data: mockResponse });

      const result = await service.terminateProcessInstance('process-123', 'Case closed');

      expect(mockFlowableClient.delete).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            action: 'delete',
            deleteReason: 'Case closed',
          },
        }),
      );
      expect(result).toEqual(mockResponse);
      expect(loggerService.log).toHaveBeenCalledWith(
        'Process instance terminated: process-123',
        'FlowableProcessService'
      );
    });

    it('should terminate with default reason when not provided', async () => {
      const mockResponse = { deleted: true };
      mockFlowableClient.delete.mockResolvedValue({ data: mockResponse });

      const result = await service.terminateProcessInstance('process-123');

      expect(mockFlowableClient.delete).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            action: 'delete',
            deleteReason: 'Process terminated by system',
          },
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failure', async () => {
      mockFlowableClient.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(service.terminateProcessInstance('process-123')).rejects.toThrow('Delete failed');
    });
  });

  describe('formatVariables', () => {
    it('should format variables correctly in startProcessInstance', async () => {
      const variables = { key1: 'value1', key2: 'value2', key3: 'value3' };
      mockFlowableClient.post.mockResolvedValue({ data: { id: 'process-123' } });

      await service.startProcessInstance('processKey', variables, 123);

      expect(mockFlowableClient.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          variables: expect.arrayContaining([
            { name: 'key1', value: 'value1', type: 'string' },
            { name: 'key2', value: 'value2', type: 'string' },
            { name: 'key3', value: 'value3', type: 'string' },
          ]),
        }),
      );
    });

    it('should format empty variables object', async () => {
      mockFlowableClient.post.mockResolvedValue({ data: { id: 'process-123' } });

      await service.startProcessInstance('processKey', {}, 123);

      expect(mockFlowableClient.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          variables: [],
        }),
      );
    });
  });
});
