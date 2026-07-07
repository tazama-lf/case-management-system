import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { InvestigationGroupService } from '../src/modules/investigation-group/investigation-group.service';

describe('InvestigationGroupService', () => {
  let service: InvestigationGroupService;
  let prismaService: {
    investigationGroup: {
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaService = {
      investigationGroup: {
        create: jest.fn(),
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
      prismaService.investigationGroup.create.mockResolvedValue({ id: 123 });

      const result = await service.createInvestigationGroup(1, 'tenant-123');

      expect(result).toEqual({ id: 123 });
      expect(prismaService.investigationGroup.create).toHaveBeenCalledTimes(1);
      expect(prismaService.investigationGroup.create).toHaveBeenCalledWith({
        data: {
          alert_id: 1,
          tenant_id: 'tenant-123',
        },
        select: {
          id: true,
        },
      });
    });

    it('should propagate Prisma errors', async () => {
      const error = new Error('Database error');
      prismaService.investigationGroup.create.mockRejectedValue(error);

      await expect(service.createInvestigationGroup(1, 'tenant-123')).rejects.toThrow(error);
    });
  });
});
