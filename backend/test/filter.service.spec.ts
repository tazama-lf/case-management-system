import { Test, TestingModule } from '@nestjs/testing';
import { FilterService } from '../src/modules/filter/filter.service';
import { AuditLogService } from '../src/modules/audit/auditLog.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Outcome } from '../src/utils/types/outcome';
import { FilterRepository } from '../src/modules/repository/filter.repository';

describe('FilterService', () => {
  let service: FilterService;
  let filterRepository: jest.Mocked<FilterRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let loggerService: jest.Mocked<LoggerService>;

  const userId = '550e8400-e29b-41d4-a716-446655440000';
  const mockCreateFilterDto = {
    user_id: userId,
    filterType: 'alerts',
    userFilters: '{"priority":"HIGH"}',
  };

  const mockFilter = {
    filter_Id: 1,
    user_Id: userId,
    filter_type: 'alerts',
    user_filters: '{"priority":"HIGH"}',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilterService,
        {
          provide: FilterRepository,
          useValue: {
            createFilter: jest.fn(),
            getFiltersByUserAndType: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            logAction: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FilterService>(FilterService);
    filterRepository = module.get(FilterRepository) as jest.Mocked<FilterRepository>;
    auditLogService = module.get(AuditLogService) as jest.Mocked<AuditLogService>;
    loggerService = module.get(LoggerService) as jest.Mocked<LoggerService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createFilter', () => {
    it('should successfully create a filter', async () => {
      filterRepository.getFiltersByUserAndType.mockResolvedValue([]);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      const result = await service.createFilter(mockCreateFilterDto, userId);

      expect(result).toEqual(mockFilter);
      expect(loggerService.log).toHaveBeenCalledWith(`Adding user filter : ${userId}`, FilterService.name);
      expect(filterRepository.getFiltersByUserAndType).toHaveBeenCalledWith(userId, 'alerts');
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

    it('should throw BadRequestException when all required fields are missing', async () => {
      const invalidDto = {
        user_id: '',
        filterType: '',
        userFilters: '',
      };

      await expect(service.createFilter(invalidDto, userId)).rejects.toThrow(BadRequestException);
      await expect(service.createFilter(invalidDto, userId)).rejects.toThrow('user_id, filterType and userFilters must be provided');

      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'createFilter',
        entityName: FilterService.name,
        actionPerformed: `Attempt user defined filter for ${invalidDto.filterType}`,
        outcome: Outcome.FAILURE,
        performedAt: expect.any(Date),
      });
    });

    it('should throw ConflictException when filter with same criteria exists', async () => {
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

    it('should detect exact duplicate in multiple existing filters', async () => {
      const existingFilters = [
        {
          filter_Id: 1,
          user_Id: userId,
          filter_type: 'alerts',
          user_filters: '{"priority":"LOW"}',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          filter_Id: 2,
          user_Id: userId,
          filter_type: 'alerts',
          user_filters: '{"priority":"MEDIUM"}',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          filter_Id: 3,
          user_Id: userId,
          filter_type: 'alerts',
          user_filters: '{"priority":"HIGH"}',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      filterRepository.getFiltersByUserAndType.mockResolvedValue(existingFilters);

      await expect(service.createFilter(mockCreateFilterDto, userId)).rejects.toThrow(ConflictException);
    });

    it('should create filter when different criteria exists', async () => {
      const existingFilter = {
        filter_Id: 1,
        user_Id: userId,
        filter_type: 'alerts',
        user_filters: '{"priority":"LOW"}',
        created_at: new Date(),
        updated_at: new Date(),
      };

      filterRepository.getFiltersByUserAndType.mockResolvedValue([existingFilter]);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      const result = await service.createFilter(mockCreateFilterDto, userId);

      expect(result).toEqual(mockFilter);
      expect(filterRepository.createFilter).toHaveBeenCalledWith(userId, mockCreateFilterDto);
    });

    it.each([[null], [undefined], [[]]])('should create filter when existing filters is %p', async (existingFilters) => {
      filterRepository.getFiltersByUserAndType.mockResolvedValue(existingFilters as any);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      const result = await service.createFilter(mockCreateFilterDto, userId);

      expect(result).toEqual(mockFilter);
    });

    it('should handle complex JSON userFilters', async () => {
      const complexDto = {
        ...mockCreateFilterDto,
        userFilters: JSON.stringify({
          priority: 'HIGH',
          status: 'OPEN',
          tags: ['fraud', 'aml'],
          dateRange: { start: '2026-01-01', end: '2026-12-31' },
        }),
      };

      filterRepository.getFiltersByUserAndType.mockResolvedValue([]);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      await service.createFilter(complexDto, userId);

      expect(filterRepository.createFilter).toHaveBeenCalledWith(userId, complexDto);
    });

    it.each([['alerts'], ['cases'], ['tasks'], ['evidence']])('should handle filterType: %s', async (filterType) => {
      const dto = { ...mockCreateFilterDto, filterType };
      filterRepository.getFiltersByUserAndType.mockResolvedValue([]);
      filterRepository.createFilter.mockResolvedValue(mockFilter);

      await service.createFilter(dto, userId);

      expect(filterRepository.getFiltersByUserAndType).toHaveBeenCalledWith(userId, filterType);
    });

    it.each([['550e8400-e29b-41d4-a716-446655440000'], ['660e8400-e29b-41d4-a716-446655440001'], ['770e8400-e29b-41d4-a716-446655440002']])(
      'should handle userId: %s',
      async (uid) => {
        filterRepository.getFiltersByUserAndType.mockResolvedValue([]);
        filterRepository.createFilter.mockResolvedValue(mockFilter);

        await service.createFilter(mockCreateFilterDto, uid);

        expect(loggerService.log).toHaveBeenCalledWith(`Adding user filter : ${uid}`, FilterService.name);
      },
    );

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

    it('should handle database errors and log failure', async () => {
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

    it('should handle query failures during duplicate check', async () => {
      const error = new Error('Query failed');
      filterRepository.getFiltersByUserAndType.mockRejectedValue(error);

      await expect(service.createFilter(mockCreateFilterDto, userId)).rejects.toThrow('Query failed');

      expect(loggerService.error).toHaveBeenCalledWith('Error adding filter', error, FilterService.name);
    });
  });

  describe('getFiltersByUserAndType', () => {
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

    it.each([[null], [undefined]])('should throw NotFoundException when filter is %p', async (filterValue) => {
      filterRepository.getFiltersByUserAndType.mockResolvedValue(filterValue as any);

      await expect(service.getFiltersByUserAndType(userId, filterType)).rejects.toThrow(NotFoundException);
      await expect(service.getFiltersByUserAndType(userId, filterType)).rejects.toThrow('Filter not found');

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

    it.each([['alerts'], ['cases'], ['tasks'], ['evidence']])('should handle filterType: %s', async (type) => {
      filterRepository.getFiltersByUserAndType.mockResolvedValue([mockFilter]);

      await service.getFiltersByUserAndType(userId, type);

      expect(filterRepository.getFiltersByUserAndType).toHaveBeenCalledWith(userId, type);
    });

    it.each([['550e8400-e29b-41d4-a716-446655440000'], ['660e8400-e29b-41d4-a716-446655440001'], ['770e8400-e29b-41d4-a716-446655440002']])(
      'should handle userId: %s',
      async (uid) => {
        filterRepository.getFiltersByUserAndType.mockResolvedValue([mockFilter]);

        await service.getFiltersByUserAndType(uid, filterType);

        expect(auditLogService.logAction).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: uid,
          }),
        );
      },
    );

    it('should handle database errors and log failure', async () => {
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

    it('should handle special characters in filterType', async () => {
      const specialFilterType = 'user-defined_filters@2026';
      filterRepository.getFiltersByUserAndType.mockResolvedValue([mockFilter]);

      await service.getFiltersByUserAndType(userId, specialFilterType);

      expect(filterRepository.getFiltersByUserAndType).toHaveBeenCalledWith(userId, specialFilterType);
    });

    it('should return filters with complex JSON structures', async () => {
      const complexFilter = {
        ...mockFilter,
        user_filters: JSON.stringify({
          priority: 'HIGH',
          status: 'OPEN',
          tags: ['fraud', 'aml'],
          dateRange: { start: '2026-01-01', end: '2026-12-31' },
        }),
      };

      filterRepository.getFiltersByUserAndType.mockResolvedValue([complexFilter]);

      const result = await service.getFiltersByUserAndType(userId, filterType);

      expect(result).toEqual([complexFilter]);
    });
  });
});
