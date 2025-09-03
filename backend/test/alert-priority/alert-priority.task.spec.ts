/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { AlertPriorityTask } from '../../src/alert-priority/alert-priority.task';
import { AlertPriorityService } from '../../src/alert-priority/alert-priority.service';

describe('AlertPriorityTask', () => {
  let task: AlertPriorityTask;
  let mockAlertPriorityService: jest.Mocked<AlertPriorityService>;

  beforeEach(async () => {
    mockAlertPriorityService = {
      runRecalculation: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertPriorityTask,
        { provide: AlertPriorityService, useValue: mockAlertPriorityService },
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

  it('should call AlertPriorityService.runRecalculation on handleHourlyCron', async () => {
    await task.handleHourlyCron();

    expect(mockAlertPriorityService.runRecalculation).toHaveBeenCalledTimes(1);
  });

  it('should handle errors in runRecalculation gracefully', async () => {
    const error = new Error('Service error');
    const loggerSpy = jest.spyOn(task['logger'], 'error');
    mockAlertPriorityService.runRecalculation.mockRejectedValue(error);

    // Should not throw error
    await expect(task.handleHourlyCron()).resolves.not.toThrow();
    expect(mockAlertPriorityService.runRecalculation).toHaveBeenCalledTimes(1);
    expect(loggerSpy).toHaveBeenCalledWith('Error in hourly alert priority recalculation task:', error);
  });

  it('should log when starting hourly task', async () => {
    const loggerSpy = jest.spyOn(task['logger'], 'log');

    await task.handleHourlyCron();

    expect(loggerSpy).toHaveBeenCalledWith('Running hourly alert priority recalculation task');
    expect(mockAlertPriorityService.runRecalculation).toHaveBeenCalledTimes(1);
  });
});
