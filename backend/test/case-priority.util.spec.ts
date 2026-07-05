import { Test, TestingModule } from '@nestjs/testing';
import { CasePriorityUtil, FALLBACK_HIGH_THRESHOLD, FALLBACK_MEDIUM_THRESHOLD } from '../src/modules/shared/utils/case-priority.util';
import { DEFAULT_TENANT_KEY } from '../src/modules/shared/utils/sla-policy.util';
import { PrismaService } from '../prisma/prisma.service';
import { Priority } from '@prisma/client-cms';

describe('CasePriorityUtil', () => {
  let service: CasePriorityUtil;
  let prismaService: { casePriorityThreshold: { findUnique: jest.Mock } };

  beforeEach(async () => {
    const mockPrismaService = {
      casePriorityThreshold: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CasePriorityUtil, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<CasePriorityUtil>(CasePriorityUtil);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getThresholds', () => {
    it('returns the tenant-specific thresholds when a row exists', async () => {
      prismaService.casePriorityThreshold.findUnique.mockResolvedValueOnce({ high_threshold: 0.8, medium_threshold: 0.5 });

      const result = await service.getThresholds('tenant-1');

      expect(result).toEqual({ highThreshold: 0.8, mediumThreshold: 0.5 });
      expect(prismaService.casePriorityThreshold.findUnique).toHaveBeenCalledWith({ where: { tenant_id: 'tenant-1' } });
    });

    it('falls back to the DEFAULT tenant thresholds when no tenant-specific row exists', async () => {
      prismaService.casePriorityThreshold.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ high_threshold: 0.6, medium_threshold: 0.3 });

      const result = await service.getThresholds('tenant-1');

      expect(result).toEqual({ highThreshold: 0.6, mediumThreshold: 0.3 });
      expect(prismaService.casePriorityThreshold.findUnique).toHaveBeenNthCalledWith(2, { where: { tenant_id: DEFAULT_TENANT_KEY } });
    });

    it('falls back to the hardcoded constants when neither tenant nor DEFAULT thresholds exist', async () => {
      prismaService.casePriorityThreshold.findUnique.mockResolvedValue(null);

      const result = await service.getThresholds('tenant-1');

      expect(result).toEqual({ highThreshold: FALLBACK_HIGH_THRESHOLD, mediumThreshold: FALLBACK_MEDIUM_THRESHOLD });
    });
  });

  describe('determinePriority', () => {
    it('returns HIGH at or above the high threshold', async () => {
      prismaService.casePriorityThreshold.findUnique.mockResolvedValue(null); // fallback 0.7/0.4

      expect(await service.determinePriority(0.7, 'tenant-1')).toBe(Priority.HIGH);
      expect(await service.determinePriority(0.95, 'tenant-1')).toBe(Priority.HIGH);
    });

    it('returns MEDIUM between the medium and high thresholds', async () => {
      prismaService.casePriorityThreshold.findUnique.mockResolvedValue(null);

      expect(await service.determinePriority(0.4, 'tenant-1')).toBe(Priority.MEDIUM);
      expect(await service.determinePriority(0.69, 'tenant-1')).toBe(Priority.MEDIUM);
    });

    it('returns LOW below the medium threshold', async () => {
      prismaService.casePriorityThreshold.findUnique.mockResolvedValue(null);

      expect(await service.determinePriority(0, 'tenant-1')).toBe(Priority.LOW);
      expect(await service.determinePriority(0.39, 'tenant-1')).toBe(Priority.LOW);
    });

    it("applies tenant-specific thresholds instead of the global default", async () => {
      // Score 0.5 would be MEDIUM under the default thresholds (0.7/0.4), but this
      // tenant's stricter high threshold (0.5) should classify it as HIGH instead.
      prismaService.casePriorityThreshold.findUnique.mockResolvedValueOnce({ high_threshold: 0.5, medium_threshold: 0.3 });

      const result = await service.determinePriority(0.5, 'tenant-strict');

      expect(prismaService.casePriorityThreshold.findUnique).toHaveBeenCalledWith({ where: { tenant_id: 'tenant-strict' } });
      expect(result).toBe(Priority.HIGH);
    });
  });
});
