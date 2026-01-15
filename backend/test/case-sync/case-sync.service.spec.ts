import { Test, TestingModule } from '@nestjs/testing';
import { CaseSyncService } from '../../src/modules/case-sync/case-sync.service';

describe('CaseSyncService', () => {
  let service: CaseSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CaseSyncService],
    }).compile();

    service = module.get<CaseSyncService>(CaseSyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
