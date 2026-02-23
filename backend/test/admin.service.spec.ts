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

  beforeEach(async () => {
    const mockAdminRepository = {
      registerReferenceId: jest.fn(),
      getReferenceId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: AdminRepository,
          useValue: mockAdminRepository,
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

    it('should call adminRepository.registerReferenceId with correct parameters', async () => {
      adminRepository.registerReferenceId.mockResolvedValue(mockReferenceId);

      await service.registerReferenceId(referenceIdData);

      expect(adminRepository.registerReferenceId).toHaveBeenCalledWith(
        expect.objectContaining({
          txTp: 'pacs.002.001.12',
          referenceIdName: 'EndToEndId',
        }),
      );
    });

    it('should handle repository error and re-throw it', async () => {
      const error = new Error('Database error');
      adminRepository.registerReferenceId.mockRejectedValue(error);

      await expect(service.registerReferenceId(referenceIdData)).rejects.toThrow('Database error');
      expect(adminRepository.registerReferenceId).toHaveBeenCalledWith(referenceIdData);
    });

    it('should handle custom error from repository', async () => {
      const customError = new Error('Unique constraint violation');
      adminRepository.registerReferenceId.mockRejectedValue(customError);

      await expect(service.registerReferenceId(referenceIdData)).rejects.toThrow('Unique constraint violation');
    });

    it('should handle non-Error exceptions', async () => {
      adminRepository.registerReferenceId.mockRejectedValue('String error');

      await expect(service.registerReferenceId(referenceIdData)).rejects.toBe('String error');
    });

    it('should register reference ID with different txTp', async () => {
      const differentData: Prisma.ReferenceIdCreateInput = {
        txTp: 'pacs.008.001.10',
        referenceIdName: 'InstrId',
      };

      const mockResult = {
        id: 2,
        txTp: 'pacs.008.001.10',
        referenceIdName: 'InstrId',
        createdAt: new Date('2026-01-02'),
      };

      adminRepository.registerReferenceId.mockResolvedValue(mockResult);

      const result = await service.registerReferenceId(differentData);

      expect(result).toEqual(mockResult);
      expect(adminRepository.registerReferenceId).toHaveBeenCalledWith(differentData);
    });

    it('should register reference ID with various message types', async () => {
      const data: Prisma.ReferenceIdCreateInput = {
        txTp: 'pain.001.001.11',
        referenceIdName: 'MsgId',
      };

      const mockResult = {
        id: 3,
        txTp: 'pain.001.001.11',
        referenceIdName: 'MsgId',
        createdAt: new Date('2026-01-03'),
      };

      adminRepository.registerReferenceId.mockResolvedValue(mockResult);

      const result = await service.registerReferenceId(data);

      expect(result).toEqual(mockResult);
      expect(result.txTp).toBe('pain.001.001.11');
    });

    it('should register reference ID with different reference name', async () => {
      const data: Prisma.ReferenceIdCreateInput = {
        txTp: 'pain.013.001.09',
        referenceIdName: 'TxId',
      };

      const mockResult = {
        id: 4,
        txTp: 'pain.013.001.09',
        referenceIdName: 'TxId',
        createdAt: new Date('2026-01-04'),
      };

      adminRepository.registerReferenceId.mockResolvedValue(mockResult);

      const result = await service.registerReferenceId(data);

      expect(result).toEqual(mockResult);
      expect(result.referenceIdName).toBe('TxId');
    });

    it('should return the complete reference ID object with id and timestamp', async () => {
      adminRepository.registerReferenceId.mockResolvedValue(mockReferenceId);

      const result = await service.registerReferenceId(referenceIdData);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('txTp');
      expect(result).toHaveProperty('referenceIdName');
      expect(result).toHaveProperty('createdAt');
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

    it('should return empty array when no reference IDs exist', async () => {
      adminRepository.getReferenceId.mockResolvedValue([]);

      const result = await service.getReferenceIds();

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should return multiple reference IDs', async () => {
      adminRepository.getReferenceId.mockResolvedValue(mockReferenceIds);

      const result = await service.getReferenceIds();

      expect(result).toHaveLength(3);
      expect(result).toEqual(mockReferenceIds);
    });

    it('should handle repository error and re-throw it', async () => {
      const error = new Error('Database connection failed');
      adminRepository.getReferenceId.mockRejectedValue(error);

      await expect(service.getReferenceIds()).rejects.toThrow('Database connection failed');
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
      const sortedMockReferenceIds = [...mockReferenceIds].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      adminRepository.getReferenceId.mockResolvedValue(sortedMockReferenceIds);

      const result = await service.getReferenceIds();

      expect(result[0].createdAt).toEqual(new Date('2026-01-01'));
      expect(result[1].createdAt).toEqual(new Date('2026-01-02'));
      expect(result[2].createdAt).toEqual(new Date('2026-01-03'));
    });

    it('should handle a single reference ID', async () => {
      adminRepository.getReferenceId.mockResolvedValue([mockReferenceId]);

      const result = await service.getReferenceIds();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockReferenceId);
    });

    it('should handle large number of reference IDs', async () => {
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

    it('should call repository method without any parameters', async () => {
      adminRepository.getReferenceId.mockResolvedValue(mockReferenceIds);

      await service.getReferenceIds();

      expect(adminRepository.getReferenceId).toHaveBeenCalledWith();
      expect(adminRepository.getReferenceId).toHaveBeenCalledTimes(1);
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

      // Register
      const registered = await service.registerReferenceId(referenceIdData);
      expect(registered).toEqual(mockReferenceId);

      // Retrieve
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

      adminRepository.registerReferenceId
        .mockResolvedValueOnce(mockReferenceIds[0])
        .mockResolvedValueOnce(mockReferenceIds[1]);

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

      // First operation fails
      await expect(service.registerReferenceId(referenceIdData)).rejects.toThrow('Registration failed');

      // Second operation succeeds
      const result = await service.getReferenceIds();
      expect(result).toEqual([]);
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle null return from repository', async () => {
      adminRepository.registerReferenceId.mockResolvedValue(null as any);

      const referenceIdData: Prisma.ReferenceIdCreateInput = {
        txTp: 'pacs.002.001.12',
        referenceIdName: 'EndToEndId',
      };

      const result = await service.registerReferenceId(referenceIdData);
      expect(result).toBeNull();
    });

    it('should handle undefined return from repository', async () => {
      adminRepository.getReferenceId.mockResolvedValue(undefined as any);

      const result = await service.getReferenceIds();
      expect(result).toBeUndefined();
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Query timeout');
      adminRepository.registerReferenceId.mockRejectedValue(timeoutError);

      const referenceIdData: Prisma.ReferenceIdCreateInput = {
        txTp: 'pacs.002.001.12',
        referenceIdName: 'EndToEndId',
      };

      await expect(service.registerReferenceId(referenceIdData)).rejects.toThrow('Query timeout');
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      adminRepository.getReferenceId.mockRejectedValue(networkError);

      await expect(service.getReferenceIds()).rejects.toThrow('Network error');
    });
  });
});
