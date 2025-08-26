import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { Test, TestingModule } from '@nestjs/testing';
import { TriageModule } from '../../src/triage/triage.module';
import { TriageController } from '../../src/triage/triage.controller';
import { TriageService } from '../../src/triage/triage.service';
import { AuditLogService } from '../../src/audit/auditLog.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';

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
    log: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [TriageModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(AuditLogService)
      .useValue(mockAuditLogService)
      .overrideProvider(LoggerService)
      .useValue(mockLoggerService)
      .compile();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
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
    expect(auditService).toHaveProperty('log');
    expect(auditService).toHaveProperty('create');
  });

  it('should import PrismaModule', () => {
    const imports = Reflect.getMetadata('imports', TriageModule) || [];
    expect(imports).toContain(PrismaModule);
  });

  it('should export the correct providers', () => {
    const providers = Reflect.getMetadata('providers', TriageModule) || [];
    expect(providers).toEqual(expect.arrayContaining([TriageService, AuditLogService]));
  });

  it('should have the correct controllers', () => {
    const controllers = Reflect.getMetadata('controllers', TriageModule) || [];
    expect(controllers).toEqual(expect.arrayContaining([TriageController]));
  });
});
