import { Test, TestingModule } from '@nestjs/testing';
import { TaskSyncService } from '../../src/modules/task-sync/task-sync.service';

describe('TaskSyncService', () => {
  let service: TaskSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskSyncService],
    }).compile();

    service = module.get<TaskSyncService>(TaskSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
