import { Test, TestingModule } from '@nestjs/testing';
import { WorkqueueService } from '../../src/modules/workqueue/workqueue.service';

describe('WorkqueueService', () => {
  let service: WorkqueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkqueueService],
    }).compile();

    service = module.get<WorkqueueService>(WorkqueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
