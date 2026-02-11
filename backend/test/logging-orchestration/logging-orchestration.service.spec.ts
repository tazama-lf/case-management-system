import { Test, TestingModule } from '@nestjs/testing';
import { LoggingOrchestrationService } from 'src/modules/logging-orchestration/logging-orchestration.service';

describe('LoggingOrchestrationService', () => {
  let service: LoggingOrchestrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingOrchestrationService],
    }).compile();

    service = module.get<LoggingOrchestrationService>(LoggingOrchestrationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
