import { Test, TestingModule } from '@nestjs/testing';
import { ProcessAlertService } from '../../src/modules/process-alert/process-alert.service';

describe('ProcessAlertService', () => {
  let service: ProcessAlertService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProcessAlertService],
    }).compile();

    service = module.get<ProcessAlertService>(ProcessAlertService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
