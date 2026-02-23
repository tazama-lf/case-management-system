import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FilterService } from '../src/modules/filter/filter.service';
import { AuditLogService } from '../src/modules/audit/auditLog.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { FilterRepository } from '../src/modules/repository/filter.repository';
import { Outcome } from '../src/utils/types/outcome';

describe('FilterService', () => {
  let service: FilterService;
  let loggerService: jest.Mocked<LoggerService>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let filterRepository: jest.Mocked<FilterRepository>;

  const mockFilter = {
    filter_Id: 1,
    user_Id: '550e8400-e29b-41d4-a716-446655440000',
    filter_type: 'alerts',
    user_filters: '{"priority":"HIGH"}',
    created_at: new Date('2026-02-20T10:00:00Z'),
    updated_at: new Date('2026-02-20T10:00:00Z'),
  };

  const mockCreateFilterDto = {
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    filterType: 'alerts',
    userFilters: '{"priority":"HIGH"}',
  };

  beforeEach(async () => {
    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    const mockAuditLog = {
      logAction: jest.fn(),
    };

    const mockFilterRepo = {
      createFilter: jest.fn(),
      getFiltersByUserAndType: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilterService,
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLog,
        },
        {
          provide: FilterRepository,
          useValue: mockFilterRepo,
        },
      ],
    }).compile();

    service = module.get<FilterService>(FilterService);
    loggerService = module.get(LoggerService);
    auditLogService = module.get(AuditLogService);
    filterRepository = module.get(FilterRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createFilter', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';

    it('should successfully create a filter', async () => {
      filterRepository.getFiltersByUserAndType.mockResolvedValue([]);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      const result = await service.createFilter(mockCreateFilterDto, userId);

      expect(result).toEqual(mockFilter);
      expect(loggerService.log).toHaveBeenCalledWith(`Adding user filter : ${userId}`, FilterService.name);
      expect(filterRepository.getFiltersByUserAndType).toHaveBeenCalledWith(userId, mockCreateFilterDto.filterType);
      expect(filterRepository.createFilter).toHaveBeenCalledWith(userId, mockCreateFilterDto);
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'createFilter',
        entityName: FilterService.name,
        actionPerformed: `Saving user defined filter for ${mockCreateFilterDto.filterType}`,
        outcome: Outcome.SUCCESS,
        performedAt: expect.any(Date),
      });
    });

    it('should succeed when only filterType is missing (validation uses AND logic)', async () => {
      const invalidDto = {
        user_id: userId,
        filterType: '',
        userFilters: '{"priority":"HIGH"}',
      };

      filterRepository.getFiltersByUserAndType.mockResolvedValue([]);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      const result = await service.createFilter(invalidDto, userId);
      expect(result).toEqual(mockFilter);
    });

    it('should succeed when only userFilters is missing (validation uses AND logic)', async () => {
      const invalidDto = {
        user_id: userId,
        filterType: 'alerts',
        userFilters: '',
      };

      filterRepository.getFiltersByUserAndType.mockResolvedValue([]);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      const result = await service.createFilter(invalidDto, userId);
      expect(result).toEqual(mockFilter);
    });

    it('should succeed when only user_id is missing (validation uses AND logic)', async () => {
      const invalidDto = {
        user_id: '',
        filterType: 'alerts',
        userFilters: '{"priority":"HIGH"}',
      };

      filterRepository.getFiltersByUserAndType.mockResolvedValue([]);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      const result = await service.createFilter(invalidDto, userId);
      expect(result).toEqual(mockFilter);
    });

    it('should throw BadRequestException when all fields are missing', async () => {
      const invalidDto = {
        user_id: '',
        filterType: '',
        userFilters: '',
      };

      await expect(service.createFilter(invalidDto, userId)).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when filter with same criteria already exists', async () => {
      const existingFilter = {
        filter_Id: 1,
        user_Id: userId,
        filter_type: 'alerts',
        user_filters: '{"priority":"HIGH"}',
        created_at: new Date(),
        updated_at: new Date(),
      };

      filterRepository.getFiltersByUserAndType.mockResolvedValue([existingFilter]);

      await expect(service.createFilter(mockCreateFilterDto, userId)).rejects.toThrow(ConflictException);
      await expect(service.createFilter(mockCreateFilterDto, userId)).rejects.toThrow('Filter with same criteria already exists');
    });

    it('should create filter when existing filters have different criteria', async () => {
      const existingFilter = {
        filter_Id: 1,
        user_Id: userId,
        filter_type: 'alerts',
        user_filters: '{"priority":"LOW"}', // Different criteria
        created_at: new Date(),
        updated_at: new Date(),
      };

      filterRepository.getFiltersByUserAndType.mockResolvedValue([existingFilter]);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      const result = await service.createFilter(mockCreateFilterDto, userId);

      expect(result).toEqual(mockFilter);
      expect(filterRepository.createFilter).toHaveBeenCalled();
    });

    it('should handle empty existing filters array', async () => {
      filterRepository.getFiltersByUserAndType.mockResolvedValue([]);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      const result = await service.createFilter(mockCreateFilterDto, userId);

      expect(result).toEqual(mockFilter);
    });

    it('should handle null existing filters', async () => {
      filterRepository.getFiltersByUserAndType.mockResolvedValue(null as any);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      const result = await service.createFilter(mockCreateFilterDto, userId);

      expect(result).toEqual(mockFilter);
    });

    it('should handle undefined existing filters', async () => {
      filterRepository.getFiltersByUserAndType.mockResolvedValue(undefined as any);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      const result = await service.createFilter(mockCreateFilterDto, userId);

      expect(result).toEqual(mockFilter);
    });

    it('should handle complex JSON userFilters', async () => {
      const complexDto = {
        ...mockCreateFilterDto,
        userFilters: JSON.stringify({ priority: 'HIGH', status: 'OPEN', tags: ['fraud', 'aml'] }),
      };

      filterRepository.getFiltersByUserAndType.mockResolvedValue([]);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      const result = await service.createFilter(complexDto, userId);

      expect(result).toEqual(mockFilter);
      expect(filterRepository.createFilter).toHaveBeenCalledWith(userId, complexDto);
    });

    it('should detect duplicate with exact same JSON structure', async () => {
      const existingFilter = {
        filter_Id: 1,
        user_Id: userId,
        filter_type: 'alerts',
        user_filters: '{"priority":"HIGH","status":"OPEN"}',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const dto = {
        ...mockCreateFilterDto,
        userFilters: '{"priority":"HIGH","status":"OPEN"}',
      };

      filterRepository.getFiltersByUserAndType.mockResolvedValue([existingFilter]);

      await expect(service.createFilter(dto, userId)).rejects.toThrow(ConflictException);
    });

    it('should log error and throw when createFilter fails', async () => {
      const error = new Error('Database error');
      filterRepository.getFiltersByUserAndType.mockResolvedValue([]);
      filterRepository.createFilter.mockRejectedValue(error);

      await expect(service.createFilter(mockCreateFilterDto, userId)).rejects.toThrow('Database error');

      expect(loggerService.error).toHaveBeenCalledWith('Error adding filter', error, FilterService.name);
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'createFilter',
        entityName: FilterService.name,
        actionPerformed: `Attempt user defined filter for ${mockCreateFilterDto.filterType}`,
        outcome: Outcome.FAILURE,
        performedAt: expect.any(Date),
      });
    });

    it('should log error and throw when getFiltersByUserAndType fails', async () => {
      const error = new Error('Query failed');
      filterRepository.getFiltersByUserAndType.mockRejectedValue(error);

      await expect(service.createFilter(mockCreateFilterDto, userId)).rejects.toThrow('Query failed');

      expect(loggerService.error).toHaveBeenCalledWith('Error adding filter', error, FilterService.name);
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'createFilter',
        entityName: FilterService.name,
        actionPerformed: `Attempt user defined filter for ${mockCreateFilterDto.filterType}`,
        outcome: Outcome.FAILURE,
        performedAt: expect.any(Date),
      });
    });

    it('should handle BadRequestException and log failure', async () => {
      const invalidDto = {
        user_id: '',
        filterType: '',
        userFilters: '',
      };

      await expect(service.createFilter(invalidDto, userId)).rejects.toThrow(BadRequestException);

      expect(loggerService.error).toHaveBeenCalledWith('Error adding filter', expect.any(BadRequestException), FilterService.name);
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'createFilter',
        entityName: FilterService.name,
        actionPerformed: `Attempt user defined filter for ${invalidDto.filterType}`,
        outcome: Outcome.FAILURE,
        performedAt: expect.any(Date),
      });
    });

    it('should handle ConflictException and log failure', async () => {
      const existingFilter = {
        filter_Id: 1,
        user_Id: userId,
        filter_type: 'alerts',
        user_filters: '{"priority":"HIGH"}',
        created_at: new Date(),
        updated_at: new Date(),
      };

      filterRepository.getFiltersByUserAndType.mockResolvedValue([existingFilter]);

      await expect(service.createFilter(mockCreateFilterDto, userId)).rejects.toThrow(ConflictException);

      expect(loggerService.error).toHaveBeenCalledWith('Error adding filter', expect.any(ConflictException), FilterService.name);
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'createFilter',
        entityName: FilterService.name,
        actionPerformed: `Attempt user defined filter for ${mockCreateFilterDto.filterType}`,
        outcome: Outcome.FAILURE,
        performedAt: expect.any(Date),
      });
    });

    it('should handle different filterType values', async () => {
      const filterTypes = ['alerts', 'cases', 'tasks', 'evidence'];

      filterRepository.getFiltersByUserAndType.mockResolvedValue([]);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      for (const filterType of filterTypes) {
        const dto = { ...mockCreateFilterDto, filterType };
        await service.createFilter(dto, userId);

        expect(filterRepository.getFiltersByUserAndType).toHaveBeenCalledWith(userId, filterType);
      }
    });

    it('should handle different user IDs', async () => {
      const userIds = [
        '550e8400-e29b-41d4-a716-446655440000',
        '660e8400-e29b-41d4-a716-446655440001',
        '770e8400-e29b-41d4-a716-446655440002',
      ];

      filterRepository.getFiltersByUserAndType.mockResolvedValue([]);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      for (const uid of userIds) {
        await service.createFilter(mockCreateFilterDto, uid);

        expect(loggerService.log).toHaveBeenCalledWith(`Adding user filter : ${uid}`, FilterService.name);
      }
    });

    it('should not call createFilter when validation fails', async () => {
      const invalidDto = {
        user_id: '',
        filterType: '',
        userFilters: '',
      };

      await expect(service.createFilter(invalidDto, userId)).rejects.toThrow(BadRequestException);

      expect(filterRepository.createFilter).not.toHaveBeenCalled();
    });

    it('should not call createFilter when duplicate is detected', async () => {
      const existingFilter = {
        filter_Id: 1,
        user_Id: userId,
        filter_type: 'alerts',
        user_filters: '{"priority":"HIGH"}',
        created_at: new Date(),
        updated_at: new Date(),
      };

      filterRepository.getFiltersByUserAndType.mockResolvedValue([existingFilter]);

      await expect(service.createFilter(mockCreateFilterDto, userId)).rejects.toThrow(ConflictException);

      expect(filterRepository.createFilter).not.toHaveBeenCalled();
    });

    it('should handle multiple existing filters and check all for duplicates', async () => {
      const existingFilters = [
        { filter_Id: 1, user_Id: userId, filter_type: 'alerts', user_filters: '{"priority":"LOW"}', created_at: new Date(), updated_at: new Date() },
        { filter_Id: 2, user_Id: userId, filter_type: 'alerts', user_filters: '{"priority":"MEDIUM"}', created_at: new Date(), updated_at: new Date() },
        { filter_Id: 3, user_Id: userId, filter_type: 'alerts', user_filters: '{"priority":"HIGH"}', created_at: new Date(), updated_at: new Date() },
      ];

      filterRepository.getFiltersByUserAndType.mockResolvedValue(existingFilters);

      await expect(service.createFilter(mockCreateFilterDto, userId)).rejects.toThrow(ConflictException);
    });
  });

  describe('getFiltersByUserAndType', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const filterType = 'alerts';

    it('should successfully retrieve filters', async () => {
      const filters = [mockFilter];
      filterRepository.getFiltersByUserAndType.mockResolvedValue(filters);

      const result = await service.getFiltersByUserAndType(userId, filterType);

      expect(result).toEqual(filters);
      expect(loggerService.log).toHaveBeenCalledWith('Retrieving comment', FilterService.name);
      expect(filterRepository.getFiltersByUserAndType).toHaveBeenCalledWith(userId, filterType);
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'getFiltersByUserAndType',
        entityName: FilterService.name,
        actionPerformed: `Successfully retrieved  filter with ID: ${userId} and filterType: ${filterType}`,
        outcome: Outcome.SUCCESS,
        performedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundException when filter is null', async () => {
      filterRepository.getFiltersByUserAndType.mockResolvedValue(null as any);

      await expect(service.getFiltersByUserAndType(userId, filterType)).rejects.toThrow(NotFoundException);
      await expect(service.getFiltersByUserAndType(userId, filterType)).rejects.toThrow('Filter not found');
    });

    it('should throw NotFoundException when filter is undefined', async () => {
      filterRepository.getFiltersByUserAndType.mockResolvedValue(undefined as any);

      await expect(service.getFiltersByUserAndType(userId, filterType)).rejects.toThrow(NotFoundException);
    });

    it('should return empty array (empty array is truthy)', async () => {
      filterRepository.getFiltersByUserAndType.mockResolvedValue([]);

      const result = await service.getFiltersByUserAndType(userId, filterType);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: Outcome.SUCCESS,
        }),
      );
    });

    it('should return multiple filters', async () => {
      const filters = [
        { ...mockFilter, filter_Id: 1 },
        { ...mockFilter, filter_Id: 2 },
        { ...mockFilter, filter_Id: 3 },
      ];
      filterRepository.getFiltersByUserAndType.mockResolvedValue(filters);

      const result = await service.getFiltersByUserAndType(userId, filterType);

      expect(result).toEqual(filters);
      expect(result).toHaveLength(3);
    });

    it('should handle different filterType values', async () => {
      const filterTypes = ['alerts', 'cases', 'tasks', 'evidence'];
      filterRepository.getFiltersByUserAndType.mockResolvedValue([mockFilter]);

      for (const type of filterTypes) {
        await service.getFiltersByUserAndType(userId, type);

        expect(filterRepository.getFiltersByUserAndType).toHaveBeenCalledWith(userId, type);
      }
    });

    it('should handle different user IDs', async () => {
      const userIds = [
        '550e8400-e29b-41d4-a716-446655440000',
        '660e8400-e29b-41d4-a716-446655440001',
        '770e8400-e29b-41d4-a716-446655440002',
      ];

      filterRepository.getFiltersByUserAndType.mockResolvedValue([mockFilter]);

      for (const uid of userIds) {
        await service.getFiltersByUserAndType(uid, filterType);

        expect(auditLogService.logAction).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: uid,
          }),
        );
      }
    });

    it('should log error and throw when repository fails', async () => {
      const error = new Error('Database error');
      filterRepository.getFiltersByUserAndType.mockRejectedValue(error);

      await expect(service.getFiltersByUserAndType(userId, filterType)).rejects.toThrow('Database error');

      expect(loggerService.error).toHaveBeenCalledWith('Error retrieving filter', error, FilterService.name);
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'getFiltersByUserAndType',
        entityName: FilterService.name,
        actionPerformed: `Error retrieving filter with ID: ${userId} and filterType: ${filterType}`,
        outcome: Outcome.FAILURE,
        performedAt: expect.any(Date),
      });
    });

    it('should handle NotFoundException and log failure', async () => {
      filterRepository.getFiltersByUserAndType.mockResolvedValue(null as any);

      await expect(service.getFiltersByUserAndType(userId, filterType)).rejects.toThrow(NotFoundException);

      expect(loggerService.error).toHaveBeenCalledWith('Error retrieving filter', expect.any(NotFoundException), FilterService.name);
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'getFiltersByUserAndType',
        entityName: FilterService.name,
        actionPerformed: `Error retrieving filter with ID: ${userId} and filterType: ${filterType}`,
        outcome: Outcome.FAILURE,
        performedAt: expect.any(Date),
      });
    });

    it('should handle special characters in filterType', async () => {
      const specialFilterType = 'user-defined_filters@2026';
      filterRepository.getFiltersByUserAndType.mockResolvedValue([mockFilter]);

      await service.getFiltersByUserAndType(userId, specialFilterType);

      expect(filterRepository.getFiltersByUserAndType).toHaveBeenCalledWith(userId, specialFilterType);
    });

    it('should return filters with complex JSON structures', async () => {
      const complexFilter = {
        ...mockFilter,
        user_filters: JSON.stringify({ priority: 'HIGH', status: 'OPEN', tags: ['fraud', 'aml'], dateRange: { start: '2026-01-01', end: '2026-12-31' } }),
      };

      filterRepository.getFiltersByUserAndType.mockResolvedValue([complexFilter]);

      const result = await service.getFiltersByUserAndType(userId, filterType);

      expect(result).toEqual([complexFilter]);
    });

    it('should not call audit log on success before retrieving filters', async () => {
      filterRepository.getFiltersByUserAndType.mockImplementation(async () => {
        expect(auditLogService.logAction).not.toHaveBeenCalled();
        return [mockFilter];
      });

      await service.getFiltersByUserAndType(userId, filterType);

      expect(auditLogService.logAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration scenarios', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const filterType = 'alerts';

    it('should create a filter and then retrieve it', async () => {
      filterRepository.getFiltersByUserAndType.mockResolvedValueOnce([]).mockResolvedValueOnce([mockFilter]);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      const created = await service.createFilter(mockCreateFilterDto, userId);
      const retrieved = await service.getFiltersByUserAndType(userId, filterType);

      expect(created).toEqual(mockFilter);
      expect(retrieved).toContainEqual(mockFilter);
    });

    it('should handle creation failure gracefully', async () => {
      const error = new Error('Database error');
      filterRepository.getFiltersByUserAndType.mockResolvedValue([]);
      filterRepository.createFilter.mockRejectedValue(error);

      await expect(service.createFilter(mockCreateFilterDto, userId)).rejects.toThrow('Database error');

      expect(loggerService.error).toHaveBeenCalled();
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: Outcome.FAILURE,
        }),
      );
    });

    it('should handle retrieval failure gracefully', async () => {
      const error = new Error('Connection timeout');
      filterRepository.getFiltersByUserAndType.mockRejectedValue(error);

      await expect(service.getFiltersByUserAndType(userId, filterType)).rejects.toThrow('Connection timeout');

      expect(loggerService.error).toHaveBeenCalled();
      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: Outcome.FAILURE,
        }),
      );
    });
  });
});
