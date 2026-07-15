import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from '../src/modules/report/report.service';
import { PrismaService } from '../prisma/prisma.service';
import { EvidenceService } from '../src/modules/evidence/evidence.service';
import { CouchdbService } from '../src/modules/couchdb/couchdb.service';
import { NotificationService } from '../src/modules/notification/notification.service';
import { EventLogService } from '../src/modules/event_log/eventLog.service';
import { SlaPolicyUtil } from '../src/modules/shared/utils/sla-policy.util';
import { BadRequestException } from '@nestjs/common';
import { CaseStatus, CaseType, TaskStatus } from '@prisma/client-cms';
import { FraudReportOutcome } from '../src/modules/report/report.model';

describe('ReportsService', () => {
  let service: ReportsService;
  let prismaService: any;
  let evidenceService: any;
  let couchdbService: any;
  let notificationService: any;
  let eventLogService: any;

  const mockDate = new Date('2026-03-20T12:00:00.000Z');
  const mockCase = {
    case_id: 1,
    case_type: CaseType.AML,
    priority: 'HIGH',
    case_owner_user_id: 'user-123',
    status: CaseStatus.STATUS_20_IN_PROGRESS,
    created_at: new Date('2026-02-20T12:00:00.000Z'),
    updated_at: new Date('2026-03-20T12:00:00.000Z'),
    alert: { tenant_id: 'tenant-123' },
  };

  const mockTask = {
    task_id: 1,
    case_id: 1,
    name: 'Investigate transaction',
    status: TaskStatus.STATUS_20_IN_PROGRESS,
    assigned_user_id: 'user-123',
  };

  const mockEventLog = {
    event_log_id: 1,
    user_id: 'user-123',
    operation: 'UPDATE',
    entity_name: 'Case',
    action_performed: 'Case updated',
    outcome: 'SUCCESS',
    performed_at: mockDate,
  };

  const mockFraudReport = {
    reportId: '1-InvestigationReport-v1',
    caseId: 1,
    reportType: 'INVESTIGATION_REPORT',
    metadata: [
      {
        fileName: 'report.pdf',
        fileSize: 1024,
        filePath: '/path/to/report.pdf',
        mimeType: 'application/pdf',
        hash: 'abc123',
        encryption: { key: 'key', iv: 'iv', authTag: 'tag' },
        caseType: 'AML',
        investigator: 'user-123',
        supervisor: 'supervisor-123',
        description: 'Test report',
        submittedAt: mockDate.toISOString(),
      },
    ],
    keyFindings: 'Test findings',
    evidenceSummary: [],
    decisions: FraudReportOutcome.UNDER_MONITORING,
    investigatorInputs: 'Test inputs',
    supervisorRemarks: 'Test remarks',
    recommendations: 'Test recommendations',
    archived: false,
    version: 1,
    history: [],
    category: 'report',
    locked: false,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      case: {
        groupBy: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      task: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      cms_usernames: {
        findMany: jest.fn(),
      },
    };

    const mockEvidenceService = {
      getEvidenceByCaseId: jest.fn(),
    };

    const mockCouchdbService = {
      getDatabase: jest.fn(),
      getDocument: jest.fn(),
      insertDocument: jest.fn(),
      updateDocument: jest.fn(),
      insertAttachment: jest.fn(),
    };

    const mockNotificationService = {
      sendGroupNotification: jest.fn(),
    };

    const mockEventLogService = {
      getLogs: jest.fn(),
    };

    const mockSlaPolicyUtil = {
      getEscalationRatios: jest.fn().mockResolvedValue({ dueSoonRatio: 0.2, atRiskRatio: 0.5 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EvidenceService, useValue: mockEvidenceService },
        { provide: CouchdbService, useValue: mockCouchdbService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: EventLogService, useValue: mockEventLogService },
        { provide: SlaPolicyUtil, useValue: mockSlaPolicyUtil },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prismaService = module.get(PrismaService);
    evidenceService = module.get(EvidenceService);
    couchdbService = module.get(CouchdbService);
    notificationService = module.get(NotificationService);
    eventLogService = module.get(EventLogService);

    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('getCaseStatus', () => {
    beforeEach(() => {
      prismaService.case.groupBy.mockResolvedValue([
        { status: CaseStatus.STATUS_20_IN_PROGRESS, _count: { case_id: 5 } },
        { status: CaseStatus.STATUS_81_CLOSED_REFUTED, _count: { case_id: 3 } },
      ]);
      prismaService.case.count.mockResolvedValue(8);
      prismaService.case.findMany.mockResolvedValue([
        { created_at: new Date('2026-02-01'), updated_at: new Date('2026-02-10') },
        { created_at: new Date('2026-02-05'), updated_at: new Date('2026-02-15') },
      ]);
    });

    it('should return case status report with default date range (last30)', async () => {
      const result = await service.getCaseStatus(undefined, { tenantId: 'tenant-123' });

      expect(result).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.stats.totalCases).toBe(8);
      expect(result.statusDistribution).toBeDefined();
      expect(result.caseTypes).toBeDefined();
    });

    it.each(['today', 'yesterday', 'last7', 'last90', 'thisMonth', 'lastYear'])(
      'should return case status report for %s',
      async (timeRange) => {
        const result = await service.getCaseStatus(timeRange, { tenantId: 'tenant-123' });
        expect(result).toBeDefined();
        expect(prismaService.case.groupBy).toHaveBeenCalled();
      },
    );

    it('should filter by caseType', async () => {
      const result = await service.getCaseStatus('last30', {
        tenantId: 'tenant-123',
        caseType: 'AML',
      });

      expect(result).toBeDefined();
      expect(prismaService.case.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            case_type: 'AML',
          }),
        }),
      );
    });

    it.each([
      ['priority', { priority: 'HIGH' }, { priority: 'HIGH' }],
      ['investigator', { investigator: 'user-123' }, { case_owner_user_id: 'user-123' }],
      ['requestingUserId', { requestingUserId: 'user-123' }, {}],
    ])('should filter by %s', async (_filterName, filterParam, expectedWhereClause) => {
      const result = await service.getCaseStatus('last30', {
        tenantId: 'tenant-123',
        ...filterParam,
      });

      expect(result).toBeDefined();
      expect(prismaService.case.groupBy).toHaveBeenCalled();
      if (Object.keys(expectedWhereClause).length > 0) {
        expect(prismaService.case.groupBy).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining(expectedWhereClause),
          }),
        );
      }
    });

    it('should count totalCases from the role-visible scope, not creator-only cases', async () => {
      prismaService.case.count
        .mockResolvedValueOnce(12)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(2);

      const result = await service.getCaseStatus('all', {
        tenantId: 'tenant-123',
        isInvestigator: true,
        requestingUserId: 'user-123',
      });

      expect(result.stats.totalCases).toBe(12);
      expect(prismaService.case.count).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            case_creator_user_id: 'user-123',
          }),
        }),
      );
    });

    it('should count FRAUD_AND_AML container cases only while DRAFT or pending case creation approval, everywhere', async () => {
      const result = await service.getCaseStatus('all', { tenantId: 'tenant-123' });

      expect(result).toBeDefined();

      // Every case-scoped query (Total Cases, Closed, Available, Open & Assigned,
      // Resolved This Month, status/type breakdowns) shares this one container
      // filter now - FRAUD_AND_AML cases count while DRAFT or pending creation
      // approval, and are excluded in every other status.
      expect(prismaService.case.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: [
                  { case_type: null },
                  { case_type: { not: CaseType.FRAUD_AND_AML } },
                  {
                    case_type: CaseType.FRAUD_AND_AML,
                    status: { in: [CaseStatus.STATUS_00_DRAFT, CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL] },
                  },
                ],
              }),
            ]),
          }),
        }),
      );
    });

    it('excludes abandoned cases from every case-scoped query, not just the closed-status buckets', async () => {
      const result = await service.getCaseStatus('all', { tenantId: 'tenant-123' });

      expect(result).toBeDefined();

      // Abandoned cases are excluded everywhere via the same AND-composed
      // filter that excludes FRAUD_AND_AML containers, so Total Cases,
      // Resolved This Month, and every other count treat abandoning a case
      // as making it disappear from reporting entirely - not as a genuine
      // "closed"/"resolved" outcome.
      expect(prismaService.case.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([expect.objectContaining({ status: { not: CaseStatus.STATUS_99_ABANDONED } })]),
          }),
        }),
      );
    });

    it('excludes closed cases from the Case Types bar chart', async () => {
      const result = await service.getCaseStatus('all', { tenantId: 'tenant-123' });

      expect(result).toBeDefined();
      expect(prismaService.case.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['case_type'],
          where: expect.objectContaining({
            status: { notIn: ReportsService['CLOSED_STATUSES'] },
          }),
        }),
      );
    });

    it('should return every non-closed status in openStatusCounts, including zero counts', async () => {
      prismaService.case.findMany
        .mockResolvedValueOnce([
          { status: CaseStatus.STATUS_10_ASSIGNED, priority: 'LOW', sla_due_at: null },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getCaseStatus('all', { tenantId: 'tenant-123' });

      expect(result.openStatusCounts).toEqual(
        expect.arrayContaining([
          { status: CaseStatus.STATUS_10_ASSIGNED, count: 1 },
          { status: CaseStatus.STATUS_20_IN_PROGRESS, count: 0 },
        ]),
      );
      expect(result.openStatusCounts.some((item) => item.status === CaseStatus.STATUS_81_CLOSED_REFUTED)).toBe(false);
      expect(result.openStatusCounts.some((item) => item.status === CaseStatus.STATUS_82_CLOSED_CONFIRMED)).toBe(false);
      expect(result.openStatusCounts.some((item) => item.status === CaseStatus.STATUS_99_ABANDONED)).toBe(false);
      expect(result.openStatusCounts.some((item) => item.status === CaseStatus.STATUS_03_RETURNED)).toBe(false);
    });

    it('excludes STATUS_03_RETURNED from the Case Status Details table too', async () => {
      const result = await service.getCaseStatus('all', { tenantId: 'tenant-123' });

      expect(
        result.statusDetails.some((detail) => detail.status === service['formatStatusName'](CaseStatus.STATUS_03_RETURNED)),
      ).toBe(false);
    });

    it('should calculate average resolution time correctly', async () => {
      prismaService.case.findMany.mockResolvedValue([
        { created_at: new Date('2026-02-01'), updated_at: new Date('2026-02-11') }, // 10 days
      ]);

      const result = await service.getCaseStatus('last30', { tenantId: 'tenant-123' });

      expect(result.stats.avgResolutionTime).toBeDefined();
      expect(typeof result.stats.avgResolutionTime).toBe('number');
    });

    it('should handle empty case list', async () => {
      prismaService.case.groupBy.mockResolvedValue([]);
      prismaService.case.count.mockResolvedValue(0);
      prismaService.case.findMany.mockResolvedValue([]);

      const result = await service.getCaseStatus('last30', { tenantId: 'tenant-123' });

      expect(result.stats.totalCases).toBe(0);
      expect(result.stats.avgResolutionTime).toBeNull();
    });

    it('builds open priority buckets from non-closed cases only', async () => {
      // 5 cases in scope: mix of open/closed and LOW/MEDIUM/HIGH. Dashboard
      // buckets now represent the open queue rather than total case history.
      prismaService.case.count.mockResolvedValue(5);
      prismaService.case.findMany
        .mockResolvedValueOnce([
          { status: CaseStatus.STATUS_20_IN_PROGRESS, priority: 'LOW' },
          { status: CaseStatus.STATUS_20_IN_PROGRESS, priority: 'MEDIUM' },
          { status: CaseStatus.STATUS_10_ASSIGNED, priority: 'HIGH' },
        ])
        .mockResolvedValueOnce([]); // closedCasesWithTimes

      const result = await service.getCaseStatus('last30', { tenantId: 'tenant-123' });

      expect(result.stats.totalCases).toBe(5);
      expect(result.recentCases).toEqual([
        { priority: 'Low', count: 1 },
        { priority: 'Medium', count: 1 },
        { priority: 'High', count: 1 },
      ]);
      const bucketSum = result.recentCases.reduce((sum, r) => sum + r.count, 0);
      expect(bucketSum).toBe(result.stats.openCases);
      expect(result.stats.highPriorityCases).toBe(1);
    });

    it('excludes DRAFT cases from Open Cases by Priority, unlike openCases/openStatusCounts', async () => {
      prismaService.case.count.mockResolvedValue(4);
      prismaService.case.findMany
        .mockResolvedValueOnce([
          { status: CaseStatus.STATUS_00_DRAFT, priority: 'HIGH' },
          { status: CaseStatus.STATUS_20_IN_PROGRESS, priority: 'HIGH' },
          { status: CaseStatus.STATUS_10_ASSIGNED, priority: 'LOW' },
        ])
        .mockResolvedValueOnce([]); // closedCasesWithTimes

      const result = await service.getCaseStatus('last30', { tenantId: 'tenant-123' });

      // openCases still counts the draft (3 non-closed cases)...
      expect(result.stats.openCases).toBe(3);
      // ...but the priority breakdown drops it, so High only reflects the
      // non-draft case and the bucket sum no longer equals openCases.
      expect(result.recentCases).toEqual([
        { priority: 'Low', count: 1 },
        { priority: 'Medium', count: 0 },
        { priority: 'High', count: 1 },
      ]);
      expect(result.stats.highPriorityCases).toBe(1);
      expect(result.openStatusCounts.find((s) => s.status === CaseStatus.STATUS_00_DRAFT)?.count).toBe(1);
    });
  });

  describe('getInvestigatorWorkload', () => {
    beforeEach(() => {
      // First call gets unique investigators
      prismaService.case.findMany.mockResolvedValueOnce([{ case_owner_user_id: 'user-123' }, { case_owner_user_id: 'user-456' }]);
      // Subsequent calls for efficiency and performance data need timestamps
      prismaService.case.findMany.mockResolvedValue([
        {
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-15'),
        },
        {
          created_at: new Date('2026-01-05'),
          updated_at: new Date('2026-01-20'),
        },
      ]);
      prismaService.case.count.mockResolvedValue(5);
      prismaService.task.count.mockResolvedValue(3);
    });

    it('should return investigator workload report', async () => {
      const result = await service.getInvestigatorWorkload('last30');

      expect(result).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.workloadData).toBeDefined();
      expect(Array.isArray(result.workloadData)).toBe(true);
    });

    it('should calculate average cases per investigator', async () => {
      const result = await service.getInvestigatorWorkload('last30');

      expect(result.stats.avgCasesPerInvestigator).toBeDefined();
      expect(typeof result.stats.avgCasesPerInvestigator).toBe('number');
    });

    it('should filter out null investigators', async () => {
      prismaService.case.findMany.mockReset();
      // First call gets investigators (including null)
      prismaService.case.findMany.mockResolvedValueOnce([{ case_owner_user_id: 'user-123' }, { case_owner_user_id: null }]);
      // Subsequent calls for efficiency and performance data
      prismaService.case.findMany.mockResolvedValue([
        {
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-01-15'),
        },
      ]);

      const result = await service.getInvestigatorWorkload('last30');

      expect(result.workloadData.length).toBeGreaterThan(0);
    });

    it('should handle no investigators', async () => {
      prismaService.case.findMany.mockReset();
      // Return empty array for investigators
      prismaService.case.findMany.mockResolvedValue([]);

      const result = await service.getInvestigatorWorkload('last30');

      expect(result.workloadData).toEqual([]);
      expect(result.stats.totalInvestigators).toBe(0);
    });

    it('should return efficiency data', async () => {
      const result = await service.getInvestigatorWorkload('last30');

      expect(result.efficiencyData).toBeDefined();
      expect(Array.isArray(result.efficiencyData)).toBe(true);
    });

    it('should return performance data', async () => {
      const result = await service.getInvestigatorWorkload('last30');

      expect(result.performanceData).toBeDefined();
      expect(Array.isArray(result.performanceData)).toBe(true);
    });

    it.each([
      ['caseType', { caseType: 'AML' }, { case_type: 'AML' }],
      ['priority', { priority: 'HIGH' }, { priority: 'HIGH' }],
    ])('scopes the investigator list by %s', async (_filterName, filterParam, expectedWhereClause) => {
      await service.getInvestigatorWorkload('last30', { tenantId: 'tenant-123', ...filterParam });

      expect(prismaService.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining(expectedWhereClause),
          distinct: ['case_owner_user_id'],
        }),
      );
    });

    it('restricts the report to a single investigator when the investigator filter is set', async () => {
      await service.getInvestigatorWorkload('last30', { tenantId: 'tenant-123', investigator: 'user-123' });

      expect(prismaService.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ case_owner_user_id: 'user-123' }),
          distinct: ['case_owner_user_id'],
        }),
      );
    });
  });

  describe('getEventLogs', () => {
    beforeEach(() => {
      eventLogService.getLogs.mockResolvedValue([mockEventLog]);
    });

    it('should return event logs report', async () => {
      const result = await service.getEventLogs('last30');

      expect(result).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.eventLogs).toBeDefined();
    });

    it('should filter event logs by date range', async () => {
      eventLogService.getLogs.mockResolvedValue([{ ...mockEventLog, performed_at: mockDate }]);

      const result = await service.getEventLogs('today');

      expect(result.eventLogs).toBeDefined();
    });

    it('should format event logs correctly', async () => {
      // Use a date that's definitely within the last 30 days
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5); // 5 days ago

      eventLogService.getLogs.mockResolvedValue([
        { ...mockEventLog, performed_at: recentDate },
      ]);

      const result = await service.getEventLogs('last30');

      expect(result.eventLogs[0]).toHaveProperty('event_log_id');
      expect(result.eventLogs[0]).toHaveProperty('performed_at');
    });
  });

  describe('getCaseAgeing', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(mockDate);
      prismaService.case.findMany.mockResolvedValue([
        {
          case_id: 1,
          created_at: new Date('2026-01-01'),
          updated_at: new Date('2026-02-01'),
          status: CaseStatus.STATUS_20_IN_PROGRESS,
          case_type: CaseType.AML,
          priority: 'HIGH',
          case_owner_user_id: 'user-123',
        },
      ]);
    });

    it('should return case ageing report', async () => {
      const result = await service.getCaseAgeing('last30');

      expect(result).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.caseDetails).toBeDefined();
    });

    it('should categorize cases by age', async () => {
      const result = await service.getCaseAgeing('last30');

      expect(result.ageingDistribution).toBeDefined();
      expect(Array.isArray(result.ageingDistribution)).toBe(true);
      expect(result.ageingDistribution.length).toBe(4);
      expect(result.ageingDistribution[0]).toHaveProperty('ageRange');
      expect(result.ageingDistribution[0]).toHaveProperty('count');
      expect(result.ageingDistribution[0]).toHaveProperty('percentage');
    });

    it('should handle empty case list', async () => {
      prismaService.case.findMany.mockResolvedValue([]);

      const result = await service.getCaseAgeing('last30');

      expect(result.caseDetails).toEqual([]);
      expect(result.stats.avgCaseAge).toBeNull();
      expect(result.stats.avgResolutionTime).toBeNull();
    });

    it('excludes abandoned cases from the ageing dataset, not just from the closed set', async () => {
      await service.getCaseAgeing('last30', { tenantId: 'tenant-123' });

      // The open-backlog query (feeding avgCaseAge, the 15-30/30+ cards, the
      // by-status bar, the distribution donut, and the details table) shares
      // withNonContainerCaseFilter with getCaseStatus, so abandoned cases are
      // excluded from the live backlog entirely - not merely absent from the
      // closed set used for avgResolutionTime.
      expect(prismaService.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([expect.objectContaining({ status: { not: CaseStatus.STATUS_99_ABANDONED } })]),
          }),
        }),
      );
    });

    it('queries the open backlog unwindowed and the closed set windowed on updated_at', async () => {
      await service.getCaseAgeing('last30', { tenantId: 'tenant-123' });

      expect(prismaService.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { notIn: expect.arrayContaining([CaseStatus.STATUS_99_ABANDONED]) } }),
        }),
      );
      expect(prismaService.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: expect.arrayContaining([CaseStatus.STATUS_82_CLOSED_CONFIRMED]) },
            updated_at: { gte: expect.any(Date), lte: expect.any(Date) },
          }),
        }),
      );
    });

    it('puts open cases into exactly one of the 15-30 / 30+ tiers', async () => {
      prismaService.case.findMany.mockResolvedValueOnce([
        { case_id: 1, created_at: new Date('2026-03-15T12:00:00Z'), status: CaseStatus.STATUS_20_IN_PROGRESS, case_type: CaseType.AML, priority: 'LOW', case_owner_user_id: null }, // age 5
        { case_id: 2, created_at: new Date('2026-03-01T12:00:00Z'), status: CaseStatus.STATUS_20_IN_PROGRESS, case_type: CaseType.AML, priority: 'LOW', case_owner_user_id: null }, // age 19
        { case_id: 3, created_at: new Date('2026-02-01T12:00:00Z'), status: CaseStatus.STATUS_20_IN_PROGRESS, case_type: CaseType.AML, priority: 'LOW', case_owner_user_id: null }, // age 47
      ]);

      const result = await service.getCaseAgeing('last30');

      expect(result.stats.casesOver15Days).toBe(1);
      expect(result.stats.casesOver30Days).toBe(1);
      expect(result.stats.avgCaseAge).toBe(Math.round((5 + 19 + 47) / 3));
    });

    it('seeds the status axis from every open-eligible status, including ones with zero open cases', async () => {
      prismaService.case.findMany.mockResolvedValueOnce([]);

      const result = await service.getCaseAgeing('last30');

      // 15 CaseStatus values total, 6 closed + STATUS_03_RETURNED excluded
      // (to match the Case Status report's per-status table) -> 8 rows, always.
      expect(result.ageingByStatus.length).toBe(8);
      expect(result.ageingByStatus.every((row) => row.age0to7 === 0 && row.age30Plus === 0)).toBe(true);
    });

    it('excludes STATUS_03_RETURNED from the by-status breakdown, matching the Case Status report', async () => {
      const result = await service.getCaseAgeing('last30');

      expect(result.ageingByStatus.some((row) => row.status.includes('RETURNED'))).toBe(false);
    });

    it('reconciles ageingDistribution percentages to sum to exactly 100', async () => {
      prismaService.case.findMany.mockResolvedValueOnce([
        { case_id: 1, created_at: new Date('2026-03-18T12:00:00Z'), status: CaseStatus.STATUS_20_IN_PROGRESS, case_type: CaseType.AML, priority: 'LOW', case_owner_user_id: null }, // age 2
        { case_id: 2, created_at: new Date('2026-03-10T12:00:00Z'), status: CaseStatus.STATUS_20_IN_PROGRESS, case_type: CaseType.AML, priority: 'LOW', case_owner_user_id: null }, // age 10
        { case_id: 3, created_at: new Date('2026-03-01T12:00:00Z'), status: CaseStatus.STATUS_20_IN_PROGRESS, case_type: CaseType.AML, priority: 'LOW', case_owner_user_id: null }, // age 19
      ]);

      const result = await service.getCaseAgeing('last30');

      const totalPercentage = result.ageingDistribution.reduce((sum, band) => sum + band.percentage, 0);
      expect(totalPercentage).toBe(100);
    });

    it('surfaces only the raw investigator id on caseDetails, resolved client-side', async () => {
      prismaService.case.findMany.mockResolvedValueOnce([
        { case_id: 1, created_at: new Date('2026-03-01T12:00:00Z'), status: CaseStatus.STATUS_20_IN_PROGRESS, case_type: CaseType.AML, priority: 'LOW', case_owner_user_id: 'user-123' },
      ]);

      const result = await service.getCaseAgeing('last30');

      expect(result.caseDetails[0]).toEqual(
        expect.objectContaining({ investigatorId: 'user-123', createdDate: new Date('2026-03-01T12:00:00Z').toISOString() }),
      );
      expect(result.caseDetails[0]).not.toHaveProperty('userId');
      expect(result.caseDetails[0]).not.toHaveProperty('investigator');
    });

    it('returns a fixed 6-bucket resolution trend with median/p25/p75/n', async () => {
      const result = await service.getCaseAgeing('last30');

      expect(result.resolutionTrend.length).toBe(6);
      expect(result.resolutionTrend[5].month).toBe('2026-03');
      result.resolutionTrend.forEach((bucket) => {
        expect(bucket).toHaveProperty('n');
        expect(bucket).toHaveProperty('median');
        expect(bucket).toHaveProperty('p25');
        expect(bucket).toHaveProperty('p75');
      });
    });

    it.each([
      ['caseType', { caseType: 'AML' }, { case_type: 'AML' }],
      ['priority', { priority: 'HIGH' }, { priority: 'HIGH' }],
      ['investigator', { investigator: 'user-123' }, { case_owner_user_id: 'user-123' }],
    ])('filters both the open backlog and the closed window by %s', async (_filterName, filterParam, expectedWhereClause) => {
      await service.getCaseAgeing('last30', { tenantId: 'tenant-123', ...filterParam });

      // The open-backlog query (status notIn CLOSED_STATUSES) and the
      // closed-window query (status in CLOSED_STATUSES) share commonFilters,
      // so caseType/priority/investigator apply to both halves of the page.
      expect(prismaService.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { notIn: expect.arrayContaining([CaseStatus.STATUS_99_ABANDONED]) },
            ...expectedWhereClause,
          }),
        }),
      );
      expect(prismaService.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: expect.arrayContaining([CaseStatus.STATUS_82_CLOSED_CONFIRMED]) },
            ...expectedWhereClause,
          }),
        }),
      );
    });
  });

  describe('getFilters', () => {
    beforeEach(() => {
      prismaService.case.findMany
        .mockResolvedValueOnce([{ case_type: CaseType.AML }, { case_type: CaseType.FRAUD }])
        .mockResolvedValueOnce([{ priority: 'HIGH' }, { priority: 'MEDIUM' }])
        .mockResolvedValueOnce([{ case_owner_user_id: 'user-123' }]);
      prismaService.cms_usernames.findMany.mockResolvedValue([{ user_id: 'user-123', name: 'Test Investigator' }]);
    });

    it('should return filter options', async () => {
      const result = await service.getFilters();

      expect(result).toBeDefined();
      expect(result.caseTypes).toBeDefined();
      expect(result.priorities).toBeDefined();
      expect(result.investigators).toBeDefined();
    });

    it('should format case types correctly', async () => {
      const result = await service.getFilters();

      expect(Array.isArray(result.caseTypes)).toBe(true);
      expect(result.caseTypes[0]).toHaveProperty('value');
      expect(result.caseTypes[0]).toHaveProperty('label');
    });

    it('should omit null case types from filter options', async () => {
      prismaService.case.findMany
        .mockReset()
        .mockResolvedValueOnce([{ case_type: null }])
        .mockResolvedValueOnce([{ priority: 'HIGH' }])
        .mockResolvedValueOnce([{ case_owner_user_id: 'user-123' }]);

      const result = await service.getFilters();

      expect(result.caseTypes).toEqual([]);
    });
  });

  describe('generateFraudReport', () => {
    const mockFile = {
      originalname: 'report.pdf',
      buffer: Buffer.from('test content'),
      size: 1024,
      mimetype: 'application/pdf',
    };

    const mockDto = {
      caseId: 1,
      reportType: 'INVESTIGATION_REPORT',
      description: 'Test report',
      investigatorInputs: 'Test inputs',
      supervisorRemarks: 'Test remarks',
    };

    beforeEach(() => {
      prismaService.case.findFirst.mockResolvedValue(mockCase);
      prismaService.task.findMany.mockResolvedValue([]);
      couchdbService.getDatabase.mockReturnValue({
        find: jest.fn().mockResolvedValue({ docs: [] }),
      });
      couchdbService.insertDocument.mockResolvedValue({ rev: 'rev-1' });
      couchdbService.insertAttachment.mockResolvedValue({ rev: 'rev-2', filePath: '/path' });
      couchdbService.updateDocument.mockResolvedValue({ rev: 'rev-3' });
      evidenceService.getEvidenceByCaseId.mockResolvedValue({ evidence: [] });
    });

    it('should generate fraud report successfully', async () => {
      const result = await service.generateFraudReport(mockFile, mockDto, 'user-123', 'tenant-123', 'CMS_SUPERVISOR');

      expect(result).toBeDefined();
      expect(result.reportId).toContain('InvestigationReport');
    });

    it('should throw error for invalid file type', async () => {
      const invalidFile = { ...mockFile, mimetype: 'image/png' };

      await expect(service.generateFraudReport(invalidFile, mockDto, 'user-123', 'tenant-123', 'CMS_SUPERVISOR')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if case not found', async () => {
      prismaService.case.findFirst.mockResolvedValue(null);

      await expect(service.generateFraudReport(mockFile, mockDto, 'user-123', 'tenant-123', 'CMS_SUPERVISOR')).rejects.toThrow(
        'Case not found',
      );
    });

    it('should check investigation tasks for CMS_SUPERVISOR', async () => {
      prismaService.task.findMany.mockResolvedValue([{ ...mockTask, name: 'Investigate fraud', status: TaskStatus.STATUS_20_IN_PROGRESS }]);

      await expect(service.generateFraudReport(mockFile, mockDto, 'user-123', 'tenant-123', 'CMS_SUPERVISOR')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not check tasks for non-CMS_SUPERVISOR roles', async () => {
      prismaService.task.findMany.mockResolvedValue([{ ...mockTask, name: 'Investigate fraud', status: TaskStatus.STATUS_20_IN_PROGRESS }]);

      const result = await service.generateFraudReport(mockFile, mockDto, 'user-123', 'tenant-123', 'CMS_INVESTIGATOR');

      expect(result).toBeDefined();
    });

    it('should increment version for multiple reports', async () => {
      const existingReport = { ...mockFraudReport, version: 1 };
      couchdbService.getDatabase.mockReturnValue({
        find: jest.fn().mockResolvedValue({ docs: [existingReport] }),
      });

      const result = await service.generateFraudReport(mockFile, mockDto, 'user-123', 'tenant-123', 'CMS_SUPERVISOR');

      expect(result.version).toBe(2);
      expect(result.reportId).toContain('v2');
    });

    it('should encrypt report file', async () => {
      const result = await service.generateFraudReport(mockFile, mockDto, 'user-123', 'tenant-123', 'CMS_SUPERVISOR');

      expect(couchdbService.insertAttachment).toHaveBeenCalled();
      expect(result.metadata[0]).toBeDefined();
      expect((result.metadata[0] as any).encryption).toHaveProperty('key');
      expect((result.metadata[0] as any).encryption).toHaveProperty('iv');
      expect((result.metadata[0] as any).encryption).toHaveProperty('authTag');
    });

    it('should include evidence summary', async () => {
      const mockEvidence = [{ evidenceId: 'ev-1', fileName: 'test.pdf' }];
      evidenceService.getEvidenceByCaseId.mockResolvedValue({ evidence: mockEvidence });

      const result = await service.generateFraudReport(mockFile, mockDto, 'user-123', 'tenant-123', 'CMS_SUPERVISOR');

      expect(result.evidenceSummary).toEqual(mockEvidence);
    });
  });

  describe('editFraudReport', () => {
    beforeEach(() => {
      couchdbService.getDocument.mockResolvedValue(mockFraudReport);
      couchdbService.updateDocument.mockResolvedValue({ rev: 'rev-2' });
      couchdbService.insertDocument.mockResolvedValue({ rev: 'rev-1' });
    });

    it('should edit unlocked fraud report', async () => {
      const updates = { keyFindings: 'Updated findings' };

      const result = await service.editFraudReport('1-InvestigationReport-v1', updates, 'user-123');

      expect(result).toBeDefined();
      expect(result.keyFindings).toBe('Updated findings');
      expect(couchdbService.updateDocument).toHaveBeenCalled();
    });

    it('should create new version for locked report', async () => {
      const lockedReport = { ...mockFraudReport, locked: true };
      couchdbService.getDocument.mockResolvedValue(lockedReport);

      const updates = { keyFindings: 'Updated findings' };
      const result = await service.editFraudReport('1-InvestigationReport-v1', updates, 'user-123');

      expect(result.version).toBe(2);
      expect(result.history).toHaveLength(1);
      expect(couchdbService.insertDocument).toHaveBeenCalled();
    });

    it('should throw error if report not found', async () => {
      couchdbService.getDocument.mockResolvedValue(null);

      await expect(service.editFraudReport('invalid-id', {}, 'user-123')).rejects.toThrow('Report not found');
    });
  });

  describe('approveFraudReport', () => {
    beforeEach(() => {
      couchdbService.getDocument.mockResolvedValue(mockFraudReport);
      couchdbService.updateDocument.mockResolvedValue({ rev: 'rev-2' });
      notificationService.sendGroupNotification.mockResolvedValue(undefined);
    });

    it('should approve fraud report', async () => {
      const result = await service.approveFraudReport(
        '1-InvestigationReport-v1',
        FraudReportOutcome.CONFIRMED_FRAUD,
        'Good work',
        'supervisor-123',
      );

      expect(result).toBeDefined();
      expect(result.archived).toBe(true);
      expect((result as any).locked).toBe(true);
      expect(result.decisions).toBe(FraudReportOutcome.CONFIRMED_FRAUD);
    });

    it('should throw error if report not found', async () => {
      couchdbService.getDocument.mockResolvedValue(null);

      await expect(service.approveFraudReport('invalid-id', FraudReportOutcome.CONFIRMED_FRAUD, 'remarks', 'user-123')).rejects.toThrow(
        'Report not found',
      );
    });

    it('should update supervisor remarks', async () => {
      const result = await service.approveFraudReport(
        '1-InvestigationReport-v1',
        FraudReportOutcome.CONFIRMED_FRAUD,
        'Excellent work',
        'supervisor-123',
      );

      expect(result.supervisorRemarks).toBe('Excellent work');
    });

    it('should send notification to compliance officer', async () => {
      await service.approveFraudReport('1-InvestigationReport-v1', FraudReportOutcome.CONFIRMED_FRAUD, 'remarks', 'supervisor-123');

      expect(notificationService.sendGroupNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateGroup: 'COMPLIANCE_OFFICER',
        }),
      );
    });

    it('should set approved timestamp', async () => {
      const result = await service.approveFraudReport(
        '1-InvestigationReport-v1',
        FraudReportOutcome.CONFIRMED_FRAUD,
        'remarks',
        'supervisor-123',
      );

      expect((result.metadata as any).approvedAt).toBeDefined();
    });
  });

  describe('getFraudReports', () => {
    beforeEach(() => {
      const mockDb = {
        find: jest.fn().mockResolvedValue({
          docs: [
            { ...mockFraudReport, version: 1 },
            { ...mockFraudReport, version: 2, reportId: '1-InvestigationReport-v2' },
          ],
        }),
      };
      couchdbService.getDatabase.mockReturnValue(mockDb);
    });

    it('should get all fraud reports for a case', async () => {
      const result = await service.getFraudReports('1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should sort reports by version descending', async () => {
      const result = await service.getFraudReports('1');

      expect(result[0].version).toBeGreaterThan(result[1].version);
    });

    it('should handle empty reports list', async () => {
      const mockDb = {
        find: jest.fn().mockResolvedValue({ docs: [] }),
      };
      couchdbService.getDatabase.mockReturnValue(mockDb);

      const result = await service.getFraudReports('999');

      expect(result).toEqual([]);
    });
  });

  describe('private utility methods', () => {
    it('should return correct color for case type AML', () => {
      const color = (service as any).getCaseTypeColor(CaseType.AML);
      expect(color).toBeDefined();
      expect(typeof color).toBe('string');
    });

    it('should return correct color for case type FRAUD', () => {
      const color = (service as any).getCaseTypeColor(CaseType.FRAUD);
      expect(color).toBeDefined();
    });

    it('should return default color for null case type', () => {
      const color = (service as any).getCaseTypeColor(null);
      expect(color).toBeDefined();
    });

    it('should format case status name correctly', () => {
      const formatted = (service as any).formatStatusName(CaseStatus.STATUS_20_IN_PROGRESS);
      expect(formatted).toBe('20 IN PROGRESS');
    });

    it('should return Info for SUCCESS outcome', () => {
      const type = (service as any).getAuditLogType('SUCCESS');
      expect(type).toBe('Success');
    });

    it('should return Warning for WARNING outcome', () => {
      const type = (service as any).getAuditLogType('WARNING');
      expect(type).toBe('Warning');
    });

    it('should return Error for ERROR outcome', () => {
      const type = (service as any).getAuditLogType('ERROR');
      expect(type).toBe('Error');
    });

    it('should return Info for undefined outcome', () => {
      const type = (service as any).getAuditLogType(undefined);
      expect(type).toBe('Info');
    });

    it('should hash buffer using sha256', () => {
      const buffer = Buffer.from('test content');
      const hash = (service as any).sha256(buffer);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 produces 64 character hex string
    });

    it('should encrypt buffer correctly', () => {
      const buffer = Buffer.from('test content');
      const result = (service as any).encrypt(buffer);
      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');
      expect(Buffer.isBuffer(result.encrypted)).toBe(true);
    });
  });
});
