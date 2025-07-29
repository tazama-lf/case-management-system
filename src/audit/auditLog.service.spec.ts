import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './auditLog.service';
import { PrismaService } from 'prisma/prisma.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = { auditLog: { create: jest.fn() } } as any;
    service = new AuditLogService(prisma);
  });

  it('should include tenantId in audit log', async () => {
    await service.logAction({
      userId: 'user-1',
      tenantId: 'tenant-1',
      username: 'test',
      operation: 'test',
      entityName: 'case',
      actionPerformed: 'view',
      outcome: 'success',
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    );
  });
});
