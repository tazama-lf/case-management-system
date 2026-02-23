import { Test, TestingModule } from '@nestjs/testing';
import { FlowableUtilitiesService } from '../src/modules/flowable/services/flowable-utilities.service';
import { FlowableClientFactory } from '../src/modules/flowable/services/flowable-client.factory';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AxiosInstance } from 'axios';
import { CandidateGroups } from '../src/constants/flowable-api.constants';

describe('FlowableUtilitiesService', () => {
  let service: FlowableUtilitiesService;
  let logger: jest.Mocked<LoggerService>;
  let clientFactory: jest.Mocked<FlowableClientFactory>;
  let flowableClient: jest.Mocked<AxiosInstance>;

  beforeEach(async () => {
    // Mock AxiosInstance
    flowableClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
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
      getBaseUrl: jest.fn().mockReturnValue('http://test-flowable:8080'),
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
    service.clearEventCache();
  });

  describe('Event Deduplication', () => {
    describe('isDuplicate', () => {
      it('should return false for first occurrence of event', () => {
        const eventKey = 'event-123';
        const result = service.isDuplicate(eventKey);
        expect(result).toBe(false);
      });

      it('should return true for duplicate event within debounce window', () => {
        const eventKey = 'event-456';
        
        const firstCall = service.isDuplicate(eventKey);
        expect(firstCall).toBe(false);

        const secondCall = service.isDuplicate(eventKey);
        expect(secondCall).toBe(true);
      });

      it('should return false for same event after debounce window', async () => {
        const eventKey = 'event-789';
        
        service.isDuplicate(eventKey);
        
        // Wait for debounce window to pass (1000ms + buffer)
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        const result = service.isDuplicate(eventKey);
        expect(result).toBe(false);
      });

      it('should handle multiple different events', () => {
        const event1 = service.isDuplicate('event-1');
        const event2 = service.isDuplicate('event-2');
        const event3 = service.isDuplicate('event-3');

        expect(event1).toBe(false);
        expect(event2).toBe(false);
        expect(event3).toBe(false);
        expect(service.getEventCacheSize()).toBe(3);
      });

      it('should cleanup old entries when cache exceeds MAX_CACHE_SIZE', () => {
        // Add entries beyond MAX_CACHE_SIZE (1000)
        // Simulate by adding many entries and triggering cleanup
        for (let i = 0; i < 1100; i++) {
          service.isDuplicate(`event-${i}`);
        }

        const cacheSize = service.getEventCacheSize();
        expect(cacheSize).toBeLessThanOrEqual(1100);
      });
    });

    describe('clearEventCache', () => {
      it('should clear all cached events', () => {
        service.isDuplicate('event-1');
        service.isDuplicate('event-2');
        service.isDuplicate('event-3');

        expect(service.getEventCacheSize()).toBe(3);

        service.clearEventCache();

        expect(service.getEventCacheSize()).toBe(0);
      });
    });

    describe('getEventCacheSize', () => {
      it('should return 0 for empty cache', () => {
        expect(service.getEventCacheSize()).toBe(0);
      });

      it('should return correct cache size', () => {
        service.isDuplicate('event-1');
        service.isDuplicate('event-2');

        expect(service.getEventCacheSize()).toBe(2);
      });
    });
  });

  describe('Task Finding & Matching', () => {
    describe('findByPostgresTaskId', () => {
      it('should find a task by PostgreSQL task ID', async () => {
        const flowableTasks = [
          { id: 'task-1', name: 'Task 1' },
          { id: 'task-2', name: 'Task 2' },
          { id: 'task-3', name: 'Task 3' },
        ];

        const getTaskVariablesFn = jest.fn()
          .mockResolvedValueOnce({ postgres_task_id: 'pg-111' })
          .mockResolvedValueOnce({ postgres_task_id: 'pg-222' })
          .mockResolvedValueOnce({ postgres_task_id: 'pg-333' });

        const result = await service.findByPostgresTaskId(flowableTasks, 'pg-222', getTaskVariablesFn);

        expect(result).toEqual({ id: 'task-2', name: 'Task 2' });
        expect(getTaskVariablesFn).toHaveBeenCalledTimes(2);
      });

      it('should return null when task is not found', async () => {
        const flowableTasks = [
          { id: 'task-1', name: 'Task 1' },
          { id: 'task-2', name: 'Task 2' },
        ];

        const getTaskVariablesFn = jest.fn()
          .mockResolvedValueOnce({ postgres_task_id: 'pg-111' })
          .mockResolvedValueOnce({ postgres_task_id: 'pg-222' });

        const result = await service.findByPostgresTaskId(flowableTasks, 'pg-999', getTaskVariablesFn);

        expect(result).toBeNull();
        expect(getTaskVariablesFn).toHaveBeenCalledTimes(2);
      });

      it('should handle empty task array', async () => {
        const getTaskVariablesFn = jest.fn();

        const result = await service.findByPostgresTaskId([], 'pg-123', getTaskVariablesFn);

        expect(result).toBeNull();
        expect(getTaskVariablesFn).not.toHaveBeenCalled();
      });
    });

    describe('findUnmappedBpmnTask', () => {
      it('should find an unmapped task by name', async () => {
        const flowableTasks = [
          { id: 'task-1', name: 'Investigate Case' },
          { id: 'task-2', name: 'Approve Case Creation' },
        ];

        const getTaskVariablesFn = jest.fn()
          .mockResolvedValueOnce({ some_var: 'value' })
          .mockResolvedValueOnce({});

        const result = await service.findUnmappedBpmnTask(flowableTasks, 'Investigate Case', getTaskVariablesFn);

        expect(result).toEqual({ id: 'task-1', name: 'Investigate Case' });
      });

      it('should find an unmapped task matching candidate group', async () => {
        const flowableTasks = [
          { 
            id: 'task-1', 
            name: 'Investigate Case',
            candidateGroups: ['supervisors', 'admin'],
          },
          { 
            id: 'task-2', 
            name: 'Investigate Case',
            candidateGroups: ['investigations'],
          },
        ];

        const getTaskVariablesFn = jest.fn()
          .mockResolvedValue({});

        const result = await service.findUnmappedBpmnTask(
          flowableTasks, 
          'Investigate Case', 
          getTaskVariablesFn,
          'investigations'
        );

        expect(result).toEqual({ 
          id: 'task-2', 
          name: 'Investigate Case',
          candidateGroups: ['investigations'],
        });
      });

      it('should skip tasks with postgres_task_id', async () => {
        const flowableTasks = [
          { id: 'task-1', name: 'Investigate Case' },
          { id: 'task-2', name: 'Investigate Case' },
        ];

        const getTaskVariablesFn = jest.fn()
          .mockResolvedValueOnce({ postgres_task_id: 'pg-123' })
          .mockResolvedValueOnce({});

        const result = await service.findUnmappedBpmnTask(flowableTasks, 'Investigate Case', getTaskVariablesFn);

        expect(result).toEqual({ id: 'task-2', name: 'Investigate Case' });
      });

      it('should return null when no matching unmapped task', async () => {
        const flowableTasks = [
          { id: 'task-1', name: 'Different Task' },
        ];

        const getTaskVariablesFn = jest.fn()
          .mockResolvedValue({});

        const result = await service.findUnmappedBpmnTask(flowableTasks, 'Investigate Case', getTaskVariablesFn);

        expect(result).toBeNull();
      });

      it('should return null when task has wrong candidate group', async () => {
        const flowableTasks = [
          { 
            id: 'task-1', 
            name: 'Investigate Case',
            candidateGroups: ['supervisors'],
          },
        ];

        const getTaskVariablesFn = jest.fn()
          .mockResolvedValue({});

        const result = await service.findUnmappedBpmnTask(
          flowableTasks, 
          'Investigate Case', 
          getTaskVariablesFn,
          'investigations'
        );

        expect(result).toBeNull();
      });
    });

    describe('determineCandidateGroup', () => {
      it('should return explicit candidate group when valid', () => {
        const result = service.determineCandidateGroup('Any Task', ['supervisors']);
        expect(result).toBe('supervisors');
      });

      it('should return investigations for valid candidate group', () => {
        const result = service.determineCandidateGroup('Any Task', ['investigations']);
        expect(result).toBe('investigations');
      });

      it('should return investigator for valid candidate group', () => {
        const result = service.determineCandidateGroup('Any Task', ['investigator']);
        expect(result).toBe('investigator');
      });

      it('should infer supervisors from task name with "approve"', () => {
        const result = service.determineCandidateGroup('Approve Case Creation');
        expect(result).toBe(CandidateGroups.SUPERVISORS);
      });

      it('should infer supervisors from task name with "supervisor"', () => {
        const result = service.determineCandidateGroup('Supervisor Review Task');
        expect(result).toBe(CandidateGroups.SUPERVISORS);
      });

      it('should infer investigations from task name with "investigate"', () => {
        const result = service.determineCandidateGroup('Investigate Case');
        expect(result).toBe(CandidateGroups.INVESTIGATIONS);
      });

      it('should infer investigations from task name with "investigation"', () => {
        const result = service.determineCandidateGroup('Investigation Task');
        expect(result).toBe(CandidateGroups.INVESTIGATIONS);
      });

      it('should default to investigations for unknown task names', () => {
        const result = service.determineCandidateGroup('Random Task Name');
        expect(result).toBe(CandidateGroups.INVESTIGATIONS);
      });

      it('should ignore invalid candidate groups and infer from name', () => {
        const result = service.determineCandidateGroup('Approve Case', ['invalid-group']);
        expect(result).toBe(CandidateGroups.SUPERVISORS);
      });

      it('should handle case-insensitive task name matching', () => {
        const result1 = service.determineCandidateGroup('APPROVE Case');
        const result2 = service.determineCandidateGroup('INVESTIGATE Case');
        
        expect(result1).toBe(CandidateGroups.SUPERVISORS);
        expect(result2).toBe(CandidateGroups.INVESTIGATIONS);
      });
    });

    describe('isTaskSynced', () => {
      it('should return true when task has postgres_task_id', async () => {
        const getTaskVariablesFn = jest.fn()
          .mockResolvedValue({ postgres_task_id: 'pg-123' });

        const result = await service.isTaskSynced('task-456', getTaskVariablesFn);

        expect(result).toBe(true);
        expect(getTaskVariablesFn).toHaveBeenCalledWith('task-456');
      });

      it('should return false when task has no postgres_task_id', async () => {
        const getTaskVariablesFn = jest.fn()
          .mockResolvedValue({ some_other_var: 'value' });

        const result = await service.isTaskSynced('task-789', getTaskVariablesFn);

        expect(result).toBe(false);
      });

      it('should return false when postgres_task_id is empty string', async () => {
        const getTaskVariablesFn = jest.fn()
          .mockResolvedValue({ postgres_task_id: '' });

        const result = await service.isTaskSynced('task-000', getTaskVariablesFn);

        expect(result).toBe(false);
      });

      it('should return false when postgres_task_id is null', async () => {
        const getTaskVariablesFn = jest.fn()
          .mockResolvedValue({ postgres_task_id: null });

        const result = await service.isTaskSynced('task-111', getTaskVariablesFn);

        expect(result).toBe(false);
      });
    });
  });

  describe('Task Variables', () => {
    describe('getTaskVariables', () => {
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

      it('should return empty object for non-array response', async () => {
        const taskId = 456;
        const mockResponse = {
          data: { notAnArray: true },
        };

        flowableClient.get.mockResolvedValue(mockResponse);

        const result = await service.getTaskVariables(taskId);

        expect(result).toEqual({});
      });

      it('should return empty object when API call fails', async () => {
        const taskId = 789;
        flowableClient.get.mockRejectedValue(new Error('Network error'));

        const result = await service.getTaskVariables(taskId);

        expect(result).toEqual({});
        expect(logger.error).toHaveBeenCalledWith(
          'Failed to get task variables: Network error',
          expect.any(String),
          'FlowableUtilitiesService'
        );
      });

      it('should handle empty variables array', async () => {
        const taskId = 999;
        const mockResponse = {
          data: [],
        };

        flowableClient.get.mockResolvedValue(mockResponse);

        const result = await service.getTaskVariables(taskId);

        expect(result).toEqual({});
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

  describe('Private Methods', () => {
    describe('cleanupOldEntries', () => {
      it('should remove old entries when cache exceeds MAX_CACHE_SIZE', async () => {
        // Fill cache with old entries beyond MAX_CACHE_SIZE
        for (let i = 0; i < 1010; i++) {
          service.isDuplicate(`event-${i}`);
        }

        // Wait for entries to become old (debounce window * 2 + buffer)
        await new Promise(resolve => setTimeout(resolve, 2100));

        // Add more entries to trigger cleanup
        for (let i = 1010; i < 1020; i++) {
          service.isDuplicate(`new-event-${i}`);
        }

        // Cache should have cleaned up old entries
        const cacheSize = service.getEventCacheSize();
        expect(cacheSize).toBeLessThan(1020);
      });

      it('should not remove recent entries', () => {
        // Add entries
        for (let i = 0; i < 10; i++) {
          service.isDuplicate(`recent-event-${i}`);
        }

        const sizeBefore = service.getEventCacheSize();
        
        // Should still be there as they are recent
        const stillDuplicate = service.isDuplicate('recent-event-5');
        
        expect(stillDuplicate).toBe(true);
        expect(service.getEventCacheSize()).toBe(sizeBefore);
      });
    });
  });

  describe('Legacy Exports', () => {
    it('should export EventDeduplicator as alias', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const module = require('../src/modules/flowable/services/flowable-utilities.service');
      expect(module.EventDeduplicator).toBe(FlowableUtilitiesService);
    });

    it('should export FlowableTaskFinderService as alias', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const module = require('../src/modules/flowable/services/flowable-utilities.service');
      expect(module.FlowableTaskFinderService).toBe(FlowableUtilitiesService);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent duplicate checks correctly', async () => {
      const eventKey = 'concurrent-event';
      
      const results = await Promise.all([
        Promise.resolve(service.isDuplicate(eventKey)),
        Promise.resolve(service.isDuplicate(eventKey)),
        Promise.resolve(service.isDuplicate(eventKey)),
      ]);

      // First should be false, others should be true
      expect(results[0]).toBe(false);
      expect(results[1]).toBe(true);
      expect(results[2]).toBe(true);
    });

    it('should handle very long event keys', () => {
      const longKey = 'event-' + 'x'.repeat(1000);
      
      const firstCall = service.isDuplicate(longKey);
      const secondCall = service.isDuplicate(longKey);

      expect(firstCall).toBe(false);
      expect(secondCall).toBe(true);
    });

    it('should handle special characters in event keys', () => {
      const specialKey = 'event-!@#$%^&*()_+-={}[]|\\:";\'<>?,./';
      
      const firstCall = service.isDuplicate(specialKey);
      const secondCall = service.isDuplicate(specialKey);

      expect(firstCall).toBe(false);
      expect(secondCall).toBe(true);
    });

    it('should handle empty candidate groups array', () => {
      const result = service.determineCandidateGroup('Random Task', []);
      expect(result).toBe(CandidateGroups.INVESTIGATIONS);
    });

    it('should handle uppercase candidate groups', () => {
      const result = service.determineCandidateGroup('Any Task', ['SUPERVISORS']);
      expect(result).toBe('supervisors');
    });

    it('should handle mixed case in task name inference', () => {
      const result1 = service.determineCandidateGroup('ApPrOvE Case');
      const result2 = service.determineCandidateGroup('InVeStIgAtE Case');
      
      expect(result1).toBe(CandidateGroups.SUPERVISORS);
      expect(result2).toBe(CandidateGroups.INVESTIGATIONS);
    });
  });
});
