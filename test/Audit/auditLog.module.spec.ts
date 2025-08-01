import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogModule } from '../../src/audit/auditLog.module';
import { AuditLogService } from '../../src/audit/auditLog.service';
import { PrismaModule } from '../../prisma/prisma.module';

describe('AuditLogModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AuditLogModule, PrismaModule],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide AuditLogService', () => {
    const auditLogService = module.get<AuditLogService>(AuditLogService);
    expect(auditLogService).toBeDefined();
    expect(auditLogService).toBeInstanceOf(AuditLogService);
  });

  it('should export AuditLogService', () => {
    const auditLogService = module.get<AuditLogService>(AuditLogService);
    expect(auditLogService).toBeDefined();
  });

  it('should import PrismaModule', () => {
    const moduleMetadata = Reflect.getMetadata('imports', AuditLogModule);
    expect(moduleMetadata).toContain(PrismaModule);
  });

  it('should have correct module configuration', () => {
    const moduleMetadata = Reflect.getMetadata('providers', AuditLogModule);
    const exportsMetadata = Reflect.getMetadata('exports', AuditLogModule);
<<<<<<< HEAD

=======
    
>>>>>>> 68856f4 (feat: Test Coverage)
    expect(moduleMetadata).toContain(AuditLogService);
    expect(exportsMetadata).toContain(AuditLogService);
  });
});
