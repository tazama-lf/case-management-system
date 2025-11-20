import { Test, TestingModule } from '@nestjs/testing';
import { WorkqueueController } from '../../src/modules/workqueue/workqueue.controller';

describe('WorkqueueController', () => {
  let controller: WorkqueueController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkqueueController],
    }).compile();

    controller = module.get<WorkqueueController>(WorkqueueController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
