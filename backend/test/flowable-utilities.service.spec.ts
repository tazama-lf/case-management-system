import { Test, TestingModule } from '@nestjs/testing';
import { FlowableUtilitiesService } from '../src/modules/flowable/services/flowable-utilities.service';
import { FlowableClientFactory } from '../src/modules/flowable/services/flowable-client.factory';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AxiosInstance } from 'axios';

describe('FlowableUtilitiesService', () => {
  let service: FlowableUtilitiesService;
  let logger: jest.Mocked<LoggerService>;
  let clientFactory: jest.Mocked<FlowableClientFactory>;
  let flowableClient: jest.Mocked<AxiosInstance>;

  beforeEach(async () => {
    // Mock AxiosInstance
    flowableClient = {
      get: jest.fn(),
    } as any;

    // Mock dependencies
    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockClientFactory = {
      getClient: jest.fn().mockReturnValue(flowableClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlowableUtilitiesService,
        { provide: LoggerService, useValue: mockLogger },
        { provide: FlowableClientFactory, useValue: mockClientFactory },
      ],
    }).compile();

    service = module.get<FlowableUtilitiesService>(FlowableUtilitiesService);
    logger = module.get(LoggerService) as jest.Mocked<LoggerService>;
    clientFactory = module.get(FlowableClientFactory) as jest.Mocked<FlowableClientFactory>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTaskVariables', () => {
    const testCases = [
      {
        description: 'should return empty object when API call fails',
        taskId: 789,
        mockFn: (client: jest.Mocked<AxiosInstance>) => client.get.mockRejectedValue(new Error('Network error')),
        expected: {},
        expectError: true,
      },
      {
        description: 'should return empty object for non-array response',
        taskId: 456,
        mockFn: (client: jest.Mocked<AxiosInstance>) => client.get.mockResolvedValue({ data: { notAnArray: true } }),
        expected: {},
        expectError: false,
      },
      {
        description: 'should handle empty variables array',
        taskId: 999,
        mockFn: (client: jest.Mocked<AxiosInstance>) => client.get.mockResolvedValue({ data: [] }),
        expected: {},
        expectError: false,
      },
    ];

    test.each(testCases)('$description', async ({ taskId, mockFn, expected, expectError }) => {
      mockFn(flowableClient);

      const result = await service.getTaskVariables(taskId);

      expect(result).toEqual(expected);
      if (expectError) {
        expect(logger.error).toHaveBeenCalledWith(
          'Failed to get task variables: Network error',
          expect.any(String),
          'FlowableUtilitiesService',
        );
      }
    });

    it('should get all variables for a task', async () => {
      const taskId = 123;
      const mockResponse = {
        data: [
          { name: 'var1', value: 'value1' },
          { name: 'var2', value: 'value2' },
          { name: 'postgres_task_id', value: 'pg-123' },
        ],
      };

      flowableClient.get.mockResolvedValue(mockResponse);

      const result = await service.getTaskVariables(taskId);

      expect(result).toEqual({
        var1: 'value1',
        var2: 'value2',
        postgres_task_id: 'pg-123',
      });
      expect(flowableClient.get).toHaveBeenCalledWith(`/service/runtime/tasks/${taskId}/variables`);
    });

    it('should handle variables with complex values', async () => {
      const taskId = 555;
      const mockResponse = {
        data: [
          { name: 'string_var', value: 'test' },
          { name: 'number_var', value: 123 },
          { name: 'boolean_var', value: true },
          { name: 'object_var', value: { nested: 'value' } },
        ],
      };

      flowableClient.get.mockResolvedValue(mockResponse);

      const result = await service.getTaskVariables(taskId);

      expect(result).toEqual({
        string_var: 'test',
        number_var: 123,
        boolean_var: true,
        object_var: { nested: 'value' },
      });
    });
  });
});
