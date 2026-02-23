import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { FlowableService } from '../src/modules/flowable/flowable.service';
import { FlowableProcessService } from '../src/modules/flowable/services/flowable-process.service';
import { FlowableTaskService } from '../src/modules/flowable/services/flowable-task.service';
import { FlowableIdentityService } from '../src/modules/flowable/services/flowable-identity.service';
import { FlowableUtilitiesService } from '../src/modules/flowable/services/flowable-utilities.service';
import { FlowableClientFactory } from '../src/modules/flowable/services/flowable-client.factory';
import { CaseEventListener } from '../src/modules/flowable/listeners/case-event.listener';
import { TaskEventListener } from '../src/modules/flowable/listeners/task-event.listener';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import * as fs from 'node:fs/promises';

// Mock fs module
jest.mock('node:fs/promises');

describe('FlowableService', () => {
  let service: FlowableService;
  let configService: jest.Mocked<ConfigService>;
  let loggerService: jest.Mocked<LoggerService>;
  let clientFactory: jest.Mocked<FlowableClientFactory>;
  let processService: jest.Mocked<FlowableProcessService>;
  let taskService: jest.Mocked<FlowableTaskService>;
  let identityService: jest.Mocked<FlowableIdentityService>;
  let utilitiesService: jest.Mocked<FlowableUtilitiesService>;
  let caseEventListener: jest.Mocked<CaseEventListener>;
  let taskEventListener: jest.Mocked<TaskEventListener>;

  const mockFlowableClient = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlowableService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
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
          useValue: {
            getClient: jest.fn().mockReturnValue(mockFlowableClient),
            getBaseUrl: jest.fn().mockReturnValue('http://flowable:8080/flowable-rest'),
          },
        },
        {
          provide: FlowableProcessService,
          useValue: {
            startProcessInstance: jest.fn(),
            getProcessInstance: jest.fn(),
            getProcessInstanceByBusinessKey: jest.fn(),
            updateProcessVariable: jest.fn(),
            setProcessVariables: jest.fn(),
            terminateProcessInstance: jest.fn(),
            suspendProcessInstance: jest.fn(),
            activateProcessInstance: jest.fn(),
            getProcessDefinitions: jest.fn(),
            listProcessDefinitions: jest.fn(),
          },
        },
        {
          provide: FlowableTaskService,
          useValue: {
            getProcessTasks: jest.fn(),
            createTask: jest.fn(),
            completeTask: jest.fn(),
            claimTask: jest.fn(),
            unclaimTask: jest.fn(),
            delegateTask: jest.fn(),
            assignTaskToCandidateGroup: jest.fn(),
            getTaskIdentityLinks: jest.fn(),
            getCandidateGroupTasks: jest.fn(),
            getUserTasks: jest.fn(),
            getTask: jest.fn(),
            setTaskVariables: jest.fn(),
            updateTaskVariable: jest.fn(),
            deleteTaskVariable: jest.fn(),
          },
        },
        {
          provide: FlowableIdentityService,
          useValue: {
            addUserToGroup: jest.fn(),
            removeUserFromGroup: jest.fn(),
            createGroup: jest.fn(),
            getGroup: jest.fn(),
            getWorkQueueStatistics: jest.fn(),
            getAllCandidateGroups: jest.fn(),
            getTasksAssignedToUser: jest.fn(),
          },
        },
        {
          provide: FlowableUtilitiesService,
          useValue: {
            getTaskVariables: jest.fn(),
          },
        },
        {
          provide: CaseEventListener,
          useValue: {
            handleCaseStatusChanged: jest.fn(),
            handleCaseAbandoned: jest.fn(),
            handleSuspendCase: jest.fn(),
          },
        },
        {
          provide: TaskEventListener,
          useValue: {
            handleTaskCompleted: jest.fn(),
            handleTaskAssigned: jest.fn(),
            handleTaskUnassigned: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FlowableService>(FlowableService);
    configService = module.get(ConfigService);
    loggerService = module.get(LoggerService);
    clientFactory = module.get(FlowableClientFactory);
    processService = module.get(FlowableProcessService);
    taskService = module.get(FlowableTaskService);
    identityService = module.get(FlowableIdentityService);
    utilitiesService = module.get(FlowableUtilitiesService);
    caseEventListener = module.get(CaseEventListener);
    taskEventListener = module.get(TaskEventListener);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('onModuleInit', () => {
    it('should skip initialization when Flowable is disabled', async () => {
      configService.get.mockReturnValue(false);

      await service.onModuleInit();

      expect(loggerService.log).toHaveBeenCalledWith(
        'Flowable is disabled via configuration, skipping initialization',
        'FlowableService',
      );
      expect(mockFlowableClient.get).not.toHaveBeenCalled();
    });

    it('should initialize successfully on first attempt', async () => {
      configService.get.mockReturnValue(true);
      mockFlowableClient.get.mockResolvedValue({ data: { data: [] } });
      (fs.readFile as jest.Mock).mockResolvedValue('<bpmn>test</bpmn>');
      mockFlowableClient.post.mockResolvedValue({ data: { id: 'deployment-123' } });

      await service.onModuleInit();

      expect(loggerService.log).toHaveBeenCalledWith(
        'Initializing Flowable (attempt 1/3)',
        'FlowableService',
      );
      expect(loggerService.log).toHaveBeenCalledWith(
        'Flowable initialized successfully',
        'FlowableService',
      );
    });

    it('should retry on failure and eventually succeed', async () => {
      configService.get.mockReturnValue(true);
      mockFlowableClient.get
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce({ data: { data: [] } });
      (fs.readFile as jest.Mock).mockResolvedValue('<bpmn>test</bpmn>');
      mockFlowableClient.post.mockResolvedValue({ data: { id: 'deployment-123' } });

      // Mock setTimeout to execute immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        cb();
        return 0 as any;
      });

      await service.onModuleInit();

      expect(loggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize Flowable (attempt 1/3)'),
        expect.any(String),
        'FlowableService',
      );
      expect(loggerService.log).toHaveBeenCalledWith(
        'Flowable initialized successfully',
        'FlowableService',
      );

      jest.restoreAllMocks();
    });

    it('should continue with warning when FLOWABLE_SKIP_ON_FAILURE is true', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'FLOWABLE_ENABLED') return true;
        if (key === 'FLOWABLE_SKIP_ON_FAILURE') return true;
        return false;
      });
      mockFlowableClient.get.mockRejectedValue(new Error('Connection failed'));

      // Mock setTimeout to execute immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        cb();
        return 0 as any;
      });

      await service.onModuleInit();

      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Flowable initialization failed after 3 attempts'),
        'FlowableService',
      );

      jest.restoreAllMocks();
    });

    it('should throw error when max retries reached and FLOWABLE_SKIP_ON_FAILURE is false', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'FLOWABLE_ENABLED') return true;
        if (key === 'FLOWABLE_SKIP_ON_FAILURE') return false;
        return false;
      });
      mockFlowableClient.get.mockRejectedValue(new Error('Connection failed'));

      // Mock setTimeout to execute immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        cb();
        return 0 as any;
      });

      await expect(service.onModuleInit()).rejects.toThrow('Flowable initialization failed after 3 attempts');

      jest.restoreAllMocks();
    });
  });

  describe('deployBpmnProcess', () => {
    it('should deploy BPMN process successfully', async () => {
      configService.get.mockReturnValue(true);
      (fs.readFile as jest.Mock).mockResolvedValue('<bpmn>test</bpmn>');
      mockFlowableClient.get.mockResolvedValue({ data: { data: [] } });
      mockFlowableClient.post.mockResolvedValue({ data: { id: 'deployment-123' } });

      await service.onModuleInit();

      expect(fs.readFile).toHaveBeenCalled();
      expect(mockFlowableClient.post).toHaveBeenCalled();
      expect(loggerService.log).toHaveBeenCalledWith(
        'BPMN process deployed successfully: deployment-123',
        'FlowableService',
      );
    });

    it('should throw error when BPMN file not found', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'FLOWABLE_ENABLED') return true;
        if (key === 'FLOWABLE_SKIP_ON_FAILURE') return false;
        return defaultValue;
      });
      mockFlowableClient.get.mockResolvedValue({ data: { data: [] } });
      (fs.readFile as jest.Mock).mockRejectedValue({ code: 'ENOENT' });

      // Mock setTimeout to execute immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        cb();
        return 0 as any;
      });

      await expect(service.onModuleInit()).rejects.toThrow('Critical: BPMN file not found');

      jest.restoreAllMocks();
    });

    it('should handle deployment error', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'FLOWABLE_ENABLED') return true;
        if (key === 'FLOWABLE_SKIP_ON_FAILURE') return false;
        return defaultValue;
      });
      mockFlowableClient.get.mockResolvedValue({ data: {data: [] } });
      (fs.readFile as jest.Mock).mockResolvedValue('<bpmn>test</bpmn>');
      mockFlowableClient.post.mockRejectedValue(new Error('Deployment failed'));

      // Mock setTimeout to execute immediately
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        cb();
        return 0 as any;
      });

      await expect(service.onModuleInit()).rejects.toThrow();

      jest.restoreAllMocks();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status on successful connection', async () => {
      mockFlowableClient.get.mockResolvedValue({ data: { data: [] } });

      const result = await service.healthCheck();

      expect(result).toEqual({ status: 'healthy' });
      expect(loggerService.log).toHaveBeenCalledWith('Flowable health check passed', 'FlowableService');
    });

    it('should handle ECONNREFUSED error', async () => {
      mockFlowableClient.get.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED',
      });

      await expect(service.healthCheck()).rejects.toThrow('Cannot connect to Flowable server');
    });

    it('should handle ECONNRESET error', async () => {
      mockFlowableClient.get.mockRejectedValue({
        code: 'ECONNRESET',
        message: 'Connection reset',
      });

      await expect(service.healthCheck()).rejects.toThrow('Connection reset by Flowable server');
    });

    it('should handle generic error', async () => {
      mockFlowableClient.get.mockRejectedValue(new Error('Network error'));

      await expect(service.healthCheck()).rejects.toThrow('Network error');
    });
  });

  describe('Identity Management', () => {
    it('should add user to group', async () => {
      identityService.addUserToGroup.mockResolvedValue({ userId: 'user1' });

      const result = await service.addUserToGroup('group1', 'user1');

      expect(identityService.addUserToGroup).toHaveBeenCalledWith('group1', 'user1');
      expect(result).toEqual({ userId: 'user1' });
    });

    it('should remove user from group', async () => {
      await service.removeUserFromGroup('group1', 'user1');

      expect(identityService.removeUserFromGroup).toHaveBeenCalledWith('group1', 'user1');
    });

    it('should create group', async () => {
      const groupData = { id: 'group1', name: 'Group 1', type: 'candidate' };
      identityService.createGroup.mockResolvedValue(groupData);

      const result = await service.createGroup(groupData);

      expect(identityService.createGroup).toHaveBeenCalledWith(groupData);
      expect(result).toEqual(groupData);
    });

    it('should get group', async () => {
      const groupData = { id: 'group1', name: 'Group 1' };
      identityService.getGroup.mockResolvedValue(groupData);

      const result = await service.getGroup('group1');

      expect(identityService.getGroup).toHaveBeenCalledWith('group1');
      expect(result).toEqual(groupData);
    });

    it('should get all candidate groups', async () => {
      const groups = [{ id: 'group1' }, { id: 'group2' }];
      identityService.getAllCandidateGroups.mockResolvedValue(groups);

      const result = await service.getAllCandidateGroups(10, 0);

      expect(identityService.getAllCandidateGroups).toHaveBeenCalledWith(10, 0);
      expect(result).toEqual(groups);
    });

    it('should get work queue statistics', async () => {
      const stats = { group1: { total: 5, unassigned: 2, assigned: 3 } };
      identityService.getWorkQueueStatistics.mockResolvedValue(stats);

      const result = await service.getWorkQueueStatistics('group1');

      expect(identityService.getWorkQueueStatistics).toHaveBeenCalled();
      expect(result).toEqual(stats);
    });

    it('should get tasks assigned to user', async () => {
      const tasks = [{ id: 'task1', assignee: 'user1' }];
      identityService.getTasksAssignedToUser.mockResolvedValue(tasks);

      const result = await service.handleGetTasksByAssignee('user1');

      expect(identityService.getTasksAssignedToUser).toHaveBeenCalledWith('user1');
      expect(result).toEqual(tasks);
    });
  });

  describe('Process Management', () => {
    it('should start process instance', async () => {
      const processData = { id: 'process-123' };
      processService.startProcessInstance.mockResolvedValue(processData);

      const result = await service.startProcessInstance(
        'caseManagementProcess',
        { caseId: '123' },
        123,
        'tenant1',
      );

      expect(processService.startProcessInstance).toHaveBeenCalledWith(
        'caseManagementProcess',
        { caseId: '123' },
        123,
        'tenant1',
      );
      expect(result).toEqual(processData);
    });

    it('should get process instance', async () => {
      const processData = { id: 'process-123' };
      processService.getProcessInstance.mockResolvedValue(processData);

      const result = await service.getProcessInstance('process-123');

      expect(processService.getProcessInstance).toHaveBeenCalledWith('process-123');
      expect(result).toEqual(processData);
    });

    it('should get process instance by business key', async () => {
      const processData = { id: 'process-123', businessKey: 123 };
      processService.getProcessInstanceByBusinessKey.mockResolvedValue(processData);

      const result = await service.getProcessInstanceByBusinessKey(123);

      expect(processService.getProcessInstanceByBusinessKey).toHaveBeenCalledWith(123);
      expect(result).toEqual(processData);
    });

    it('should update process variable', async () => {
      await service.updateProcessVariable('process-123', 'status', 'active');

      expect(processService.updateProcessVariable).toHaveBeenCalledWith('process-123', 'status', 'active');
    });

    it('should set process variables', async () => {
      const variables = { status: 'active', priority: 'high' };
      processService.setProcessVariables.mockResolvedValue({ success: true });

      const result = await service.setProcessVariables('process-123', variables);

      expect(processService.setProcessVariables).toHaveBeenCalledWith('process-123', variables);
      expect(result).toEqual({ success: true });
    });

    it('should terminate process instance', async () => {
      processService.terminateProcessInstance.mockResolvedValue({ success: true });

      const result = await service.terminateProcessInstance('process-123', 'closed');

      expect(processService.terminateProcessInstance).toHaveBeenCalledWith('process-123', 'closed');
      expect(result).toEqual({ success: true });
    });

    it('should suspend process instance', async () => {
      processService.suspendProcessInstance.mockResolvedValue({ success: true });

      const result = await service.suspendProcessInstance('process-123');

      expect(processService.suspendProcessInstance).toHaveBeenCalledWith('process-123');
      expect(result).toEqual({ success: true });
    });

    it('should activate process instance', async () => {
      processService.activateProcessInstance.mockResolvedValue({ success: true });

      const result = await service.activateProcessInstance('process-123');

      expect(processService.activateProcessInstance).toHaveBeenCalledWith('process-123');
      expect(result).toEqual({ success: true });
    });

    it('should get process definitions', async () => {
      const definitions = [{ id: 'def-1', key: 'caseManagementProcess' }];
      processService.getProcessDefinitions.mockResolvedValue(definitions);

      const result = await service.getProcessDefinitions('caseManagementProcess');

      expect(processService.getProcessDefinitions).toHaveBeenCalledWith('caseManagementProcess');
      expect(result).toEqual(definitions);
    });

    it('should list process definitions', async () => {
      processService.listProcessDefinitions.mockResolvedValue('Process list');

      const result = await service.listProcessDefinitions();

      expect(processService.listProcessDefinitions).toHaveBeenCalled();
      expect(result).toEqual('Process list');
    });
  });

  describe('Task Management', () => {
    it('should get process tasks', async () => {
      const tasks = [{ id: 'task1' }];
      taskService.getProcessTasks.mockResolvedValue(tasks);

      const result = await service.getProcessTasks('process-123');

      expect(taskService.getProcessTasks).toHaveBeenCalledWith('process-123');
      expect(result).toEqual(tasks);
    });

    it('should create task', async () => {
      const taskData = { name: 'Test Task', description: 'Test' };
      taskService.createTask.mockResolvedValue({ id: 'task-123' });

      const result = await service.createTask(taskData);

      expect(taskService.createTask).toHaveBeenCalledWith(taskData);
      expect(result).toEqual({ id: 'task-123' });
    });

    it('should complete task', async () => {
      const variables = { outcome: 'approved' };
      taskService.completeTask.mockResolvedValue({ success: true });

      const result = await service.completeTask(123, variables);

      expect(taskService.completeTask).toHaveBeenCalledWith(123, variables);
      expect(result).toEqual({ success: true });
    });

    it('should claim task', async () => {
      await service.claimTask(123, 'user1');

      expect(taskService.claimTask).toHaveBeenCalledWith(123, 'user1');
    });

    it('should unclaim task', async () => {
      await service.unclaimTask(123);

      expect(taskService.unclaimTask).toHaveBeenCalledWith(123);
    });

    it('should delegate task', async () => {
      await service.delegateTask(123, 'user2');

      expect(taskService.delegateTask).toHaveBeenCalledWith(123, 'user2');
    });

    it('should assign task to candidate group', async () => {
      taskService.assignTaskToCandidateGroup.mockResolvedValue({ success: true });

      const result = await service.assignTaskToCandidateGroup(123, 'group1');

      expect(taskService.assignTaskToCandidateGroup).toHaveBeenCalledWith(123, 'group1');
      expect(result).toEqual({ success: true });
    });

    it('should get task identity links', async () => {
      const links = [{ type: 'candidate', groupId: 'group1' }];
      taskService.getTaskIdentityLinks.mockResolvedValue(links);

      const result = await service.getTaskIdentityLinks(123);

      expect(taskService.getTaskIdentityLinks).toHaveBeenCalledWith(123);
      expect(result).toEqual(links);
    });

    it('should get candidate group tasks', async () => {
      const tasks = [{ id: 'task1', candidateGroups: ['group1'] }];
      taskService.getCandidateGroupTasks.mockResolvedValue(tasks);

      const result = await service.getCandidateGroupTasks('group1', true);

      expect(taskService.getCandidateGroupTasks).toHaveBeenCalledWith('group1', true);
      expect(result).toEqual(tasks);
    });

    it('should get user tasks', async () => {
      const tasks = [{ id: 'task1', assignee: 'user1' }];
      taskService.getUserTasks.mockResolvedValue(tasks);

      const result = await service.getUserTasks('user1', false);

      expect(taskService.getUserTasks).toHaveBeenCalledWith('user1', false);
      expect(result).toEqual(tasks);
    });

    it('should get task', async () => {
      taskService.getTask.mockResolvedValue({ id: 'task1' });

      const result = await service.getTask(123);

      expect(taskService.getTask).toHaveBeenCalledWith(123);
      expect(result).toEqual({ id: 'task1' });
    });

    it('should set task variables', async () => {
      const variables = { status: 'in-progress' };
      taskService.setTaskVariables.mockResolvedValue({ success: true });

      const result = await service.setTaskVariables(123, variables);

      expect(taskService.setTaskVariables).toHaveBeenCalledWith(123, variables);
      expect(result).toEqual({ success: true });
    });

    it('should get task variables', async () => {
      const variables = { status: 'in-progress', assignee: 'user1' };
      utilitiesService.getTaskVariables.mockResolvedValue(variables);

      const result = await service.getTaskVariables(123);

      expect(utilitiesService.getTaskVariables).toHaveBeenCalledWith(123);
      expect(result).toEqual(variables);
    });

    it('should update task variable', async () => {
      taskService.updateTaskVariable.mockResolvedValue({ success: true });

      const result = await service.updateTaskVariable(123, 'status', 'completed');

      expect(taskService.updateTaskVariable).toHaveBeenCalledWith(123, 'status', 'completed');
      expect(result).toEqual({ success: true });
    });

    it('should delete task variable', async () => {
      await service.deleteTaskVariable(123, 'temp_var');

      expect(taskService.deleteTaskVariable).toHaveBeenCalledWith(123, 'temp_var');
    });
  });

  describe('Event Handlers', () => {
    it('should handle case created event', async () => {
      const event = {
        caseId: 123,
        tenantId: 'tenant1',
        creationType: 'MANUAL',
        caseStatus: 'OPEN',
        creatorRole: 'ANALYST',
      };
      processService.startProcessInstance.mockResolvedValue({ id: 'process-123' });

      await service.handleCaseCreated(event as any);

      expect(processService.startProcessInstance).toHaveBeenCalledWith(
        'caseManagementProcess',
        expect.objectContaining({
          caseId: 123,
          tenantId: 'tenant1',
          creationType: 'MANUAL',
        }),
        123,
        'tenant1',
      );
      expect(loggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('Started process'),
        'CaseEventListener',
      );
    });

    it('should handle case status changed event', async () => {
      const event = { caseId: 123, oldStatus: 'OPEN', newStatus: 'IN_PROGRESS' };

      await service.handleCaseStatusChanged(event as any);

      expect(caseEventListener.handleCaseStatusChanged).toHaveBeenCalledWith(event);
    });

    it('should handle case abandoned event', async () => {
      const event = { caseId: 123, reason: 'Duplicate' };

      await service.handleCaseAbandoned(event as any);

      expect(caseEventListener.handleCaseAbandoned).toHaveBeenCalledWith(event);
    });

    it('should handle task completed event', async () => {
      const event = { taskId: 123, completedBy: 'user1' };

      await service.handleTaskCompleted(event as any);

      expect(taskEventListener.handleTaskCompleted).toHaveBeenCalledWith(event);
    });

    it('should handle task assigned event', async () => {
      const event = { taskId: 123, assignedTo: 'user1' };

      await service.handleTaskAssigned(event as any);

      expect(taskEventListener.handleTaskAssigned).toHaveBeenCalledWith(event);
    });

    it('should handle task unassigned event', async () => {
      const event = { taskId: 123, previousAssignee: 'user1' };

      await service.handleTaskUnassigned(event as any);

      expect(taskEventListener.handleTaskUnassigned).toHaveBeenCalledWith(event);
    });

    it('should handle case suspended event', async () => {
      const event = { caseId: 123, reason: 'Pending review' };

      await service.handleSuspendCase(event as any);

      expect(caseEventListener.handleSuspendCase).toHaveBeenCalledWith(event);
    });
  });
});
