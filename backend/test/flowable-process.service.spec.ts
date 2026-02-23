import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
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
    });

    it('should throw error on failure', async () => {
      mockFlowableClient.post.mockRejectedValue(new Error('Start failed'));

      await expect(
        service.startProcessInstance('caseManagementProcess', {}, 123),
      ).rejects.toThrow('Start failed');
    });

    it('should handle undefined variable values', async () => {
      const variables = { caseId: '123', undefinedVar: undefined as any };

      await expect(
        service.startProcessInstance('caseManagementProcess', variables, 123),
      ).rejects.toThrow('Variable "undefinedVar" has undefined value');
    });
  });

  describe('getProcessInstance', () => {
    it('should get process instance by ID successfully', async () => {
      const mockProcess = { id: 'process-123', name: 'Case Process' };
      mockFlowableClient.get.mockResolvedValue({ data: mockProcess });

      const result = await service.getProcessInstance('process-123');

      expect(mockFlowableClient.get).toHaveBeenCalled();
      expect(result).toEqual(mockProcess);
    });

    it('should throw error on failure', async () => {
      mockFlowableClient.get.mockRejectedValue(new Error('Not found'));

      await expect(service.getProcessInstance('invalid-id')).rejects.toThrow('Not found');
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

    it('should return null when no process found', async () => {
      mockFlowableClient.get.mockResolvedValue({ data: { data: [] } });

      const result = await service.getProcessInstanceByBusinessKey(999);

      expect(result).toBeNull();
    });

    it('should return null when data field is missing', async () => {
      mockFlowableClient.get.mockResolvedValue({ data: {} });

      const result = await service.getProcessInstanceByBusinessKey(123);

      expect(result).toBeNull();
    });

    it('should throw error on failure', async () => {
      mockFlowableClient.get.mockRejectedValue(new Error('Query failed'));

      await expect(service.getProcessInstanceByBusinessKey(123)).rejects.toThrow('Query failed');
    });
  });

  describe('updateProcessVariable', () => {
    it('should update process variable successfully', async () => {
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
        expect.stringContaining("Updated 'status'"),
        'FlowableProcessService',
      );
    });

    it('should handle boolean value type', async () => {
      mockFlowableClient.put.mockResolvedValue({ data: {} });

      await service.updateProcessVariable('process-123', 'isActive', true);

      expect(mockFlowableClient.put).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'isActive',
          value: 'true',
          type: 'boolean',
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

  describe('setProcessVariables', () => {
    it('should set multiple process variables successfully', async () => {
      const variables = { status: 'active', priority: 'high' };
      const mockResponse = { success: true };
      mockFlowableClient.put.mockResolvedValue({ data: mockResponse });

      const result = await service.setProcessVariables('process-123', variables);

      expect(mockFlowableClient.put).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({ name: 'status', value: 'active', type: 'string' }),
          expect.objectContaining({ name: 'priority', value: 'high', type: 'string' }),
        ]),
      );
      expect(result).toEqual(mockResponse);
      expect(loggerService.log).toHaveBeenCalled();
    });

    it('should throw HttpException on failure', async () => {
      mockFlowableClient.put.mockRejectedValue(new Error('Network error'));

      await expect(
        service.setProcessVariables('process-123', { status: 'active' }),
      ).rejects.toThrow(HttpException);
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('terminateProcessInstance', () => {
    it('should terminate process instance with reason', async () => {
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
      expect(loggerService.log).toHaveBeenCalled();
    });

    it('should terminate with default reason when not provided', async () => {
      mockFlowableClient.delete.mockResolvedValue({ data: {} });

      await service.terminateProcessInstance('process-123');

      expect(mockFlowableClient.delete).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            action: 'delete',
            deleteReason: 'Process terminated by system',
          },
        }),
      );
    });

    it('should throw error on failure', async () => {
      mockFlowableClient.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(service.terminateProcessInstance('process-123')).rejects.toThrow('Delete failed');
    });
  });

  describe('suspendProcessInstance', () => {
    it('should suspend process instance successfully', async () => {
      const mockResponse = { suspended: true };
      mockFlowableClient.put.mockResolvedValue({ data: mockResponse });

      const result = await service.suspendProcessInstance('process-123');

      expect(mockFlowableClient.put).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'suspend' }),
      );
      expect(result).toEqual(mockResponse);
      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('suspended'),
        'FlowableProcessService',
      );
    });

    it('should throw error on failure', async () => {
      mockFlowableClient.put.mockRejectedValue(new Error('Suspend failed'));

      await expect(service.suspendProcessInstance('process-123')).rejects.toThrow('Suspend failed');
    });
  });

  describe('activateProcessInstance', () => {
    it('should activate process instance successfully', async () => {
      const mockResponse = { active: true };
      mockFlowableClient.put.mockResolvedValue({ data: mockResponse });

      const result = await service.activateProcessInstance('process-123');

      expect(mockFlowableClient.put).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'activate' }),
      );
      expect(result).toEqual(mockResponse);
      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('activated'),
        'FlowableProcessService',
      );
    });

    it('should throw error on failure', async () => {
      mockFlowableClient.put.mockRejectedValue(new Error('Activate failed'));

      await expect(service.activateProcessInstance('process-123')).rejects.toThrow('Activate failed');
    });
  });

  describe('getProcessDefinitions', () => {
    it('should get all process definitions', async () => {
      const definitions = [
        { id: 'def-1', key: 'process1' },
        { id: 'def-2', key: 'process2' },
      ];
      mockFlowableClient.get.mockResolvedValue({ data: { data: definitions } });

      const result = await service.getProcessDefinitions();

      expect(mockFlowableClient.get).toHaveBeenCalled();
      expect(result).toEqual(definitions);
    });

    it('should filter by process definition key', async () => {
      const definitions = [{ id: 'def-1', key: 'caseManagementProcess' }];
      mockFlowableClient.get.mockResolvedValue({ data: { data: definitions } });

      const result = await service.getProcessDefinitions('caseManagementProcess');

      expect(mockFlowableClient.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({ key: 'caseManagementProcess' }),
        }),
      );
      expect(result).toEqual(definitions);
    });

    it('should include tenantId in params', async () => {
      mockFlowableClient.get.mockResolvedValue({ data: { data: [] } });

      await service.getProcessDefinitions('processKey', 'tenant1');

      expect(mockFlowableClient.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            key: 'processKey',
            tenantId: 'tenant1',
          }),
        }),
      );
    });

    it('should return empty array when data field is missing', async () => {
      mockFlowableClient.get.mockResolvedValue({ data: {} });

      const result = await service.getProcessDefinitions();

      expect(result).toEqual([]);
    });

    it('should throw error on failure', async () => {
      mockFlowableClient.get.mockRejectedValue(new Error('Query failed'));

      await expect(service.getProcessDefinitions()).rejects.toThrow('Query failed');
    });
  });

  describe('listProcessDefinitions', () => {
    it('should return comma-separated list of process keys', async () => {
      const definitions = [
        { id: 'def-1', key: 'process1' },
        { id: 'def-2', key: 'process2' },
        { id: 'def-3', key: 'process3' },
      ];
      mockFlowableClient.get.mockResolvedValue({ data: { data: definitions } });

      const result = await service.listProcessDefinitions();

      expect(result).toBe('process1, process2, process3');
    });

    it('should return error message on failure', async () => {
      mockFlowableClient.get.mockRejectedValue(new Error('Query failed'));

      const result = await service.listProcessDefinitions();

      expect(result).toBe('Unable to list process definitions');
    });

    it('should handle empty definitions list', async () => {
      mockFlowableClient.get.mockResolvedValue({ data: { data: [] } });

      const result = await service.listProcessDefinitions();

      expect(result).toBe('');
    });
  });

  describe('formatVariables', () => {
    it('should format variables correctly', async () => {
      const variables = { key1: 'value1', key2: 'value2' };
      mockFlowableClient.post.mockResolvedValue({ data: { id: 'process-123' } });

      await service.startProcessInstance('processKey', variables, 123);

      expect(mockFlowableClient.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          variables: [
            { name: 'key1', value: 'value1', type: 'string' },
            { name: 'key2', value: 'value2', type: 'string' },
          ],
        }),
      );
    });

    it('should convert values to strings', async () => {
      const variables = { count: '5' as any, active: 'true' as any };
      mockFlowableClient.post.mockResolvedValue({ data: { id: 'process-123' } });

      await service.startProcessInstance('processKey', variables, 123);

      expect(mockFlowableClient.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          variables: expect.arrayContaining([
            { name: 'count', value: '5', type: 'string' },
            { name: 'active', value: 'true', type: 'string' },
          ]),
        }),
      );
    });
  });
});
