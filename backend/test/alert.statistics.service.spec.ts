import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { AlertStatisticsService } from '../src/modules/alert/alert.statistics.service';
import { AlertRepository } from '../src/modules/repository/alert.repository';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { Priority, CaseType } from '@prisma/client-cms';

describe('AlertStatisticsService', () => {
  let service: AlertStatisticsService;
  let alertRepository: jest.Mocked<AlertRepository>;
  let logger: jest.Mocked<LoggerService>;

  const mockAlerts = [
    {
      alert_id: 1,
      txtp: 'pacs.002.001.12',
      priority: Priority.CRITICAL,
      confidence_per: 85.5,
      source: 'system-a',
      alert_type: CaseType.FRAUD,
      created_at: new Date('2026-01-01'),
      transaction: { test: 'data' },
      alert_data: { status: 'NEW' },
    },
    {
      alert_id: 2,
      txtp: 'pacs.008.001.10',
      priority: Priority.URGENT,
      confidence_per: 70.0,
      source: 'system-b',
      alert_type: CaseType.AML,
      created_at: new Date('2026-01-02'),
      transaction: { test: 'data2' },
      alert_data: { status: 'OPEN' },
    },
  ];

  beforeEach(async () => {
    const mockAlertRepository = {
      findMany: jest.fn(),
      count: jest.fn(),
    };

    const mockLogger = {
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertStatisticsService,
        {
          provide: AlertRepository,
          useValue: mockAlertRepository,
        },
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AlertStatisticsService>(AlertStatisticsService);
    alertRepository = module.get(AlertRepository);
    logger = module.get(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAlertsForUser', () => {
    const defaultParams = {
      tenantId: 'tenant-123',
      page: 1,
      limit: 10,
      sortBy: 'created_at',
      sortOrder: 'desc' as const,
    };

    describe('Validation', () => {
      it('should throw BadRequestException when page is not a positive integer', async () => {
        await expect(
          service.getAlertsForUser({
            ...defaultParams,
            page: 0,
          }),
        ).rejects.toThrow(new BadRequestException('Page must be a positive integer'));

        await expect(
          service.getAlertsForUser({
            ...defaultParams,
            page: -1,
          }),
        ).rejects.toThrow(new BadRequestException('Page must be a positive integer'));

        await expect(
          service.getAlertsForUser({
            ...defaultParams,
            page: 1.5,
          }),
        ).rejects.toThrow(new BadRequestException('Page must be a positive integer'));
      });

      it('should throw BadRequestException when limit is not a positive integer', async () => {
        await expect(
          service.getAlertsForUser({
            ...defaultParams,
            limit: 0,
          }),
        ).rejects.toThrow(new BadRequestException('Limit must be a positive integer'));

        await expect(
          service.getAlertsForUser({
            ...defaultParams,
            limit: -5,
          }),
        ).rejects.toThrow(new BadRequestException('Limit must be a positive integer'));

        await expect(
          service.getAlertsForUser({
            ...defaultParams,
            limit: 2.7,
          }),
        ).rejects.toThrow(new BadRequestException('Limit must be a positive integer'));
      });

      it('should throw BadRequestException when sortBy field is invalid', async () => {
        await expect(
          service.getAlertsForUser({
            ...defaultParams,
            sortBy: 'invalid_field',
          }),
        ).rejects.toThrow(
          new BadRequestException(
            'Invalid sortBy field: invalid_field. Must be one of alert_id, txtp, priority, confidence_per, alert_status, source, alert_type, created_at',
          ),
        );
      });

      it('should throw BadRequestException when sortOrder is invalid', async () => {
        await expect(
          service.getAlertsForUser({
            ...defaultParams,
            sortOrder: 'invalid' as any,
          }),
        ).rejects.toThrow(new BadRequestException('sortOrder must be "asc" or "desc"'));
      });

      it('should throw BadRequestException when priority is invalid', async () => {
        await expect(
          service.getAlertsForUser({
            ...defaultParams,
            priority: 'INVALID_PRIORITY',
          }),
        ).rejects.toThrow(new BadRequestException('Invalid priority: INVALID_PRIORITY'));
      });

      it('should throw BadRequestException when alertType is invalid', async () => {
        await expect(
          service.getAlertsForUser({
            ...defaultParams,
            alertType: 'INVALID_TYPE',
          }),
        ).rejects.toThrow(new BadRequestException('Invalid alertType: INVALID_TYPE'));
      });

      it('should accept all valid sortBy fields', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        const validSortFields = ['alert_id', 'txtp', 'priority', 'confidence_per', 'alert_status', 'source', 'alert_type', 'created_at'];

        for (const field of validSortFields) {
          await service.getAlertsForUser({
            ...defaultParams,
            sortBy: field,
          });

          expect(alertRepository.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              sortBy: field,
            }),
          );
        }
      });
    });

    describe('Filter by priority', () => {
      it('should filter alerts by valid priority', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          priority: 'critical',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              priority: Priority.CRITICAL,
            }),
          }),
        );
      });

      it('should accept priority in different cases', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[1]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          priority: 'UrGeNt',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              priority: Priority.URGENT,
            }),
          }),
        );
      });
    });

    describe('Filter by alertType', () => {
      it('should filter alerts by valid alertType', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          alertType: 'fraud',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              alert_type: CaseType.FRAUD,
            }),
          }),
        );
      });

      it('should accept alertType in different cases', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[1]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          alertType: 'aml',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              alert_type: CaseType.AML,
            }),
          }),
        );
      });
    });

    describe('Filter by type (txtp)', () => {
      it('should filter alerts by type', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          type: 'pacs.002.001.12',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              txtp: 'pacs.002.001.12',
            }),
          }),
        );
      });
    });

    describe('Filter by source', () => {
      it('should filter alerts by source', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          source: 'system-a',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              source: 'system-a',
            }),
          }),
        );
      });
    });

    describe('Filter by reportStatus', () => {
      it('should filter alerts by reportStatus', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          reportStatus: 'NEW',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              alert_data: {
                path: ['status'],
                equals: 'NEW',
              },
            }),
          }),
        );
      });

      it('should add case_id null filter when reportStatus is NALT', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          reportStatus: 'NALT',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              alert_data: {
                path: ['status'],
                equals: 'NALT',
              },
              case_id: null,
            }),
          }),
        );
      });

      it('should handle reportStatus case-insensitively for NALT', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          reportStatus: 'nalt',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              case_id: null,
            }),
          }),
        );
      });
    });

    describe('Search functionality', () => {
      it('should search by text in txtp field', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          search: 'pacs',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                { txtp: { contains: 'pacs', mode: 'insensitive' } },
              ]),
            }),
          }),
        );
      });

      it('should search by text in source field', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          search: 'system',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                { source: { contains: 'system', mode: 'insensitive' } },
              ]),
            }),
          }),
        );
      });

      it('should search by numeric alert_id', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          search: '123',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                { alert_id: { equals: 123 } },
                { case_id: { equals: 123 } },
              ]),
            }),
          }),
        );
      });

      it('should search by priority when search matches priority value', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          search: 'critical',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                { priority: { equals: Priority.CRITICAL } },
              ]),
            }),
          }),
        );
      });

      it('should search by alert_type when search matches CaseType value', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[1]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          search: 'aml',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                { alert_type: { equals: CaseType.AML } },
              ]),
            }),
          }),
        );
      });

      it('should include all search conditions for numeric value', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          search: 100,
        });

        const callArgs = alertRepository.findMany.mock.calls[0][0];
        expect(callArgs.where?.OR).toHaveLength(4); // txtp, source, alert_id, case_id
        expect(callArgs.where?.OR).toEqual(
          expect.arrayContaining([
            { txtp: { contains: 100, mode: 'insensitive' } },
            { source: { contains: 100, mode: 'insensitive' } },
            { alert_id: { equals: 100 } },
            { case_id: { equals: 100 } },
          ]),
        );
      });

      it('should handle search with both priority and number matching', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          search: '456',
        });

        const callArgs = alertRepository.findMany.mock.calls[0][0];
        expect(callArgs.where?.OR).toEqual(
          expect.arrayContaining([
            { alert_id: { equals: 456 } },
            { case_id: { equals: 456 } },
          ]),
        );
      });
    });

    describe('Combined filters', () => {
      it('should apply multiple filters together', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          priority: 'critical',
          type: 'pacs.002.001.12',
          source: 'system-a',
          alertType: 'fraud',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              tenant_id: 'tenant-123',
              priority: Priority.CRITICAL,
              txtp: 'pacs.002.001.12',
              source: 'system-a',
              alert_type: CaseType.FRAUD,
            }),
          }),
        );
      });

      it('should combine search with other filters', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          priority: 'critical',
          search: 'test',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              tenant_id: 'tenant-123',
              priority: Priority.CRITICAL,
              OR: expect.any(Array),
            }),
          }),
        );
      });
    });

    describe('Sorting and pagination', () => {
      it('should apply correct sorting order - asc', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        await service.getAlertsForUser({
          ...defaultParams,
          sortBy: 'priority',
          sortOrder: 'asc',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            sortBy: 'priority',
            sortOrder: 'asc',
          }),
        );
      });

      it('should apply correct sorting order - desc', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        await service.getAlertsForUser({
          ...defaultParams,
          sortBy: 'created_at',
          sortOrder: 'desc',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            sortBy: 'created_at',
            sortOrder: 'desc',
          }),
        );
      });

      it('should apply correct pagination parameters', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        await service.getAlertsForUser({
          ...defaultParams,
          page: 2,
          limit: 20,
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 2,
            limit: 20,
          }),
        );
      });

      it('should calculate totalPages correctly', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(25);

        const result = await service.getAlertsForUser({
          ...defaultParams,
          limit: 10,
        });

        expect(result.totalPages).toBe(3); // 25 / 10 = 3
      });

      it('should calculate totalPages correctly with exact division', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(20);

        const result = await service.getAlertsForUser({
          ...defaultParams,
          limit: 10,
        });

        expect(result.totalPages).toBe(2); // 20 / 10 = 2
      });

      it('should handle single page correctly', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        const result = await service.getAlertsForUser({
          ...defaultParams,
          limit: 10,
        });

        expect(result.totalPages).toBe(1);
      });
    });

    describe('Successful data retrieval', () => {
      it('should return paginated alerts with correct structure', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        const result = await service.getAlertsForUser({
          ...defaultParams,
        });

        expect(result).toEqual({
          data: mockAlerts,
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        });
      });

      it('should return empty array when no alerts found', async () => {
        alertRepository.findMany.mockResolvedValue([]);
        alertRepository.count.mockResolvedValue(0);

        const result = await service.getAlertsForUser({
          ...defaultParams,
        });

        expect(result).toEqual({
          data: [],
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        });
      });

      it('should call alertRepository.findMany with correct where clause', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        await service.getAlertsForUser({
          ...defaultParams,
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith({
          where: {
            tenant_id: 'tenant-123',
          },
          sortBy: 'created_at',
          sortOrder: 'desc',
          page: 1,
          limit: 10,
        });
      });

      it('should call alertRepository.count with correct where clause', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        await service.getAlertsForUser({
          ...defaultParams,
        });

        expect(alertRepository.count).toHaveBeenCalledWith({
          where: {
            tenant_id: 'tenant-123',
          },
        });
      });
    });

    describe('Error handling', () => {
      it('should handle repository findMany error and throw InternalServerErrorException', async () => {
        const error = new Error('Database connection failed');
        alertRepository.findMany.mockRejectedValue(error);

        await expect(
          service.getAlertsForUser({
            ...defaultParams,
          }),
        ).rejects.toThrow(new InternalServerErrorException('Unable to fetch alert list'));

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to fetch alerts: Database connection failed',
          error.stack,
          'AlertStatisticsService',
        );
      });

      it('should handle repository count error and throw InternalServerErrorException', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        const error = new Error('Count query failed');
        alertRepository.count.mockRejectedValue(error);

        await expect(
          service.getAlertsForUser({
            ...defaultParams,
          }),
        ).rejects.toThrow(new InternalServerErrorException('Unable to fetch alert list'));

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to fetch alerts: Count query failed',
          error.stack,
          'AlertStatisticsService',
        );
      });

      it('should handle non-Error exceptions', async () => {
        alertRepository.findMany.mockRejectedValue('String error');

        await expect(
          service.getAlertsForUser({
            ...defaultParams,
          }),
        ).rejects.toThrow(new InternalServerErrorException('Unable to fetch alert list'));

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to fetch alerts: String error',
          undefined,
          'AlertStatisticsService',
        );
      });

      it('should log error without stack when error is not an Error instance', async () => {
        alertRepository.findMany.mockRejectedValue({ message: 'Custom error object' });

        await expect(
          service.getAlertsForUser({
            ...defaultParams,
          }),
        ).rejects.toThrow(new InternalServerErrorException('Unable to fetch alert list'));

        expect(logger.error).toHaveBeenCalledWith(
          'Failed to fetch alerts: [object Object]',
          undefined,
          'AlertStatisticsService',
        );
      });
    });

    describe('Edge cases', () => {
      it('should handle undefined optional parameters', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        await service.getAlertsForUser({
          tenantId: 'tenant-123',
          page: 1,
          limit: 10,
          sortBy: 'created_at',
          sortOrder: 'desc',
          priority: undefined,
          type: undefined,
          alertType: undefined,
          search: undefined,
          source: undefined,
          reportStatus: undefined,
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              tenant_id: 'tenant-123',
            },
          }),
        );
      });

      it('should handle very large page numbers', async () => {
        alertRepository.findMany.mockResolvedValue([]);
        alertRepository.count.mockResolvedValue(0);

        const result = await service.getAlertsForUser({
          ...defaultParams,
          page: 999999,
        });

        expect(result.page).toBe(999999);
        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 999999,
          }),
        );
      });

      it('should handle very large limit values', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        const result = await service.getAlertsForUser({
          ...defaultParams,
          limit: 10000,
        });

        expect(result.limit).toBe(10000);
      });

      it('should not add OR clause for empty string search', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        await service.getAlertsForUser({
          ...defaultParams,
          search: '',
        });

        const callArgs = alertRepository.findMany.mock.calls[0][0];
        // Empty string is falsy, so OR clause won't be added
        expect(callArgs.where?.OR).toBeUndefined();
      });

      it('should not add OR clause for zero search value', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        await service.getAlertsForUser({
          ...defaultParams,
          search: 0,
        });

        const callArgs = alertRepository.findMany.mock.calls[0][0];
        // Zero is falsy, so OR clause won't be added
        expect(callArgs.where?.OR).toBeUndefined();
      });

      it('should handle negative numbers in search (but not add as id filters)', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        await service.getAlertsForUser({
          ...defaultParams,
          search: '-123',
        });

        const callArgs = alertRepository.findMany.mock.calls[0][0];
        expect(callArgs.where?.OR).toEqual(
          expect.arrayContaining([
            { txtp: { contains: '-123', mode: 'insensitive' } },
            { source: { contains: '-123', mode: 'insensitive' } },
          ]),
        );
      });

      it('should handle special characters in search', async () => {
        alertRepository.findMany.mockResolvedValue([]);
        alertRepository.count.mockResolvedValue(0);

        await service.getAlertsForUser({
          ...defaultParams,
          search: '@#$%^&*()',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                { txtp: { contains: '@#$%^&*()', mode: 'insensitive' } },
                { source: { contains: '@#$%^&*()', mode: 'insensitive' } },
              ]),
            }),
          }),
        );
      });
    });

    describe('tenantId filtering', () => {
      it('should always include tenantId in where clause', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        await service.getAlertsForUser({
          ...defaultParams,
          tenantId: 'specific-tenant',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              tenant_id: 'specific-tenant',
            }),
          }),
        );
      });

      it('should filter by tenantId with all other filters', async () => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        await service.getAlertsForUser({
          ...defaultParams,
          tenantId: 'tenant-xyz',
          priority: 'critical',
          alertType: 'fraud',
          search: 'test',
        });

        const callArgs = alertRepository.findMany.mock.calls[0][0];
        expect(callArgs.where?.tenant_id).toBe('tenant-xyz');
        expect(callArgs.where?.priority).toBe(Priority.CRITICAL);
        expect(callArgs.where?.alert_type).toBe(CaseType.FRAUD);
        expect(callArgs.where?.OR).toBeDefined();
      });
    });
  });
});
