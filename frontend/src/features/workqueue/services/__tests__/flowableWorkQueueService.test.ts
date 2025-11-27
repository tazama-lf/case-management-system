import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flowableWorkQueueService } from '../flowableWorkQueueService';
import apiClient from '../../../../shared/services/apiClient';
import { FlowableErrorHandler, FlowableError } from '../../utils/flowableErrorHandler';
import { WorkQueueCandidateGroup } from '../../types/flowable.types';
import type { FlowableTask } from '../../types/flowable.types';

vi.mock('../../../../shared/services/apiClient');
vi.mock('../../utils/flowableErrorHandler');

const mockGet = vi.fn();
const mockPatch = vi.fn();
const mockPost = vi.fn();

vi.mocked(apiClient).get = mockGet;
vi.mocked(apiClient).patch = mockPatch;
vi.mocked(apiClient).post = mockPost;

describe('FlowableWorkQueueService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getWorkQueueByGroup', () => {
    it('fetches and transforms work queue tasks', async () => {
      const mockFlowableTask = {
        id: 'flowable-task-1',
        name: 'Investigate Alert',
        description: 'Test task',
        assignee: 'user-1',
        createTime: '2023-01-01T00:00:00.000Z',
        priority: 50,
        suspended: false,
        taskDefinitionKey: 'investigate',
        processInstanceId: 'proc-1',
        processDefinitionId: 'proc-def-1',
        processDefinitionKey: 'case-process',
        executionId: 'exec-1',
        variables: {
          postgres_task_id: 'pg-task-1',
          postgres_case_id: 'CASE-1',
          task_status: 'STATUS_20_IN_PROGRESS',
        },
      } as FlowableTask & { variables?: Record<string, any> };

      mockGet.mockResolvedValue({
        data: {
          tasks: [mockFlowableTask],
        },
      });

      const result = await flowableWorkQueueService.getWorkQueueByGroup(
        WorkQueueCandidateGroup.INVESTIGATIONS,
      );

      expect(mockGet).toHaveBeenCalledWith(
        '/api/v1/task/work-queues/investigations',
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'pg-task-1',
        taskId: 'pg-task-1',
        flowableTaskId: 'flowable-task-1',
        name: 'Investigate Alert',
        description: 'Test task',
        assignee: 'user-1',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        caseId: 'CASE-1',
        processInstanceId: 'proc-1',
      });
    });

    it('handles empty task list', async () => {
      mockGet.mockResolvedValue({
        data: { tasks: [] },
      });

      const result = await flowableWorkQueueService.getWorkQueueByGroup(
        WorkQueueCandidateGroup.INVESTIGATIONS,
      );

      expect(result).toEqual([]);
    });

    it('handles missing tasks in response', async () => {
      mockGet.mockResolvedValue({
        data: {},
      });

      const result = await flowableWorkQueueService.getWorkQueueByGroup(
        WorkQueueCandidateGroup.INVESTIGATIONS,
      );

      expect(result).toEqual([]);
    });

    it('throws FlowableError on API error', async () => {
      const mockError = new Error('Network error');
      mockGet.mockRejectedValue(mockError);

      const mockFlowableError = new FlowableError(
        'Failed to get work queue',
        'NETWORK_ERROR',
      );
      vi.spyOn(FlowableErrorHandler, 'parseError').mockReturnValue(
        mockFlowableError,
      );

      await expect(
        flowableWorkQueueService.getWorkQueueByGroup(
          WorkQueueCandidateGroup.INVESTIGATIONS,
        ),
      ).rejects.toEqual(mockFlowableError);

      expect(FlowableErrorHandler.parseError).toHaveBeenCalledWith(
        mockError,
        'get work queue for investigations',
      );
    });
  });

  describe('getAllWorkQueues', () => {
    it('fetches all work queues and returns counts', async () => {
      mockGet
        .mockResolvedValueOnce({
          data: { tasks: [{ id: 'task-1' }, { id: 'task-2' }] },
        })
        .mockResolvedValueOnce({
          data: { tasks: [{ id: 'task-3' }] },
        })
        .mockResolvedValueOnce({
          data: { tasks: [] },
        });

      const result = await flowableWorkQueueService.getAllWorkQueues();

      expect(result).toEqual({
        investigations: 2,
        investigators: 1,
        supervisors: 0,
      });
    });

    it('handles errors for individual queues gracefully', async () => {
      mockGet
        .mockResolvedValueOnce({
          data: { tasks: [{ id: 'task-1' }] },
        })
        .mockRejectedValueOnce(new Error('Queue error'))
        .mockResolvedValueOnce({
          data: { tasks: [] },
        });

      const result = await flowableWorkQueueService.getAllWorkQueues();

      expect(result).toEqual({
        investigations: 1,
        investigators: 0,
        supervisors: 0,
      });
    });

  });

  describe('assignTask', () => {
    const mockTask = {
      id: 'flowable-task-1',
      name: 'Test Task',
      assignee: 'user-1',
      createTime: '2023-01-01T00:00:00.000Z',
      priority: 50,
      suspended: false,
      taskDefinitionKey: 'test',
      processInstanceId: 'proc-1',
      processDefinitionId: 'proc-def-1',
      processDefinitionKey: 'test-process',
      executionId: 'exec-1',
      variables: {
        postgres_task_id: 'pg-task-1',
        task_status: 'STATUS_10_ASSIGNED',
      },
    } as FlowableTask & { variables?: Record<string, any> };

    it('assigns task using regular assign endpoint', async () => {
      mockPatch.mockResolvedValue(mockTask);

      const result = await flowableWorkQueueService.assignTask('task-1', 'user-2', {
        currentUserId: 'user-1',
        isInvestigator: false,
      });

      expect(mockPatch).toHaveBeenCalledWith(
        '/api/v1/task/task-1/assign',
        { assignedUserId: 'user-2' },
      );
      expect(result).toMatchObject({
        id: 'pg-task-1',
        name: 'Test Task',
        assignee: 'user-1',
      });
    });

    it('uses self-assign endpoint for investigator self-assignment', async () => {
      mockPatch.mockResolvedValue(mockTask);

      await flowableWorkQueueService.assignTask('task-1', 'user-1', {
        currentUserId: 'user-1',
        isInvestigator: true,
      });

      expect(mockPatch).toHaveBeenCalledWith(
        '/api/v1/task/task-1/self-assign',
        { assignedUserId: 'user-1' },
      );
    });

    it('uses regular assign endpoint when not self-assignment', async () => {
      mockPatch.mockResolvedValue(mockTask);

      await flowableWorkQueueService.assignTask('task-1', 'user-1', {
        currentUserId: 'user-1',
        isInvestigator: false,
      });

      expect(mockPatch).toHaveBeenCalledWith(
        '/api/v1/task/task-1/assign',
        { assignedUserId: 'user-1' },
      );
    });

    it('uses regular assign endpoint when not investigator', async () => {
      mockPatch.mockResolvedValue(mockTask);

      await flowableWorkQueueService.assignTask('task-1', 'user-1', {
        currentUserId: 'user-1',
        isInvestigator: false,
      });

      expect(mockPatch).toHaveBeenCalledWith(
        '/api/v1/task/task-1/assign',
        { assignedUserId: 'user-1' },
      );
    });

    it('handles 404 error with specific message', async () => {
      const mockError: any = {
        response: {
          status: 404,
          data: { message: 'Task not found' },
        },
        message: 'Not Found',
      };
      mockPatch.mockRejectedValue(mockError);

      await expect(
        flowableWorkQueueService.assignTask('task-1', 'user-1'),
      ).rejects.toThrow(
        'Task assignment failed: Task not found. This task may only exist in Flowable and needs to be synced to the database.',
      );
    });

    it('throws FlowableError for other errors', async () => {
      const mockError = new Error('Server error');
      mockPatch.mockRejectedValue(mockError);

      const mockFlowableError = new FlowableError(
        'Failed to assign task',
        'API_ERROR',
      );
      vi.spyOn(FlowableErrorHandler, 'parseError').mockReturnValue(
        mockFlowableError,
      );

      await expect(
        flowableWorkQueueService.assignTask('task-1', 'user-1'),
      ).rejects.toEqual(mockFlowableError);

      expect(FlowableErrorHandler.parseError).toHaveBeenCalledWith(
        mockError,
        'assign task task-1',
      );
    });
  });

  describe('unassignTask', () => {
    const mockTask = {
      id: 'flowable-task-1',
      name: 'Test Task',
      assignee: undefined,
      createTime: '2023-01-01T00:00:00.000Z',
      priority: 50,
      suspended: false,
      taskDefinitionKey: 'test',
      processInstanceId: 'proc-1',
      processDefinitionId: 'proc-def-1',
      processDefinitionKey: 'test-process',
      executionId: 'exec-1',
      variables: {
        postgres_task_id: 'pg-task-1',
        task_status: 'STATUS_01_UNASSIGNED',
      },
    } as FlowableTask & { variables?: Record<string, any> };

    it('unassigns task successfully', async () => {
      mockPatch.mockResolvedValue(mockTask);

      const result = await flowableWorkQueueService.unassignTask('task-1');

      expect(mockPatch).toHaveBeenCalledWith(
        '/api/v1/task/task-1/unassign',
        { assignedUserId: '' },
      );
      expect(result).toMatchObject({
        id: 'pg-task-1',
        status: 'UNASSIGNED',
      });
      expect(result.assignee).toBeUndefined();
    });

    it('throws FlowableError on error', async () => {
      const mockError = new Error('Unassign failed');
      mockPatch.mockRejectedValue(mockError);

      const mockFlowableError = new FlowableError(
        'Failed to unassign task',
        'API_ERROR',
      );
      vi.spyOn(FlowableErrorHandler, 'parseError').mockReturnValue(
        mockFlowableError,
      );

      await expect(
        flowableWorkQueueService.unassignTask('task-1'),
      ).rejects.toEqual(mockFlowableError);

      expect(FlowableErrorHandler.parseError).toHaveBeenCalledWith(
        mockError,
        'unassign task task-1',
      );
    });
  });

  describe('completeTask', () => {
    it('completes task with notes', async () => {
      mockPost.mockResolvedValue({});

      await flowableWorkQueueService.completeTask('task-1', {
        notes: 'Task completed successfully',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/api/v1/task/task-1/complete',
        {
          variables: {
            notes: 'Task completed successfully',
          },
        },
      );
    });

    it('completes task with empty notes when not provided', async () => {
      mockPost.mockResolvedValue({});

      await flowableWorkQueueService.completeTask('task-1', {});

      expect(mockPost).toHaveBeenCalledWith(
        '/api/v1/task/task-1/complete',
        {
          variables: {
            notes: '',
          },
        },
      );
    });

    it('throws FlowableError on error', async () => {
      const mockError = new Error('Complete failed');
      mockPost.mockRejectedValue(mockError);

      const mockFlowableError = new FlowableError(
        'Failed to complete task',
        'API_ERROR',
      );
      vi.spyOn(FlowableErrorHandler, 'parseError').mockReturnValue(
        mockFlowableError,
      );

      await expect(
        flowableWorkQueueService.completeTask('task-1', {}),
      ).rejects.toEqual(mockFlowableError);

      expect(FlowableErrorHandler.parseError).toHaveBeenCalledWith(
        mockError,
        'complete task task-1',
      );
    });
  });

  describe('getTaskDetails', () => {
    const mockTask = {
      id: 'flowable-task-1',
      name: 'Test Task',
      description: 'Task description',
      assignee: 'user-1',
      createTime: '2023-01-01T00:00:00.000Z',
      priority: 75,
      suspended: false,
      taskDefinitionKey: 'test',
      processInstanceId: 'proc-1',
      processDefinitionId: 'proc-def-1',
      processDefinitionKey: 'test-process',
      executionId: 'exec-1',
      variables: {
        postgres_task_id: 'pg-task-1',
        postgres_case_id: 'CASE-1',
        task_status: 'STATUS_20_IN_PROGRESS',
      },
    } as FlowableTask & { variables?: Record<string, any> };

    it('fetches and transforms task details', async () => {
      mockGet.mockResolvedValue(mockTask);

      const result = await flowableWorkQueueService.getTaskDetails('task-1');

      expect(mockGet).toHaveBeenCalledWith('/api/v1/task/task-1');
      expect(result).toMatchObject({
        id: 'pg-task-1',
        taskId: 'pg-task-1',
        flowableTaskId: 'flowable-task-1',
        name: 'Test Task',
        description: 'Task description',
        assignee: 'user-1',
        status: 'IN_PROGRESS',
        priority: 'CRITICAL',
        caseId: 'CASE-1',
      });
    });

    it('throws FlowableError on error', async () => {
      const mockError = new Error('Task not found');
      mockGet.mockRejectedValue(mockError);

      const mockFlowableError = new FlowableError(
        'Failed to get task details',
        'API_ERROR',
      );
      vi.spyOn(FlowableErrorHandler, 'parseError').mockReturnValue(
        mockFlowableError,
      );

      await expect(
        flowableWorkQueueService.getTaskDetails('task-1'),
      ).rejects.toEqual(mockFlowableError);

      expect(FlowableErrorHandler.parseError).toHaveBeenCalledWith(
        mockError,
        'get task details for task-1',
      );
    });
  });

  describe('getCandidateGroups', () => {
    it('returns all groups for supervisor', () => {
      const result = flowableWorkQueueService.getCandidateGroups(false, true);

      expect(result).toHaveLength(3);
      expect(result).toEqual([
        {
          value: WorkQueueCandidateGroup.INVESTIGATIONS,
          label: 'Investigations Queue',
        },
        {
          value: WorkQueueCandidateGroup.INVESTIGATORS,
          label: 'Investigators Queue',
        },
        {
          value: WorkQueueCandidateGroup.SUPERVISORS,
          label: 'Supervisors Queue',
        },
      ]);
    });

    it('returns filtered groups for investigator', () => {
      const result = flowableWorkQueueService.getCandidateGroups(true, false);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        {
          value: WorkQueueCandidateGroup.INVESTIGATIONS,
          label: 'Investigations Queue',
        },
        {
          value: WorkQueueCandidateGroup.INVESTIGATORS,
          label: 'Investigators Queue',
        },
      ]);
    });

    it('returns all groups when no role specified', () => {
      const result = flowableWorkQueueService.getCandidateGroups();

      expect(result).toHaveLength(3);
    });
  });

  describe('transformFlowableTask', () => {
    it('maps task status from variables correctly', async () => {
      const testCases = [
        {
          status: 'STATUS_01_UNASSIGNED',
          expected: 'UNASSIGNED',
        },
        {
          status: 'STATUS_10_ASSIGNED',
          expected: 'ASSIGNED',
        },
        {
          status: 'STATUS_20_IN_PROGRESS',
          expected: 'IN_PROGRESS',
        },
        {
          status: 'STATUS_30_COMPLETED',
          expected: 'COMPLETED',
        },
        {
          status: 'STATUS_21_BLOCKED',
          expected: 'SUSPENDED',
        },
      ];

      for (const testCase of testCases) {
        mockGet.mockResolvedValueOnce({
          id: 'task-1',
          name: 'Test',
          assignee: 'user-1',
          createTime: '2023-01-01T00:00:00.000Z',
          priority: 50,
          suspended: false,
          taskDefinitionKey: 'test',
          processInstanceId: 'proc-1',
          processDefinitionId: 'proc-def-1',
          processDefinitionKey: 'test',
          executionId: 'exec-1',
          variables: {
            task_status: testCase.status,
            postgres_task_id: 'pg-1',
          },
        });

        const result = await flowableWorkQueueService.getTaskDetails('task-1');
        expect(result.status).toBe(testCase.expected);
      }
    });

    it('maps task status from suspended flag', async () => {
      mockGet.mockResolvedValue({
        id: 'task-1',
        name: 'Test',
        assignee: 'user-1',
        createTime: '2023-01-01T00:00:00.000Z',
        priority: 50,
        suspended: true,
        taskDefinitionKey: 'test',
        processInstanceId: 'proc-1',
        processDefinitionId: 'proc-def-1',
        processDefinitionKey: 'test',
        executionId: 'exec-1',
      });

      const result = await flowableWorkQueueService.getTaskDetails('task-1');
      expect(result.status).toBe('SUSPENDED');
    });

    it('maps task status from assignee presence', async () => {
      mockGet.mockResolvedValue({
        id: 'task-1',
        name: 'Test',
        assignee: undefined,
        createTime: '2023-01-01T00:00:00.000Z',
        priority: 50,
        suspended: false,
        taskDefinitionKey: 'test',
        processInstanceId: 'proc-1',
        processDefinitionId: 'proc-def-1',
        processDefinitionKey: 'test',
        executionId: 'exec-1',
      });

      const result = await flowableWorkQueueService.getTaskDetails('task-1');
      expect(result.status).toBe('UNASSIGNED');
    });

    it('maps priority correctly', async () => {
      const priorityTests = [
        { priority: 95, expected: 'BREACH' },
        { priority: 75, expected: 'CRITICAL' },
        { priority: 60, expected: 'URGENT' },
        { priority: 30, expected: 'NEW' },
      ];

      for (const test of priorityTests) {
        mockGet.mockResolvedValueOnce({
          id: 'task-1',
          name: 'Test',
          assignee: 'user-1',
          createTime: '2023-01-01T00:00:00.000Z',
          priority: test.priority,
          suspended: false,
          taskDefinitionKey: 'test',
          processInstanceId: 'proc-1',
          processDefinitionId: 'proc-def-1',
          processDefinitionKey: 'test',
          executionId: 'exec-1',
          variables: {
            postgres_task_id: 'pg-1',
          },
        });

        const result = await flowableWorkQueueService.getTaskDetails('task-1');
        expect(result.priority).toBe(test.expected);
      }
    });

    it('extracts PostgreSQL task ID from various sources', async () => {
      const testCases = [
        {
          variables: { postgres_task_id: 'pg-from-vars' },
          expected: 'pg-from-vars',
        },
        {
          processVariables: { postgresTaskId: 'pg-from-process' },
          expected: 'pg-from-process',
        },
        {
          variables: { taskId: 'pg-from-taskid' },
          expected: 'pg-from-taskid',
        },
        {
          id: 'flowable-id',
          expected: 'flowable-id',
        },
      ];

      for (const testCase of testCases) {
        mockGet.mockResolvedValueOnce({
          id: 'flowable-id',
          name: 'Test',
          assignee: 'user-1',
          createTime: '2023-01-01T00:00:00.000Z',
          priority: 50,
          suspended: false,
          taskDefinitionKey: 'test',
          processInstanceId: 'proc-1',
          processDefinitionId: 'proc-def-1',
          processDefinitionKey: 'test',
          executionId: 'exec-1',
          ...testCase,
        });

        const result = await flowableWorkQueueService.getTaskDetails('task-1');
        expect(result.id).toBe(testCase.expected);
        expect(result.taskId).toBe(testCase.expected);
      }
    });

    it('extracts case ID from various sources', async () => {
      const testCases = [
        {
          variables: { postgres_case_id: 'CASE-1' },
          expected: 'CASE-1',
        },
        {
          processVariables: { caseId: 'CASE-2' },
          expected: 'CASE-2',
        },
        {
          variables: { caseId: 'CASE-3' },
          expected: 'CASE-3',
        },
      ];

      for (const testCase of testCases) {
        mockGet.mockResolvedValueOnce({
          id: 'task-1',
          name: 'Test',
          assignee: 'user-1',
          createTime: '2023-01-01T00:00:00.000Z',
          priority: 50,
          suspended: false,
          taskDefinitionKey: 'test',
          processInstanceId: 'proc-1',
          processDefinitionId: 'proc-def-1',
          processDefinitionKey: 'test',
          executionId: 'exec-1',
          variables: {
            postgres_task_id: 'pg-1',
            ...(testCase.variables || {}),
          },
          ...(testCase.processVariables
            ? { processVariables: testCase.processVariables }
            : {}),
        });

        const result = await flowableWorkQueueService.getTaskDetails('task-1');
        expect(result.caseId).toBe(testCase.expected);
      }
    });

    it('uses candidateGroup parameter when provided', async () => {
      mockGet.mockResolvedValue({
        data: {
          tasks: [
            {
              id: 'task-1',
              name: 'Test',
              assignee: 'user-1',
              createTime: '2023-01-01T00:00:00.000Z',
              priority: 50,
              suspended: false,
              taskDefinitionKey: 'test',
              processInstanceId: 'proc-1',
              processDefinitionId: 'proc-def-1',
              processDefinitionKey: 'test',
              executionId: 'exec-1',
              variables: {
                postgres_task_id: 'pg-1',
              },
            },
          ],
        },
      });

      const result = await flowableWorkQueueService.getWorkQueueByGroup(
        WorkQueueCandidateGroup.INVESTIGATORS,
      );

      expect(result[0].candidateGroup).toBe('investigators');
    });
  });
});

