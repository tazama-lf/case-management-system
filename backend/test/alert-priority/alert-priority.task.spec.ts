 
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { AlertPriorityTask } from '../../src/modules/alert-priority/alert-priority.task';
import { AlertPriorityService } from '../../src/modules/alert-priority/alert-priority.service';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';

describe('AlertPriorityTask', () => {
  let task: AlertPriorityTask;
  let mockAlertPriorityService: jest.Mocked<AlertPriorityService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockSchedulerRegistry: jest.Mocked<SchedulerRegistry>;

  beforeEach(async () => {
    mockAlertPriorityService = {
      runRecalculation: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockConfigService = {
      get: jest.fn().mockReturnValue('0 * * * *'),
    } as any;

    mockSchedulerRegistry = {
      addCronJob: jest.fn(),
      getCronJob: jest.fn(),
      deleteCronJob: jest.fn(),
      getCronJobs: jest.fn() as any,
      addInterval: jest.fn() as any,
      getInterval: jest.fn() as any,
      deleteInterval: jest.fn() as any,
      getIntervals: jest.fn() as any,
      addTimeout: jest.fn() as any,
      getTimeout: jest.fn() as any,
      deleteTimeout: jest.fn() as any,
      getTimeouts: jest.fn() as any,
      doesExist: jest.fn() as any,
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertPriorityTask,
        { provide: AlertPriorityService, useValue: mockAlertPriorityService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SchedulerRegistry, useValue: mockSchedulerRegistry },
      ],
    }).compile();

    task = module.get<AlertPriorityTask>(AlertPriorityTask);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(task).toBeDefined();
  });

  it('should call AlertPriorityService.runRecalculation on handleAlertPriorityUpdate', async () => {
    await task.handleAlertPriorityUpdate();
    expect(mockAlertPriorityService.runRecalculation).toHaveBeenCalledTimes(1);
  });

  it('should propagate errors from runRecalculation', async () => {
    const error = new Error('Service error');
    mockAlertPriorityService.runRecalculation.mockRejectedValue(error);

    // Expect the method to reject because the task does not catch errors
    await expect(task.handleAlertPriorityUpdate()).rejects.toThrow('Service error');
    expect(mockAlertPriorityService.runRecalculation).toHaveBeenCalledTimes(1);
  });

  it('should log when starting and completing alert priority update task', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await task.handleAlertPriorityUpdate();

    expect(consoleSpy).toHaveBeenCalledWith('Running alert priority update task...');
    expect(mockAlertPriorityService.runRecalculation).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('Alert priority update task completed.');

    consoleSpy.mockRestore();
  });
});
