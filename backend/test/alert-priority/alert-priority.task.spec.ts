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

  it('should call AlertPriorityService.runRecalculation on handleCron', async () => {
    await task.handleCron();

    expect(mockAlertPriorityService.runRecalculation).toHaveBeenCalledTimes(1);
  });

  it('should handle errors in runRecalculation gracefully', async () => {
    const error = new Error('Service error');
    mockAlertPriorityService.runRecalculation.mockRejectedValue(error);

    // Should not throw error
    await expect(task.handleCron()).resolves.not.toThrow();
    expect(mockAlertPriorityService.runRecalculation).toHaveBeenCalledTimes(1);
  });
});
