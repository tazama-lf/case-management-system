import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from '../src/modules/admin/admin.service';
import { AdminRepository } from '../src/modules/repository/admin.repository';
import { Prisma } from '@prisma/client-cms';

describe('AdminService', () => {
  let service: AdminService;
  let adminRepository: jest.Mocked<AdminRepository>;

  const mockReferenceId = {
    id: 1,
    txTp: 'pacs.002.001.12',
    referenceIdName: 'EndToEndId',
    createdAt: new Date('2026-01-01'),
  };

  const mockReferenceIds = [
    {
      id: 1,
      txTp: 'pacs.002.001.12',
      referenceIdName: 'EndToEndId',
      createdAt: new Date('2026-01-01'),
    },
    {
      id: 2,
      txTp: 'pacs.008.001.10',
      referenceIdName: 'InstrId',
      createdAt: new Date('2026-01-02'),
    },
    {
      id: 3,
      txTp: 'pain.001.001.11',
      referenceIdName: 'MsgId',
      createdAt: new Date('2026-01-03'),
    },
  ];

  const createMockAdminRepository = () => ({
    registerReferenceId: jest.fn(),
    getReferenceId: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: AdminRepository,
          useValue: createMockAdminRepository(),
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    adminRepository = module.get(AdminRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerReferenceId', () => {
    const referenceIdData: Prisma.ReferenceIdCreateInput = {
      txTp: 'pacs.002.001.12',
      referenceIdName: 'EndToEndId',
    };

    it('should successfully register a reference ID', async () => {
      adminRepository.registerReferenceId.mockResolvedValue(mockReferenceId);

      const result = await service.registerReferenceId(referenceIdData);

      expect(result).toEqual(mockReferenceId);
      expect(adminRepository.registerReferenceId).toHaveBeenCalledWith(referenceIdData);
      expect(adminRepository.registerReferenceId).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['pacs.008.001.10', 'InstrId', 2, new Date('2026-01-02')],
      ['pain.001.001.11', 'MsgId', 3, new Date('2026-01-03')],
      ['pain.013.001.09', 'TxId', 4, new Date('2026-01-04')],
    ])('should register reference ID with txTp=%s and referenceIdName=%s', async (txTp, referenceIdName, id, createdAt) => {
      const data: Prisma.ReferenceIdCreateInput = { txTp, referenceIdName };
      const mockResult = { id, txTp, referenceIdName, createdAt };

      adminRepository.registerReferenceId.mockResolvedValue(mockResult);

      const result = await service.registerReferenceId(data);

      expect(result).toEqual(mockResult);
      expect(result.txTp).toBe(txTp);
      expect(result.referenceIdName).toBe(referenceIdName);
      expect(adminRepository.registerReferenceId).toHaveBeenCalledWith(data);
    });

    it.each([
      ['Database error', new Error('Database error')],
      ['Unique constraint violation', new Error('Unique constraint violation')],
      ['Query timeout', new Error('Query timeout')],
    ])('should handle %s and re-throw it', async (_desc, error) => {
      adminRepository.registerReferenceId.mockRejectedValue(error);

      await expect(service.registerReferenceId(referenceIdData)).rejects.toThrow(error.message);
      expect(adminRepository.registerReferenceId).toHaveBeenCalledWith(referenceIdData);
    });

    it('should handle non-Error exceptions', async () => {
      adminRepository.registerReferenceId.mockRejectedValue('String error');

      await expect(service.registerReferenceId(referenceIdData)).rejects.toBe('String error');
    });

    it('should return the complete reference ID object with all properties', async () => {
      adminRepository.registerReferenceId.mockResolvedValue(mockReferenceId);

      const result = await service.registerReferenceId(referenceIdData);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('txTp');
      expect(result).toHaveProperty('referenceIdName');
      expect(result).toHaveProperty('createdAt');
    });

    it('should handle null return from repository', async () => {
      adminRepository.registerReferenceId.mockResolvedValue(null as any);

      const result = await service.registerReferenceId(referenceIdData);
      expect(result).toBeNull();
    });
  });

  describe('getReferenceIds', () => {
    it('should successfully retrieve all reference IDs', async () => {
      adminRepository.getReferenceId.mockResolvedValue(mockReferenceIds);

      const result = await service.getReferenceIds();

      expect(result).toEqual(mockReferenceIds);
      expect(adminRepository.getReferenceId).toHaveBeenCalledTimes(1);
      expect(adminRepository.getReferenceId).toHaveBeenCalledWith();
    });

    it.each([
      ['empty array', []],
      ['single reference ID', [mockReferenceId]],
      ['multiple reference IDs', mockReferenceIds],
    ])('should return %s when repository returns it', async (_desc, mockData) => {
      adminRepository.getReferenceId.mockResolvedValue(mockData);

      const result = await service.getReferenceIds();

      expect(result).toEqual(mockData);
      expect(result).toHaveLength(mockData.length);
    });

    it('should return large number of reference IDs', async () => {
      const largeArray = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        txTp: `pacs.002.001.${i}`,
        referenceIdName: `EndToEndId_${i}`,
        createdAt: new Date('2026-01-01'),
      }));

      adminRepository.getReferenceId.mockResolvedValue(largeArray);

      const result = await service.getReferenceIds();

      expect(result).toHaveLength(100);
      expect(result).toEqual(largeArray);
    });

    it.each([
      ['Database connection failed', new Error('Database connection failed')],
      ['Network error', new Error('Network error')],
    ])('should handle %s and re-throw it', async (_desc, error) => {
      adminRepository.getReferenceId.mockRejectedValue(error);

      await expect(service.getReferenceIds()).rejects.toThrow(error.message);
      expect(adminRepository.getReferenceId).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error exceptions', async () => {
      adminRepository.getReferenceId.mockRejectedValue('String error');

      await expect(service.getReferenceIds()).rejects.toBe('String error');
    });

    it('should return reference IDs with correct structure', async () => {
      adminRepository.getReferenceId.mockResolvedValue(mockReferenceIds);

      const result = await service.getReferenceIds();

      result.forEach((referenceId) => {
        expect(referenceId).toHaveProperty('id');
        expect(referenceId).toHaveProperty('txTp');
        expect(referenceId).toHaveProperty('referenceIdName');
        expect(referenceId).toHaveProperty('createdAt');
      });
    });

    it('should return reference IDs sorted by creation date (if repository does so)', async () => {
      const sortedMockReferenceIds = [...mockReferenceIds].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      adminRepository.getReferenceId.mockResolvedValue(sortedMockReferenceIds);

      const result = await service.getReferenceIds();

      expect(result[0].createdAt).toEqual(new Date('2026-01-01'));
      expect(result[1].createdAt).toEqual(new Date('2026-01-02'));
      expect(result[2].createdAt).toEqual(new Date('2026-01-03'));
    });

    it('should handle undefined return from repository', async () => {
      adminRepository.getReferenceId.mockResolvedValue(undefined as any);

      const result = await service.getReferenceIds();
      expect(result).toBeUndefined();
    });
  });

  describe('Integration scenarios', () => {
    it('should be able to register and then retrieve reference IDs', async () => {
      const referenceIdData: Prisma.ReferenceIdCreateInput = {
        txTp: 'pacs.002.001.12',
        referenceIdName: 'EndToEndId',
      };

      adminRepository.registerReferenceId.mockResolvedValue(mockReferenceId);
      adminRepository.getReferenceId.mockResolvedValue([mockReferenceId]);

      const registered = await service.registerReferenceId(referenceIdData);
      expect(registered).toEqual(mockReferenceId);

      const allReferenceIds = await service.getReferenceIds();
      expect(allReferenceIds).toContainEqual(mockReferenceId);
    });

    it('should handle multiple register operations', async () => {
      const data1: Prisma.ReferenceIdCreateInput = {
        txTp: 'pacs.002.001.12',
        referenceIdName: 'EndToEndId',
      };

      const data2: Prisma.ReferenceIdCreateInput = {
        txTp: 'pacs.008.001.10',
        referenceIdName: 'InstrId',
      };

      adminRepository.registerReferenceId.mockResolvedValueOnce(mockReferenceIds[0]).mockResolvedValueOnce(mockReferenceIds[1]);

      const result1 = await service.registerReferenceId(data1);
      const result2 = await service.registerReferenceId(data2);

      expect(result1).toEqual(mockReferenceIds[0]);
      expect(result2).toEqual(mockReferenceIds[1]);
      expect(adminRepository.registerReferenceId).toHaveBeenCalledTimes(2);
    });

    it('should handle errors in sequential operations', async () => {
      const referenceIdData: Prisma.ReferenceIdCreateInput = {
        txTp: 'pacs.002.001.12',
        referenceIdName: 'EndToEndId',
      };

      adminRepository.registerReferenceId.mockRejectedValue(new Error('Registration failed'));
      adminRepository.getReferenceId.mockResolvedValue([]);

      await expect(service.registerReferenceId(referenceIdData)).rejects.toThrow('Registration failed');

      const result = await service.getReferenceIds();
      expect(result).toEqual([]);
    });
  });
});
