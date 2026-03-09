import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FlowableService } from '../src/modules/flowable/flowable.service';
import { FlowableProcessService } from '../src/modules/flowable/services/flowable-process.service';
import { FlowableClientFactory } from '../src/modules/flowable/services/flowable-client.factory';
import { CaseEventListener } from '../src/modules/flowable/listeners/case-event.listener';
import { TaskEventListener } from '../src/modules/flowable/listeners/task-event.listener';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import * as fs from 'node:fs/promises';

jest.mock('node:fs/promises');

describe('FlowableService', () => {
  let service: FlowableService;
  let configService: jest.Mocked<ConfigService>;
  let loggerService: jest.Mocked<LoggerService>;
  let processService: jest.Mocked<FlowableProcessService>;
  let caseEventListener: jest.Mocked<CaseEventListener>;
  let taskEventListener: jest.Mocked<TaskEventListener>;

  const mockFlowableClient = {
    get: jest.fn(),
    post: jest.fn(),
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
    processService = module.get(FlowableProcessService);
    caseEventListener = module.get(CaseEventListener);
    taskEventListener = module.get(TaskEventListener);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    const initTestCases = [
      {
        description: 'should skip initialization when Flowable is disabled',
        flowableEnabled: false,
        expectSkip: true,
      },
      {
        description: 'should initialize successfully on first attempt',
        flowableEnabled: true,
        setupMocks: (client: any) => {
          client.get.mockResolvedValue({ data: { data: [] } });
          client.post.mockResolvedValue({ data: { id: 'deployment-123' } });
          (fs.readFile as jest.Mock).mockResolvedValue('<bpmn>test</bpmn>');
        },
        expectSuccess: true,
      },
    ];

    test.each(initTestCases)('$description', async ({ flowableEnabled, expectSkip, setupMocks, expectSuccess }) => {
      configService.get.mockReturnValue(flowableEnabled);

      if (setupMocks) {
        setupMocks(mockFlowableClient);
      }

      await service.onModuleInit();

      if (expectSkip) {
        expect(loggerService.log).toHaveBeenCalledWith(
          'Flowable is disabled via configuration, skipping initialization',
          'FlowableService',
        );
        expect(mockFlowableClient.get).not.toHaveBeenCalled();
      }

      if (expectSuccess) {
        expect(loggerService.log).toHaveBeenCalledWith('Flowable initialized successfully', 'FlowableService');
      }
    });

    it('should deploy BPMN successfully', async () => {
      configService.get.mockReturnValue(true);
      mockFlowableClient.get.mockResolvedValue({ data: { data: [] } });
      (fs.readFile as jest.Mock).mockResolvedValue('<bpmn>test</bpmn>');
      mockFlowableClient.post.mockResolvedValue({ data: { id: 'deployment-123' } });

      await service.onModuleInit();

      expect(fs.readFile).toHaveBeenCalled();
      expect(mockFlowableClient.post).toHaveBeenCalled();
      expect(loggerService.log).toHaveBeenCalledWith('BPMN process deployed successfully: deployment-123', 'FlowableService');
    });
  });

  describe('healthCheck', () => {
    const healthCheckCases = [
      {
        description: 'should return healthy status on successful connection',
        mockSetup: (client: any) => client.get.mockResolvedValue({ data: { data: [] } }),
        expected: { status: 'healthy' },
        shouldThrow: false,
      },
      {
        description: 'should handle ECONNREFUSED error',
        mockSetup: (client: any) => client.get.mockRejectedValue({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' }),
        errorMessage: 'Cannot connect to Flowable server',
        shouldThrow: true,
      },
      {
        description: 'should handle ECONNRESET error',
        mockSetup: (client: any) => client.get.mockRejectedValue({ code: 'ECONNRESET', message: 'Connection reset' }),
        errorMessage: 'Connection reset by Flowable server',
        shouldThrow: true,
      },
      {
        description: 'should handle generic error',
        mockSetup: (client: any) => client.get.mockRejectedValue(new Error('Network error')),
        errorMessage: 'Network error',
        shouldThrow: true,
      },
    ];

    test.each(healthCheckCases)('$description', async ({ mockSetup, expected, shouldThrow, errorMessage }) => {
      mockSetup(mockFlowableClient);

      if (shouldThrow) {
        await expect(service.healthCheck()).rejects.toThrow(errorMessage);
      } else {
        const result = await service.healthCheck();
        expect(result).toEqual(expected);
        expect(loggerService.log).toHaveBeenCalledWith('Flowable health check passed', 'FlowableService');
      }
    });
  });

  describe('startProcessInstance', () => {
    it('should start process instance', async () => {
      const processData = { id: 'process-123' };
      processService.startProcessInstance.mockResolvedValue(processData);

      const result = await service.startProcessInstance('caseManagementProcess', { caseId: '123' }, 123, 'tenant1');

      expect(processService.startProcessInstance).toHaveBeenCalledWith('caseManagementProcess', { caseId: '123' }, 123, 'tenant1');
      expect(result).toEqual(processData);
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
        isReopened: false,
        isFraudNAML: false,
      };
      processService.startProcessInstance.mockResolvedValue({ id: 'process-123' });

      await service.handleCaseCreated(event as any);

      expect(processService.startProcessInstance).toHaveBeenCalledWith(
        'caseManagementProcess',
        expect.objectContaining({
          caseId: '123',
          tenantId: 'tenant1',
          creationType: 'MANUAL',
        }),
        123,
        'tenant1',
      );
      expect(loggerService.log).toHaveBeenCalledWith(expect.stringContaining('Started process'), 'CaseEventListener');
    });

    const eventHandlerCases = [
      {
        description: 'should handle case status changed event',
        method: 'handleCaseStatusChanged',
        event: { caseId: 123, oldStatus: 'OPEN', newStatus: 'IN_PROGRESS' },
        listener: 'caseEventListener',
      },
      {
        description: 'should handle case abandoned event',
        method: 'handleCaseAbandoned',
        event: { caseId: 123, reason: 'Duplicate' },
        listener: 'caseEventListener',
      },
      {
        description: 'should handle task completed event',
        method: 'handleTaskCompleted',
        event: { taskId: 123, completedBy: 'user1' },
        listener: 'taskEventListener',
      },
      {
        description: 'should handle task assigned event',
        method: 'handleTaskAssigned',
        event: { taskId: 123, assignedTo: 'user1' },
        listener: 'taskEventListener',
      },
      {
        description: 'should handle task unassigned event',
        method: 'handleTaskUnassigned',
        event: { taskId: 123, previousAssignee: 'user1' },
        listener: 'taskEventListener',
      },
    ];

    test.each(eventHandlerCases)('$description', async ({ method, event, listener }) => {
      await (service as any)[method](event);

      const listenerInstance = listener === 'caseEventListener' ? caseEventListener : taskEventListener;
      expect((listenerInstance as any)[method]).toHaveBeenCalledWith(event);
    });
  });
});
