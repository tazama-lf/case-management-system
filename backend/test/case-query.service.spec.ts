import { Test, TestingModule } from '@nestjs/testing';
import { CaseQueryService } from '../src/modules/case/services/case-query.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CaseRepository } from '../src/modules/repository/case.repository';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { TaskValidationUtil } from '../src/modules/shared/utils/task-validation.util';
import { SlaPolicyUtil } from '../src/modules/shared/utils/sla-policy.util';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CaseStatus, TaskStatus, CaseType, Priority } from '@prisma/client-cms';
import { GetUserCasesQueryDto } from '../src/modules/case/dto/get-user-cases.dto';
import { GetAllCasesQueryDto } from '../src/modules/case/dto/get-all-cases.dto';

describe('CaseQueryService', () => {
  let service: CaseQueryService;
  let prismaService: any;
  let logger: any;
  let caseRepository: any;
  let loggingOrchestrationService: any;
  let taskValidationUtil: any;
  let slaPolicyUtil: any;

  const mockCase = {
    case_id: 1,
    tenant_id: 'tenant-123',
    case_creator_user_id: 'user-creator',
    case_owner_user_id: 'user-123',
    status: CaseStatus.STATUS_20_IN_PROGRESS,
    case_type: CaseType.FRAUD,
<<<<<<< HEAD
    priority: Priority.CRITICAL,
=======
    priority: Priority.HIGH,
    parent_id: null,
>>>>>>> paysys/SLA-task
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-02'),
    tasks: [
      {
        task_id: 1,
        case_id: 1,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_10_ASSIGNED,
        assigned_user_id: 'user-123',
        tenant_id: 'tenant-123',
        created_at: new Date('2024-01-01'),
      },
    ],
    alert: {
      alert_id: 1,
      message: 'Suspicious transaction',
      confidence_per: 85,
      priority: Priority.HIGH,
      alert_type: 'FRAUD',
      transaction: { id: 'txn-123' },
    },
    comments: [
      {
        comment_id: 1,
        created_at: new Date('2024-01-02'),
      },
    ],
  };

  const setupGetAllCasesMocks = (caseData: any = mockCase, includeOldestUnassigned = false) => {
    // Ensure tasks array exists in the case data
    const caseWithTasks = { ...caseData, tasks: caseData.tasks || mockCase.tasks };

    prismaService.case.count.mockResolvedValueOnce(1);
    prismaService.case.findMany.mockResolvedValueOnce([caseWithTasks]);
    prismaService.case.groupBy
      .mockResolvedValueOnce([{ status: caseWithTasks.status, _count: { case_id: 1 } }])
      .mockResolvedValueOnce([{ priority: caseWithTasks.priority, _count: { case_id: 1 } }])
      .mockResolvedValueOnce([{ case_type: caseWithTasks.case_type, _count: { case_id: 1 } }]);
    prismaService.case.count.mockResolvedValueOnce(includeOldestUnassigned ? 1 : 0);
    if (includeOldestUnassigned) {
      prismaService.case.findFirst.mockResolvedValueOnce({
        case_id: 1,
        created_at: new Date('2024-01-01'),
      });
    }
  };

  const setupGetUserCasesMocks = (caseData = mockCase) => {
    prismaService.case.count.mockResolvedValueOnce(1); // total count
    prismaService.case.findMany.mockResolvedValueOnce([caseData]);
    prismaService.case.count
      .mockResolvedValueOnce(1) // ownedCasesCount
      .mockResolvedValueOnce(0); // taskAssignmentCasesCount
    prismaService.case.groupBy
      .mockResolvedValueOnce([{ status: caseData.status, _count: { case_id: 1 } }])
      .mockResolvedValueOnce([{ priority: caseData.priority, _count: { case_id: 1 } }]);
  };

  beforeEach(async () => {
    const mockPrismaService = {
      case: {
        count: jest.fn() as any,
        findMany: jest.fn() as any,
        findFirst: jest.fn() as any,
        groupBy: jest.fn() as any,
      },
      task: {
        count: jest.fn() as any,
        findMany: jest.fn() as any,
      },
    } as any;

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    const mockCaseRepository = {
      findCaseById: jest.fn(),
      updateCase: jest.fn(),
      createCase: jest.fn(),
    } as any;

    const mockLoggingOrchestrationService = {
      logActionsWithHistory: jest.fn(),
    } as any;

    const mockTaskValidationUtil = {
      findApprovalTask: jest.fn(),
      filterTasks: jest.fn(),
      getUserAssignedTasks: jest.fn().mockReturnValue([]),
      validateTask: jest.fn(),
      validateApprovalTask: jest.fn(),
      getTaskStatusCounts: jest.fn().mockReturnValue({ total: 0, completed: 0, in_progress: 0, unassigned: 0, pending: 0 }),
    } as any;

    const mockSlaPolicyUtil = {
      getEscalationRatios: jest.fn().mockResolvedValue({ dueSoonRatio: 0.2, atRiskRatio: 0.5 }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseQueryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LoggerService, useValue: mockLogger },
        { provide: CaseRepository, useValue: mockCaseRepository },
        { provide: LoggingOrchestrationService, useValue: mockLoggingOrchestrationService },
        { provide: TaskValidationUtil, useValue: mockTaskValidationUtil },
        { provide: SlaPolicyUtil, useValue: mockSlaPolicyUtil },
      ],
    }).compile();

    service = module.get<CaseQueryService>(CaseQueryService);
    prismaService = module.get(PrismaService);
    logger = module.get(LoggerService);
    caseRepository = module.get(CaseRepository);
    loggingOrchestrationService = module.get(LoggingOrchestrationService);
    taskValidationUtil = module.get(TaskValidationUtil);
    slaPolicyUtil = module.get(SlaPolicyUtil);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserCases', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const query: GetUserCasesQueryDto = {
      page: 1,
      limit: 20,
      sortBy: 'created_at',
      sortOrder: 'desc',
    };

    it('should return empty result when no conditions are met', async () => {
      const result = await service.getUserCases(userId, {}, tenantId);

      expect(result).toEqual({
        cases: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        summary: { totalOwnedCases: 0, totalTaskAssignments: 0, casesByStatus: {}, casesByPriority: {} },
      });
    });

    it('should get user cases with owned cases only', async () => {
      const queryWithOwned: GetUserCasesQueryDto = { ...query, includeOwnedCases: true };
      const caseWithoutTaskAssignment = {
        ...mockCase,
        tasks: [{ ...mockCase.tasks[0], assigned_user_id: 'other-user' }],
      };

      setupGetUserCasesMocks(caseWithoutTaskAssignment);

      const result = await service.getUserCases(userId, queryWithOwned, tenantId);

      expect(result.cases).toHaveLength(1);
      expect(result.cases[0].case_id).toBe(1);
      expect(result.cases[0].user_role).toBe('owner');
      expect(result.summary.totalOwnedCases).toBe(1);
      expect(result.summary.totalTaskAssignments).toBe(0);
    });

    it('should get user cases with task assignments only', async () => {
      const queryWithTasks: GetUserCasesQueryDto = { ...query, includeTaskAssignments: true };
      taskValidationUtil.getUserAssignedTasks.mockReturnValueOnce([{ task_id: 1, assigned_user_id: userId }]);

      prismaService.case.count.mockResolvedValueOnce(1);
      prismaService.case.findMany.mockResolvedValueOnce([{ ...mockCase, case_owner_user_id: 'other-user' }]);
      prismaService.case.count
        .mockResolvedValueOnce(0) // ownedCasesCount
        .mockResolvedValueOnce(1); // taskAssignmentCasesCount
      prismaService.case.groupBy
        .mockResolvedValueOnce([{ status: CaseStatus.STATUS_20_IN_PROGRESS, _count: { case_id: 1 } }])
        .mockResolvedValueOnce([{ priority: Priority.HIGH, _count: { case_id: 1 } }]);

      const result = await service.getUserCases(userId, queryWithTasks, tenantId);

      expect(result.cases).toHaveLength(1);
      expect(result.cases[0].user_role).toBe('task_assignee');
    });

    it('should get user cases with both owned and task assignments', async () => {
      const queryWithBoth: GetUserCasesQueryDto = {
        ...query,
        includeOwnedCases: true,
        includeTaskAssignments: true,
      };
      taskValidationUtil.getUserAssignedTasks.mockReturnValueOnce([{ task_id: 1, assigned_user_id: userId }]);

      prismaService.case.count.mockResolvedValueOnce(1);
      prismaService.case.findMany.mockResolvedValueOnce([mockCase]);
      prismaService.case.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
      prismaService.case.groupBy
        .mockResolvedValueOnce([{ status: CaseStatus.STATUS_20_IN_PROGRESS, _count: { case_id: 1 } }])
        .mockResolvedValueOnce([{ priority: Priority.HIGH, _count: { case_id: 1 } }]);

      const result = await service.getUserCases(userId, queryWithBoth, tenantId);

      expect(result.cases).toHaveLength(1);
      expect(result.cases[0].user_role).toBe('both');
    });

    it.each([
      ['status', { status: CaseStatus.STATUS_20_IN_PROGRESS }],
      ['priority', { priority: Priority.HIGH }],
    ])('should filter by %s', async (filterName, filterValue) => {
      const queryWithFilter: GetUserCasesQueryDto = { ...query, includeOwnedCases: true, ...filterValue };
      setupGetUserCasesMocks();

      const result = await service.getUserCases(userId, queryWithFilter, tenantId);

      expect(result.cases).toHaveLength(1);
    });

    it('should handle compliance officer filtering', async () => {
      const queryWithOwned: GetUserCasesQueryDto = { ...query, includeOwnedCases: true };
      const closedCase = { ...mockCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED };

      prismaService.case.count.mockResolvedValueOnce(1);
      prismaService.case.findMany.mockResolvedValueOnce([closedCase]);
      prismaService.case.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      prismaService.case.groupBy
        .mockResolvedValueOnce([{ status: CaseStatus.STATUS_82_CLOSED_CONFIRMED, _count: { case_id: 1 } }])
        .mockResolvedValueOnce([{ priority: Priority.HIGH, _count: { case_id: 1 } }]);

      const result = await service.getUserCases(userId, queryWithOwned, tenantId, true);

      expect(result.cases).toHaveLength(1);
    });

    it('should handle pagination', async () => {
      const queryWithPage: GetUserCasesQueryDto = { ...query, includeOwnedCases: true, page: 2, limit: 10 };

      prismaService.case.count.mockResolvedValueOnce(15);
      prismaService.case.findMany.mockResolvedValueOnce([mockCase]);
      prismaService.case.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      prismaService.case.groupBy
        .mockResolvedValueOnce([{ status: CaseStatus.STATUS_20_IN_PROGRESS, _count: { case_id: 1 } }])
        .mockResolvedValueOnce([{ priority: Priority.HIGH, _count: { case_id: 1 } }]);

      const result = await service.getUserCases(userId, queryWithPage, tenantId);

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should handle errors', async () => {
      const queryWithOwned: GetUserCasesQueryDto = { ...query, includeOwnedCases: true };
      prismaService.case.count.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.getUserCases(userId, queryWithOwned, tenantId)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalled();
    });

    it('resolves SLA escalation ratios once per distinct tenant across the returned cases', async () => {
      const queryWithOwned: GetUserCasesQueryDto = { ...query, includeOwnedCases: true };
      const caseTenantA1 = { ...mockCase, case_id: 1, tenant_id: 'tenant-a' };
      const caseTenantA2 = { ...mockCase, case_id: 2, tenant_id: 'tenant-a' };
      const caseTenantB = { ...mockCase, case_id: 3, tenant_id: 'tenant-b' };

      prismaService.case.count.mockResolvedValueOnce(3);
      prismaService.case.findMany.mockResolvedValueOnce([caseTenantA1, caseTenantA2, caseTenantB]);
      prismaService.case.count.mockResolvedValueOnce(3).mockResolvedValueOnce(0);
      prismaService.case.groupBy
        .mockResolvedValueOnce([{ status: mockCase.status, _count: { case_id: 3 } }])
        .mockResolvedValueOnce([{ priority: mockCase.priority, _count: { case_id: 3 } }]);

      const result = await service.getUserCases(userId, queryWithOwned);

      expect(result.cases).toHaveLength(3);
      expect(slaPolicyUtil.getEscalationRatios).toHaveBeenCalledTimes(2);
      expect(slaPolicyUtil.getEscalationRatios).toHaveBeenCalledWith('tenant-a');
      expect(slaPolicyUtil.getEscalationRatios).toHaveBeenCalledWith('tenant-b');
    });
  });

  describe('getAllCases', () => {
    const tenantId = 'tenant-123';
    const query: GetAllCasesQueryDto = {
      page: 1,
      limit: 20,
      sortBy: 'created_at',
      sortOrder: 'desc',
    };

    it('should get all cases with basic filters', async () => {
      setupGetAllCasesMocks();

      const result = await service.getAllCases(query, tenantId);

      expect(result.cases).toHaveLength(1);
      expect(result.statistics.totalCases).toBe(1);
      expect(logger.log).toHaveBeenCalled();
    });

    it.each([
      ['status', { status: CaseStatus.STATUS_20_IN_PROGRESS }],
      ['priority', { priority: Priority.HIGH }],
      ['case type', { caseType: CaseType.FRAUD }],
      ['owner id', { ownerId: 'user-123' }],
      ['date range', { createdAfter: '2024-01-01', createdBefore: '2024-01-31' }],
      ['exclude draft', { excludeDraft: true }],
      ['exclude closed', { excludeClosed: true }],
    ])('should filter by %s', async (filterName, filterValue) => {
      const queryWithFilter: GetAllCasesQueryDto = { ...query, ...filterValue };
      setupGetAllCasesMocks();

      const result = await service.getAllCases(queryWithFilter, tenantId);

      expect(result.cases).toHaveLength(1);
    });

    it('should filter by closed only', async () => {
      const queryWithFilter: GetAllCasesQueryDto = { ...query, closedOnly: true };
      setupGetAllCasesMocks({ ...mockCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED });

      const result = await service.getAllCases(queryWithFilter, tenantId);

      expect(result.cases).toHaveLength(1);
    });

    it('should filter unassigned cases and include oldest unassigned case', async () => {
      const queryUnassigned: GetAllCasesQueryDto = { ...query, unassignedOnly: true };
      setupGetAllCasesMocks({ ...mockCase, case_owner_user_id: null }, true);

      const result = await service.getAllCases(queryUnassigned, tenantId);

      expect(result.cases).toHaveLength(1);
      expect(result.statistics.oldestUnassignedCase).toBeDefined();
    });

    it.each([
      ['STATUS_30_COMPLETED', TaskStatus.STATUS_30_COMPLETED],
      ['N/A', 'N/A' as any],
    ])('should filter by SAR/STR status %s', async (statusName, sarStrStatus) => {
      const queryWithSarStr: GetAllCasesQueryDto = { ...query, sarStrStatus };
      setupGetAllCasesMocks();

      const result = await service.getAllCases(queryWithSarStr, tenantId);

      expect(result.cases).toHaveLength(1);
    });

    it.each([
      ['case id', '1'],
      ['case type partial match', 'fr'],
      ['status partial match', 'pending'],
      ['alert message', 'suspicious'],
      ['confidence score', '85'],
      ['whitespace handling', '  suspicious  '],
    ])('should search by %s', async (searchType, searchTerm) => {
      const queryWithSearch: GetAllCasesQueryDto = { ...query, search: searchTerm };
      setupGetAllCasesMocks();

      const result = await service.getAllCases(queryWithSearch, tenantId);

      expect(result.cases).toHaveLength(1);
      expect(logger.log).toHaveBeenCalled();
    });

    it('should search for N/A cases', async () => {
      const queryWithSearch: GetAllCasesQueryDto = { ...query, search: 'N/A' };
      setupGetAllCasesMocks();

      const result = await service.getAllCases(queryWithSearch, tenantId);

      expect(result.cases).toHaveLength(1);
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('N/A search filter created'), 'CaseQueryService');
    });

    it('should handle no search conditions', async () => {
      const queryWithSearch: GetAllCasesQueryDto = { ...query, search: 'xyz123abc' };

      prismaService.case.count.mockResolvedValueOnce(0);
      prismaService.case.findMany.mockResolvedValueOnce([]);
      prismaService.case.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      prismaService.case.count.mockResolvedValueOnce(0);

      const result = await service.getAllCases(queryWithSearch, tenantId);

      expect(result.cases).toHaveLength(0);
      expect(logger.log).toHaveBeenCalled();
    });

    it.each([
      ['basic filtering', query, undefined],
      ['with SAR/STR search', { ...query, search: 'assigned' }, undefined],
      ['with SAR/STR filter', { ...query, sarStrStatus: TaskStatus.STATUS_30_COMPLETED }, undefined],
    ])('should handle compliance officer %s', async (testName, testQuery, _) => {
      const closedCase = { ...mockCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED };
      setupGetAllCasesMocks(closedCase);

      const result = await service.getAllCases(testQuery, tenantId, undefined, true);

      expect(result.cases).toHaveLength(1);
      expect(logger.log).toHaveBeenCalled();
    });

    it.each([
      ['basic filtering', query],
      ['with search', { ...query, search: 'fraud' }],
      ['with SAR/STR status', { ...query, sarStrStatus: TaskStatus.STATUS_30_COMPLETED }],
    ])('should handle investigator %s', async (testName, testQuery) => {
      const investigatorId = 'investigator-123';
      setupGetAllCasesMocks();

      const result = await service.getAllCases(testQuery, tenantId, investigatorId);

      expect(result.cases).toHaveLength(1);
    });

    it('should calculate average tasks per case', async () => {
      prismaService.case.count.mockResolvedValueOnce(2);
      prismaService.case.findMany.mockResolvedValueOnce([
        mockCase,
        { ...mockCase, case_id: 2, tasks: [mockCase.tasks[0], mockCase.tasks[0]] },
      ]);
      prismaService.case.groupBy
        .mockResolvedValueOnce([{ status: CaseStatus.STATUS_20_IN_PROGRESS, _count: { case_id: 2 } }])
        .mockResolvedValueOnce([{ priority: Priority.HIGH, _count: { case_id: 2 } }])
        .mockResolvedValueOnce([{ case_type: CaseType.FRAUD, _count: { case_id: 2 } }]);
      prismaService.case.count.mockResolvedValueOnce(0);

      const result = await service.getAllCases(query, tenantId);

      expect(result.statistics.averageTasksPerCase).toBeGreaterThan(0);
    });

    it('should handle errors', async () => {
      prismaService.case.count.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.getAllCases(query, tenantId)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalled();
    });

    it("computes sla_state using the requested tenant's escalation ratios", async () => {
      const now = new Date('2024-01-01T18:00:00.000Z'); // 18h into a 24h budget -> remaining ratio 0.25
      jest.useFakeTimers().setSystemTime(now);
      const caseWithSla = {
        ...mockCase,
        created_at: new Date('2024-01-01T00:00:00.000Z'),
        sla_due_at: new Date('2024-01-02T00:00:00.000Z'),
      };
      setupGetAllCasesMocks(caseWithSla);
      // Default ratios (0.2/0.5) would put remaining ratio 0.25 in AT_RISK; widen due-soon so it's DUE_SOON instead.
      slaPolicyUtil.getEscalationRatios.mockResolvedValueOnce({ dueSoonRatio: 0.3, atRiskRatio: 0.5 });

      const result = await service.getAllCases(query, tenantId);

      expect(slaPolicyUtil.getEscalationRatios).toHaveBeenCalledWith(tenantId);
      expect(result.cases[0].sla_state).toBe('DUE_SOON');
      jest.useRealTimers();
    });
  });

  describe('getUserWorkloadStats', () => {
    const userId = 'user-123';

    it('should get user workload statistics', async () => {
      const mockActiveCases = [
        {
          case_id: 1,
          status: CaseStatus.STATUS_20_IN_PROGRESS,
          priority: Priority.HIGH,
          created_at: new Date('2024-01-01'),
        },
      ];
      const mockTasks = [
        {
          task_id: 1,
          name: 'Task 1',
          case_id: 1,
          created_at: new Date('2024-01-01'),
        },
      ];

      prismaService.case.count.mockResolvedValueOnce(1);
      prismaService.task.count.mockResolvedValueOnce(2);
      prismaService.case.findMany.mockResolvedValueOnce(mockActiveCases);
      prismaService.task.findMany.mockResolvedValueOnce(mockTasks);

      const result = await service.getUserWorkloadStats(userId);

      expect(result.totalActiveCases).toBe(1);
      expect(result.totalPendingTasks).toBe(2);
      expect(result.casesByStatus).toBeDefined();
      expect(result.casesByPriority).toBeDefined();
      expect(result.oldestCase).toBeDefined();
      expect(result.averageCaseAge).toBeGreaterThan(0);
      expect(result.upcomingTasks).toHaveLength(1);
    });

    it('should handle compliance officer filtering', async () => {
      prismaService.case.count.mockResolvedValueOnce(1);
      prismaService.task.count.mockResolvedValueOnce(0);
      prismaService.case.findMany.mockResolvedValueOnce([]);
      prismaService.task.findMany.mockResolvedValueOnce([]);

      const result = await service.getUserWorkloadStats(userId, true);

      expect(result.totalActiveCases).toBe(1);
      expect(result.totalPendingTasks).toBe(0);
    });

    it('should handle no cases', async () => {
      prismaService.case.count.mockResolvedValueOnce(0);
      prismaService.task.count.mockResolvedValueOnce(0);
      prismaService.case.findMany.mockResolvedValueOnce([]);
      prismaService.task.findMany.mockResolvedValueOnce([]);

      const result = await service.getUserWorkloadStats(userId);

      expect(result.totalActiveCases).toBe(0);
      expect(result.totalPendingTasks).toBe(0);
      expect(result.oldestCase).toBeNull();
      expect(result.averageCaseAge).toBe(0);
    });

    it('should handle errors', async () => {
      prismaService.case.count.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.getUserWorkloadStats(userId)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('retrieveCase', () => {
    const caseId = 1;
    const tenantId = 'tenant-123';

    it('should retrieve a case successfully', async () => {
      caseRepository.findCaseById.mockResolvedValueOnce(mockCase as any);

      const result = await service.retrieveCase(caseId, tenantId);

      expect(result).toEqual({ ...mockCase, sla_state: null });
      expect(caseRepository.findCaseById).toHaveBeenCalledWith(caseId, tenantId);
    });

    it('should return null when case not found', async () => {
      caseRepository.findCaseById.mockResolvedValueOnce(null);

      const result = await service.retrieveCase(caseId, tenantId);

      expect(result).toBeNull();
      expect(slaPolicyUtil.getEscalationRatios).not.toHaveBeenCalled();
    });

    it('resolves escalation ratios for the requested tenant', async () => {
      caseRepository.findCaseById.mockResolvedValueOnce(mockCase as any);

      await service.retrieveCase(caseId, tenantId);

      expect(slaPolicyUtil.getEscalationRatios).toHaveBeenCalledWith(tenantId);
    });

    it('should allow compliance officer to access STATUS_82_CLOSED_CONFIRMED case', async () => {
      const closedCase = { ...mockCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED };
      caseRepository.findCaseById.mockResolvedValueOnce(closedCase as any);

      const result = await service.retrieveCase(caseId, tenantId, true);

      expect(result).toEqual({ ...closedCase, sla_state: null });
    });

    // it('should throw ForbiddenException when compliance officer tries to access non-closed case', async () => {
    //   caseRepository.findCaseById.mockResolvedValueOnce(mockCase as any);

    //   await expect(service.retrieveCase(caseId, tenantId, true)).rejects.toThrow(ForbiddenException);
    // });
  });

<<<<<<< HEAD
=======
  describe('getSubCasesDetails', () => {
    const caseId = 1;

    it('should get sub-cases for a parent case', async () => {
      const mockSubCases = [
        { ...mockCase, case_id: 2, parent_id: caseId },
        { ...mockCase, case_id: 3, parent_id: caseId },
      ];

      prismaService.case.findMany.mockResolvedValueOnce(mockSubCases as any);

      const result = await service.getSubCasesDetails(caseId);

      expect(result).toHaveLength(2);
      expect(result[0].parent_id).toBe(caseId);
    });

    it('should return empty array when no sub-cases found', async () => {
      prismaService.case.findMany.mockResolvedValueOnce([]);

      const result = await service.getSubCasesDetails(caseId);
      expect(result).toEqual([]);
      expect(slaPolicyUtil.getEscalationRatios).not.toHaveBeenCalled();
    });

    it('resolves escalation ratios once per distinct tenant among the sub-cases', async () => {
      const mockSubCases = [
        { ...mockCase, case_id: 2, parent_id: caseId, tenant_id: 'tenant-a' },
        { ...mockCase, case_id: 3, parent_id: caseId, tenant_id: 'tenant-a' },
      ];
      prismaService.case.findMany.mockResolvedValueOnce(mockSubCases as any);

      const result = await service.getSubCasesDetails(caseId);

      expect(result).toHaveLength(2);
      expect(slaPolicyUtil.getEscalationRatios).toHaveBeenCalledTimes(1);
      expect(slaPolicyUtil.getEscalationRatios).toHaveBeenCalledWith('tenant-a');
    });
  });

>>>>>>> paysys/SLA-task
  describe('updateCase', () => {
    const caseId = 1;
    const userId = 'user-123';
    const updateData = {
      caseType: CaseType.FRAUD,
      priority: Priority.MEDIUM,
      status: CaseStatus.STATUS_20_IN_PROGRESS,
      caseOwnerUserId: 'user-456',
    };

    it('should update a case successfully', async () => {
      caseRepository.updateCase.mockResolvedValueOnce(mockCase as any);

      const result = await service.updateCase(caseId, updateData, userId);

      expect(result).toEqual({ ...mockCase, sla_state: null });
      expect(caseRepository.updateCase).toHaveBeenCalledWith(caseId, {
        case_type: updateData.caseType,
        priority: updateData.priority,
        status: updateData.status,
        case_owner_user_id: updateData.caseOwnerUserId,
      });
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should update case with partial data', async () => {
      const partialUpdate = { priority: Priority.LOW };
      caseRepository.updateCase.mockResolvedValueOnce(mockCase as any);

      const result = await service.updateCase(caseId, partialUpdate, userId);

      expect(result).toEqual({ ...mockCase, sla_state: null });
      expect(caseRepository.updateCase).toHaveBeenCalledWith(caseId, {
        case_type: undefined,
        priority: Priority.LOW,
        status: undefined,
        case_owner_user_id: undefined,
      });
    });

    it('should handle errors during update', async () => {
      caseRepository.updateCase.mockRejectedValueOnce(new Error('Update failed'));

      await expect(service.updateCase(caseId, updateData, userId)).rejects.toThrow('Update failed');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error updating case'), expect.any(String), 'CaseQueryService');
    });

    it("resolves escalation ratios using the updated case's own tenant", async () => {
      const updatedCase = { ...mockCase, tenant_id: 'tenant-updated' };
      caseRepository.updateCase.mockResolvedValueOnce(updatedCase as any);

      await service.updateCase(caseId, updateData, userId);

      expect(slaPolicyUtil.getEscalationRatios).toHaveBeenCalledWith('tenant-updated');
    });
  });
});
