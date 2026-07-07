import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { InvestigationGroupService } from '../src/modules/investigation-group/investigation-group.service';

describe('InvestigationGroupService', () => {
  let service: InvestigationGroupService;
  let prismaService: {
    investigationGroup: {
      upsert: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaService = {
      investigationGroup: {
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [InvestigationGroupService, { provide: PrismaService, useValue: prismaService }],
    }).compile();

    service = module.get<InvestigationGroupService>(InvestigationGroupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createInvestigationGroup', () => {
    it('should create an investigation group record', async () => {
      prismaService.investigationGroup.upsert.mockResolvedValue({ id: 123 });

      const result = await service.createInvestigationGroup(1, 'tenant-123');

      expect(result).toEqual({ id: 123 });
      expect(prismaService.investigationGroup.upsert).toHaveBeenCalledTimes(1);
      expect(prismaService.investigationGroup.upsert).toHaveBeenCalledWith({
        where: { alert_id: 1 },
        create: {
          alert_id: 1,
          tenant_id: 'tenant-123',
        },
        update: {},
        select: {
          id: true,
        },
      });
    });

    it('should return existing group if one already exists for the alert (upsert)', async () => {
      prismaService.investigationGroup.upsert.mockResolvedValue({ id: 999 });

      const result = await service.createInvestigationGroup(1, 'tenant-123');

      expect(result).toEqual({ id: 999 });
      expect(prismaService.investigationGroup.upsert).toHaveBeenCalledTimes(1);
    });

    it('should propagate Prisma errors', async () => {
      const error = new Error('Database error');
      prismaService.investigationGroup.upsert.mockRejectedValue(error);

      await expect(service.createInvestigationGroup(1, 'tenant-123')).rejects.toThrow(error);
    });
  });
});
