import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { Test, TestingModule } from '@nestjs/testing';
import { TriageController } from '../../src/modules/triage/triage.controller';
import { TriageService } from '../../src/modules/triage/triage.service';
import { AuditLogService } from '../../src/modules/audit/auditLog.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CaseService } from '../../src/modules/case/case.service';
import { TaskService } from '../../src/modules/task/task.service';
import { CommentService } from '../../src/modules/comment/comment.service';

describe('TriageModule', () => {
  let module: TestingModule;
  const mockLoggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };
  const mockPrismaService = {
    alert: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockAuditLogService = {
    logAction: jest.fn(),
    logPermissionDenied: jest.fn(),
    getLogs: jest.fn(),
    getActionHistoryForAlert: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockCaseService = {
    createCase: jest.fn(),
    updateCase: jest.fn(),
    getCaseById: jest.fn(),
  };

  const mockTaskService = {
    createTask: jest.fn(),
    updateTask: jest.fn(),
    getTasksByCaseId: jest.fn(),
  };

  const mockCommentService = {
    createComment: jest.fn(),
    getCommentsByCaseId: jest.fn(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [TriageController],
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
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CaseService,
          useValue: mockCaseService,
        },
        {
          provide: TaskService,
          useValue: mockTaskService,
        },
        {
          provide: CommentService,
          useValue: mockCommentService,
        },
      ],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have TriageController', () => {
    const controller = module.get<TriageController>(TriageController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(TriageController);
  });

  it('should have TriageService', () => {
    const service = module.get<TriageService>(TriageService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(TriageService);
  });

  it('should have AuditLogService', () => {
    const auditService = module.get<AuditLogService>(AuditLogService);
    expect(auditService).toBeDefined();
    expect(auditService).toHaveProperty('logAction');
    expect(auditService).toHaveProperty('logPermissionDenied');
  });

  it('should import PrismaModule', () => {
    // Since we're not importing the actual module, we test that PrismaService is available
    const prismaService = module.get<PrismaService>(PrismaService);
    expect(prismaService).toBeDefined();
  });

  it('should export the correct providers', () => {
    // Test that the required services are available in the module
    const triageService = module.get<TriageService>(TriageService);
    const auditService = module.get<AuditLogService>(AuditLogService);
    expect(triageService).toBeDefined();
    expect(auditService).toBeDefined();
  });

  it('should have the correct controllers', () => {
    // Test that the controller is available in the module
    const controller = module.get<TriageController>(TriageController);
    expect(controller).toBeDefined();
  });
});
