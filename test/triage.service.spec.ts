import { Test, TestingModule } from '@nestjs/testing';
import { TriageService } from '../src/triage/triage.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../src/audit/auditLog.service';

describe('TriageService - Tenant Isolation', () => {
  let service: TriageService;
  let prisma: PrismaService;
  let auditService: AuditLogService;

  // Mock implementations
  const mockPrismaService = {
    alert: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockAuditLogService = {
    logAction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TriageService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<TriageService>(TriageService);
    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(prisma).toBeDefined();
    expect(auditService).toBeDefined();
  });
});
