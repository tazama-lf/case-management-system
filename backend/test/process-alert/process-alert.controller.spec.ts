import { Test, TestingModule } from '@nestjs/testing';
import { ProcessAlertController } from '../../src/modules/process-alert/process-alert.controller';

describe('ProcessAlertController', () => {
  let controller: ProcessAlertController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcessAlertController],
    }).compile();

    controller = module.get<ProcessAlertController>(ProcessAlertController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
