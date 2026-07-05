import { Test, TestingModule } from '@nestjs/testing';
import { SlaPolicyUtil, DEFAULT_SLA_TENANT_KEY, FALLBACK_DUE_SOON_RATIO, FALLBACK_AT_RISK_RATIO } from '../src/modules/shared/utils/sla-policy.util';
import { PrismaService } from '../prisma/prisma.service';
import { Priority } from '@prisma/client-cms';

describe('SlaPolicyUtil', () => {
  let service: SlaPolicyUtil;
  let prismaService: {
    slaPolicy: { findFirst: jest.Mock };
    slaEscalationThreshold: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    const mockPrismaService = {
      slaPolicy: { findFirst: jest.fn() },
      slaEscalationThreshold: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SlaPolicyUtil, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<SlaPolicyUtil>(SlaPolicyUtil);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTargetHours', () => {
    it('returns the tenant-specific policy when one exists', async () => {
      prismaService.slaPolicy.findFirst.mockResolvedValueOnce({ target_hours: 12 });

      const result = await service.getTargetHours('tenant-1', Priority.HIGH);

      expect(result).toBe(12);
      expect(prismaService.slaPolicy.findFirst).toHaveBeenCalledWith({ where: { tenant_id: 'tenant-1', priority: Priority.HIGH } });
    });

    it('falls back to the DEFAULT tenant policy when no tenant-specific row exists', async () => {
      prismaService.slaPolicy.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ target_hours: 36 });

      const result = await service.getTargetHours('tenant-1', Priority.MEDIUM);

      expect(result).toBe(36);
      expect(prismaService.slaPolicy.findFirst).toHaveBeenNthCalledWith(2, {
        where: { tenant_id: DEFAULT_SLA_TENANT_KEY, priority: Priority.MEDIUM },
      });
    });

    it('falls back to the hardcoded constant when neither tenant nor DEFAULT policy exists', async () => {
      prismaService.slaPolicy.findFirst.mockResolvedValue(null);

      expect(await service.getTargetHours('tenant-1', Priority.HIGH)).toBe(24);
      expect(await service.getTargetHours('tenant-1', Priority.MEDIUM)).toBe(72);
      expect(await service.getTargetHours('tenant-1', Priority.LOW)).toBe(168);
    });
  });

  describe('calculateSlaDueAt', () => {
    it('adds the resolved target hours to created_at', async () => {
      prismaService.slaPolicy.findFirst.mockResolvedValueOnce({ target_hours: 10 });
      const createdAt = new Date('2026-01-01T00:00:00.000Z');

      const dueAt = await service.calculateSlaDueAt(createdAt, 'tenant-1', Priority.HIGH);

      expect(dueAt).toEqual(new Date('2026-01-01T10:00:00.000Z'));
    });
  });

  describe('getEscalationRatios', () => {
    it('returns the tenant-specific thresholds when a row exists', async () => {
      prismaService.slaEscalationThreshold.findUnique.mockResolvedValueOnce({ due_soon_ratio: 0.3, at_risk_ratio: 0.6 });

      const result = await service.getEscalationRatios('tenant-1');

      expect(result).toEqual({ dueSoonRatio: 0.3, atRiskRatio: 0.6 });
      expect(prismaService.slaEscalationThreshold.findUnique).toHaveBeenCalledWith({ where: { tenant_id: 'tenant-1' } });
    });

    it('falls back to the DEFAULT tenant thresholds when no tenant-specific row exists', async () => {
      prismaService.slaEscalationThreshold.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ due_soon_ratio: 0.25, at_risk_ratio: 0.55 });

      const result = await service.getEscalationRatios('tenant-1');

      expect(result).toEqual({ dueSoonRatio: 0.25, atRiskRatio: 0.55 });
      expect(prismaService.slaEscalationThreshold.findUnique).toHaveBeenNthCalledWith(2, { where: { tenant_id: DEFAULT_SLA_TENANT_KEY } });
    });

    it('falls back to the hardcoded constants when neither tenant nor DEFAULT thresholds exist', async () => {
      prismaService.slaEscalationThreshold.findUnique.mockResolvedValue(null);

      const result = await service.getEscalationRatios('tenant-1');

      expect(result).toEqual({ dueSoonRatio: FALLBACK_DUE_SOON_RATIO, atRiskRatio: FALLBACK_AT_RISK_RATIO });
    });
  });
});
