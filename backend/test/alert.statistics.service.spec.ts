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

  const defaultParams = {
    tenantId: 'tenant-123',
    page: 1,
    limit: 10,
    sortBy: 'created_at',
    sortOrder: 'desc' as const,
  };

  // Helper function to create mock repository
  const createMockRepository = () => ({
    findMany: jest.fn(),
    count: jest.fn(),
  });

  // Helper function to create mock logger
  const createMockLogger = () => ({
    error: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  });

  beforeEach(async () => {
    const mockAlertRepository = createMockRepository();
    const mockLogger = createMockLogger();

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
    describe('Validation', () => {
      it.each([
        ['zero', 0],
        ['negative', -1],
        ['decimal', 1.5],
      ])('should throw BadRequestException when page is %s', async (_desc, page) => {
        await expect(
          service.getAlertsForUser({
            ...defaultParams,
            page,
          }),
        ).rejects.toThrow(new BadRequestException('Page must be a positive integer'));
      });

      it.each([
        ['zero', 0],
        ['negative', -5],
        ['decimal', 2.7],
      ])('should throw BadRequestException when limit is %s', async (_desc, limit) => {
        await expect(
          service.getAlertsForUser({
            ...defaultParams,
            limit,
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

      it('should throw BadRequestException when date range values are invalid', async () => {
        await expect(
          service.getAlertsForUser({
            ...defaultParams,
            startDate: 'not-a-date',
          }),
        ).rejects.toThrow(new BadRequestException('Invalid startDate: not-a-date'));

        await expect(
          service.getAlertsForUser({
            ...defaultParams,
            endDate: 'still-not-a-date',
          }),
        ).rejects.toThrow(new BadRequestException('Invalid endDate: still-not-a-date'));
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
      it.each([
        ['lowercase', 'critical', Priority.CRITICAL],
        ['mixed case', 'UrGeNt', Priority.URGENT],
      ])('should filter alerts by priority with %s', async (_desc, input, expected) => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          priority: input,
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              priority: expected,
            }),
          }),
        );
      });
    });

    describe('Filter by alertType', () => {
      it.each([
        ['fraud lowercase', 'fraud', CaseType.FRAUD],
        ['aml lowercase', 'aml', CaseType.AML],
      ])('should filter alerts by %s', async (_desc, input, expected) => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          alertType: input,
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              alert_type: expected,
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

    describe('Filter by date range', () => {
      it('should filter alerts by created_at range', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-01-31T23:59:59.999Z',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              created_at: {
                gte: new Date('2026-01-01T00:00:00.000Z'),
                lte: new Date('2026-01-31T23:59:59.999Z'),
              },
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

      it.each([
        ['uppercase', 'NALT'],
        ['lowercase', 'nalt'],
      ])('should add case_id null filter when reportStatus is %s', async (_desc, status) => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          reportStatus: status,
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              alert_data: {
                path: ['status'],
                equals: status,
              },
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
              OR: expect.arrayContaining([{ txtp: { contains: 'pacs', mode: 'insensitive' } }]),
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
              OR: expect.arrayContaining([{ source: { contains: 'system', mode: 'insensitive' } }]),
            }),
          }),
        );
      });

      it('should search by exact transaction id in supported transaction message paths', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          search: 'TX-ABC-123',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([
                {
                  transaction: {
                    path: ['FIToFIPmtSts', 'GrpHdr', 'MsgId'],
                    equals: 'TX-ABC-123',
                  },
                },
                {
                  transaction: {
                    path: ['FIToFICstmrCdt', 'GrpHdr', 'MsgId'],
                    equals: 'TX-ABC-123',
                  },
                },
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
              OR: expect.arrayContaining([{ alert_id: { equals: 123 } }]),
            }),
          }),
        );
      });

      it('should search by displayed ALERT-prefixed alert id', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          search: 'ALERT-123',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([{ alert_id: { equals: 123 } }]),
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
              OR: expect.arrayContaining([{ priority: { equals: Priority.CRITICAL } }]),
            }),
          }),
        );
      });

      it('should search by alert_type when search matches CaseType value', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          search: 'aml',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.arrayContaining([{ alert_type: { equals: CaseType.AML } }]),
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
        expect(callArgs.where?.OR).toHaveLength(5);
        expect(callArgs.where?.OR).toEqual(
          expect.arrayContaining([
            { txtp: { contains: '100', mode: 'insensitive' } },
            { source: { contains: '100', mode: 'insensitive' } },
            {
              transaction: {
                path: ['FIToFIPmtSts', 'GrpHdr', 'MsgId'],
                equals: '100',
              },
            },
            {
              transaction: {
                path: ['FIToFICstmrCdt', 'GrpHdr', 'MsgId'],
                equals: '100',
              },
            },
            { alert_id: { equals: 100 } },
          ]),
        );
      });

      it('should handle numeric search without matching case id', async () => {
        alertRepository.findMany.mockResolvedValue([mockAlerts[0]]);
        alertRepository.count.mockResolvedValue(1);

        await service.getAlertsForUser({
          ...defaultParams,
          search: '456',
        });

        const callArgs = alertRepository.findMany.mock.calls[0][0];
        expect(callArgs.where?.OR).toEqual(expect.arrayContaining([{ alert_id: { equals: 456 } }]));
        expect(callArgs.where?.OR).toEqual(expect.not.arrayContaining([{ case_id: { equals: 456 } }]));
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
      it.each([
        ['asc', 'priority', 'asc'],
        ['desc', 'created_at', 'desc'],
      ])('should apply correct sorting order - %s', async (_desc, sortBy, sortOrder) => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        await service.getAlertsForUser({
          ...defaultParams,
          sortBy,
          sortOrder: sortOrder as 'asc' | 'desc',
        });

        expect(alertRepository.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            sortBy,
            sortOrder,
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

      it.each([
        ['with remainder', 25, 10, 3],
        ['exact division', 20, 10, 2],
        ['single page', 1, 10, 1],
      ])('should calculate totalPages correctly - %s', async (_desc, total, limit, expectedPages) => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(total);

        const result = await service.getAlertsForUser({
          ...defaultParams,
          limit,
        });

        expect(result.totalPages).toBe(expectedPages);
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
      it.each([
        ['findMany error', 'findMany', 'Database connection failed'],
        ['count error', 'count', 'Count query failed'],
      ])('should handle repository %s and throw InternalServerErrorException', async (_desc, method, errorMsg) => {
        const error = new Error(errorMsg);
        if (method === 'findMany') {
          alertRepository.findMany.mockRejectedValue(error);
        } else {
          alertRepository.findMany.mockResolvedValue(mockAlerts);
          alertRepository.count.mockRejectedValue(error);
        }

        await expect(
          service.getAlertsForUser({
            ...defaultParams,
          }),
        ).rejects.toThrow(new InternalServerErrorException('Unable to fetch alert list'));

        expect(logger.error).toHaveBeenCalledWith(`Failed to fetch alerts: ${errorMsg}`, error.stack, 'AlertStatisticsService');
      });

      it.each([
        ['string error', 'String error'],
        ['custom error object', { message: 'Custom error object' }],
      ])('should handle non-Error exceptions - %s', async (_desc, error) => {
        alertRepository.findMany.mockRejectedValue(error);

        await expect(
          service.getAlertsForUser({
            ...defaultParams,
          }),
        ).rejects.toThrow(new InternalServerErrorException('Unable to fetch alert list'));

        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch alerts:'), undefined, 'AlertStatisticsService');
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

      it.each([
        ['very large page numbers', 999999, 10],
        ['very large limit values', 1, 10000],
      ])('should handle %s', async (_desc, page, limit) => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        const result = await service.getAlertsForUser({
          ...defaultParams,
          page,
          limit,
        });

        expect(result.page).toBe(page);
        expect(result.limit).toBe(limit);
      });

      it.each([
        ['empty string', ''],
        ['zero', 0],
      ])('should not add OR clause for %s search', async (_desc, search) => {
        alertRepository.findMany.mockResolvedValue(mockAlerts);
        alertRepository.count.mockResolvedValue(2);

        await service.getAlertsForUser({
          ...defaultParams,
          search,
        });

        const callArgs = alertRepository.findMany.mock.calls[0][0];
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
