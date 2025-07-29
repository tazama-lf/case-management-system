import { Test, TestingModule } from '@nestjs/testing';
import { TriageService } from '../src/triage/triage.service';
import { PrismaService } from 'prisma/prisma.service';

describe('TriageService - Tenant Isolation', () => {
  let service: TriageService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TriageService, PrismaService],
    }).compile();

    service = module.get<TriageService>(TriageService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  
});
