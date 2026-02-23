import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { FlowableIdentityService } from '../src/modules/flowable/services/flowable-identity.service';
import { FlowableClientFactory } from '../src/modules/flowable/services/flowable-client.factory';
import { LoggerService } from '@tazama-lf/frms-coe-lib';

describe('FlowableIdentityService', () => {
  let service: FlowableIdentityService;
  let loggerService: jest.Mocked<LoggerService>;

  const mockFlowableClient = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };

  const mockClientFactory = {
    getClient: jest.fn().mockReturnValue(mockFlowableClient),
    getBaseUrl: jest.fn().mockReturnValue('http://flowable:8080'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlowableIdentityService,
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

    service = module.get<FlowableIdentityService>(FlowableIdentityService);
    loggerService = module.get(LoggerService);

    jest.clearAllMocks();
  });

  describe('addUserToGroup', () => {
    it('should add user to group successfully', async () => {
      const mockResponse = { userId: 'user1', groupId: 'group1' };
      mockFlowableClient.post.mockResolvedValue({ data: mockResponse });

      const result = await service.addUserToGroup('group1', 'user1');

      expect(mockFlowableClient.post).toHaveBeenCalledWith(
        expect.stringContaining('group1'),
        { userId: 'user1' },
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle 409 conflict (user already in group)', async () => {
      mockFlowableClient.post.mockRejectedValue({
        response: { status: 409 },
      });

      const result = await service.addUserToGroup('group1', 'user1');

      expect(result).toBeNull();
      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('already a member'),
        'FlowableIdentityService',
      );
    });

    it('should throw HttpException on other errors', async () => {
      mockFlowableClient.post.mockRejectedValue(new Error('Network error'));

      await expect(service.addUserToGroup('group1', 'user1')).rejects.toThrow(HttpException);
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('removeUserFromGroup', () => {
    it('should remove user from group successfully', async () => {
      mockFlowableClient.delete.mockResolvedValue({});

      await service.removeUserFromGroup('group1', 'user1');

      expect(mockFlowableClient.delete).toHaveBeenCalledWith(
        expect.stringContaining('group1'),
      );
    });

    it('should handle 404 not found (user not in group)', async () => {
      mockFlowableClient.delete.mockRejectedValue({
        response: { status: 404 },
      });

      await service.removeUserFromGroup('group1', 'user1');

      // Should not throw error
      expect(loggerService.error).not.toHaveBeenCalled();
    });

    it('should throw HttpException on other errors', async () => {
      mockFlowableClient.delete.mockRejectedValue(new Error('Network error'));

      await expect(service.removeUserFromGroup('group1', 'user1')).rejects.toThrow(HttpException);
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('createGroup', () => {
    it('should create group successfully', async () => {
      const groupData = {id: 'group1', name: 'Group 1', type: 'candidate' };
      mockFlowableClient.post.mockResolvedValue({ data: groupData });

      const result = await service.createGroup(groupData);

      expect(mockFlowableClient.post).toHaveBeenCalledWith(
        expect.anything(),
        groupData,
      );
      expect(result).toEqual(groupData);
    });

    it('should handle 409 conflict (group already exists)', async () => {
      const groupData = { id: 'group1', name: 'Group 1', type: 'candidate' };
      mockFlowableClient.post.mockRejectedValue({
        response: { status: 409 },
      });

      const result = await service.createGroup(groupData);

      expect(result).toBeNull();
      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('already exists'),
        'FlowableIdentityService',
      );
    });

    it('should throw HttpException on other errors', async () => {
      const groupData = { id: 'group1', name: 'Group 1', type: 'candidate' };
      mockFlowableClient.post.mockRejectedValue(new Error('Network error'));

      await expect(service.createGroup(groupData)).rejects.toThrow(HttpException);
    });
  });

  describe('getGroup', () => {
    it('should get group by ID successfully', async () => {
      const groupData = { id: 'group1', name: 'Group 1', type: 'candidate' };
      mockFlowableClient.get.mockResolvedValue({ data: groupData });

      const result = await service.getGroup('group1');

      expect(mockFlowableClient.get).toHaveBeenCalled();
      expect(result).toEqual(groupData);
    });

    it('should return null when group not found (404)', async () => {
      mockFlowableClient.get.mockRejectedValue({
        response: { status: 404 },
      });

      const result = await service.getGroup('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw HttpException on other errors', async () => {
      mockFlowableClient.get.mockRejectedValue(new Error('Network error'));

      await expect(service.getGroup('group1')).rejects.toThrow(HttpException);
    });
  });

  describe('getAllCandidateGroups', () => {
    it('should get all candidate groups successfully', async () => {
      const groups = [
        { id: 'group1', name: 'Group 1' },
        { id: 'group2', name: 'Group 2' },
      ];
      mockFlowableClient.get.mockResolvedValue({ data: { data: groups } });

      const result = await service.getAllCandidateGroups(10, 0);

      expect(mockFlowableClient.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            type: 'candidate',
            size: 10,
            start: 0,
          }),
        }),
      );
      expect(result).toEqual(groups);
    });

    it('should return empty array on error', async () => {
      mockFlowableClient.get.mockRejectedValue(new Error('Network error'));

      const result = await service.getAllCandidateGroups();

      expect(result).toEqual([]);
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should handle missing data field', async () => {
      mockFlowableClient.get.mockResolvedValue({ data: {} });

      const result = await service.getAllCandidateGroups();

      expect(result).toEqual([]);
    });
  });

  describe('getTasksAssignedToUser', () => {
    it('should get tasks assigned to user successfully', async () => {
      const tasks = [
        { id: 'task1', assignee: 'user1', name: 'Task 1' },
        { id: 'task2', assignee: 'user1', name: 'Task 2' },
      ];
      mockFlowableClient.get.mockResolvedValue({ data: { data: tasks } });

      const result = await service.getTasksAssignedToUser('user1');

      expect(mockFlowableClient.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            assignee: 'user1',
            includeProcessVariables: true,
            includeTaskLocalVariables: true,
          }),
        }),
      );
      expect(result).toEqual(tasks);
    });

    it('should throw HttpException on error', async () => {
      mockFlowableClient.get.mockRejectedValue(new Error('Network error'));

      await expect(service.getTasksAssignedToUser('user1')).rejects.toThrow(HttpException);
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should handle missing data field', async () => {
      mockFlowableClient.get.mockResolvedValue({ data: {} });

      const result = await service.getTasksAssignedToUser('user1');

      expect(result).toEqual([]);
    });
  });

  describe('getWorkQueueStatistics', () => {
    const mockGetCandidateGroupTasksFn = jest.fn();
    const mockFlowableClientParam = mockFlowableClient as any;

    beforeEach(() => {
      mockGetCandidateGroupTasksFn.mockClear();
    });

    it('should get statistics for all groups', async () => {
      const groups = [
        { id: 'group1', name: 'Group 1' },
        { id: 'group2', name: 'Group 2' },
      ];
      mockFlowableClient.get.mockResolvedValue({ data: { data: groups } });

      const group1Tasks = [
        { id: 'task1', assignee: 'user1' },
        { id: 'task2', assignee: null },
        { id: 'task3', assignee: 'user2' },
      ];
      const group2Tasks = [
        { id: 'task4', assignee: null },
      ];

      mockGetCandidateGroupTasksFn
        .mockResolvedValueOnce(group1Tasks)
        .mockResolvedValueOnce(group2Tasks);

      const result = await service.getWorkQueueStatistics(
        mockFlowableClientParam,
        mockGetCandidateGroupTasksFn,
      );

      expect(result).toEqual({
        group1: {
          total: 3,
          unassigned: 1,
          assigned: 2,
        },
        group2: {
          total: 1,
          unassigned: 1,
          assigned: 0,
        },
      });
      expect(mockGetCandidateGroupTasksFn).toHaveBeenCalledTimes(2);
    });

    it('should get statistics for specific group', async () => {
      const tasks = [
        { id: 'task1', assignee: 'user1' },
        { id: 'task2', assignee: null },
      ];
      mockGetCandidateGroupTasksFn.mockResolvedValue(tasks);

      const result = await service.getWorkQueueStatistics(
        mockFlowableClientParam,
        mockGetCandidateGroupTasksFn,
        'group1',
      );

      expect(result).toEqual({
        group1: {
          total: 2,
          unassigned: 1,
          assigned: 1,
        },
      });
      expect(mockGetCandidateGroupTasksFn).toHaveBeenCalledWith('group1', false);
    });

    it('should throw HttpException on error', async () => {
      mockGetCandidateGroupTasksFn.mockRejectedValue(new Error('Network error'));

      await expect(
        service.getWorkQueueStatistics(
          mockFlowableClientParam,
          mockGetCandidateGroupTasksFn,
          'group1',
        ),
      ).rejects.toThrow(HttpException);
      expect(loggerService.error).toHaveBeenCalled();
    });

    it('should handle tasks with undefined assignee', async () => {
      const tasks = [
        { id: 'task1', assignee: 'user1' },
        { id: 'task2' }, // no assignee property
        { id: 'task3', assignee: undefined },
      ];
      mockGetCandidateGroupTasksFn.mockResolvedValue(tasks);

      const result = await service.getWorkQueueStatistics(
        mockFlowableClientParam,
        mockGetCandidateGroupTasksFn,
        'group1',
      );

      expect(result).toEqual({
        group1: {
          total: 3,
          unassigned: 2,
          assigned: 1,
        },
      });
    });
  });
});
