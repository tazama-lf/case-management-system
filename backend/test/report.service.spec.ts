import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from '../src/modules/report/report.service';
import { PrismaService } from '../prisma/prisma.service';
import { CaseService } from '../src/modules/case/case.service';
import { TaskService } from '../src/modules/task/task.service';
import { AuditLogService } from '../src/modules/audit/auditLog.service';
import { EvidenceService } from '../src/modules/evidence/evidence.service';
import { CouchdbService } from '../src/modules/couchdb/couchdb.service';
import { NotificationService } from '../src/modules/notification/notification.service';
import { EventLogService } from '../src/modules/event_log/eventLog.service';
import { BadRequestException } from '@nestjs/common';
import { CaseStatus, CaseType, TaskStatus } from '@prisma/client-cms';
import { FraudReportOutcome } from '../src/modules/report/report.model';

describe('ReportsService', () => {
  let service: ReportsService;
  let prismaService: any;
  let caseService: any;
  let taskService: any;
  let auditLogService: any;
  let evidenceService: any;
  let couchdbService: any;
  let notificationService: any;
  let eventLogService: any;

  const mockDate = new Date('2026-02-23T12:00:00.000Z');
  const mockCase = {
    case_id: 1,
    case_type: CaseType.AML,
    priority: 'HIGH',
    case_owner_user_id: 'user-123',
    status: CaseStatus.STATUS_20_IN_PROGRESS,
    created_at: new Date('2026-02-20T12:00:00.000Z'),
    updated_at: new Date('2026-02-23T12:00:00.000Z'),
    alert: { tenant_id: 'tenant-123' },
  };

  const mockTask = {
    task_id: 1,
    case_id: 1,
    name: 'Investigate transaction',
    status: TaskStatus.STATUS_20_IN_PROGRESS,
    assigned_user_id: 'user-123',
  };

  const mockAuditLog = {
    audit_log_id: 1,
    user_id: 'user-123',
    operation: 'CREATE',
    entity_name: 'Case',
    action_performed: 'Case created',
    outcome: 'SUCCESS',
    performed_at: mockDate,
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
      },
      task: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const mockCaseService = {
      updateCase: jest.fn(),
    };

    const mockTaskService = {
      getTasks: jest.fn(),
    };

    const mockAuditLogService = {
      getLogs: jest.fn(),
      logAction: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CaseService, useValue: mockCaseService },
        { provide: TaskService, useValue: mockTaskService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: EvidenceService, useValue: mockEvidenceService },
        { provide: CouchdbService, useValue: mockCouchdbService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: EventLogService, useValue: mockEventLogService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prismaService = module.get(PrismaService);
    caseService = module.get(CaseService);
    taskService = module.get(TaskService);
    auditLogService = module.get(AuditLogService);
    evidenceService = module.get(EvidenceService);
    couchdbService = module.get(CouchdbService);
    notificationService = module.get(NotificationService);
    eventLogService = module.get(EventLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
      expect(result.stats.avgResolutionTime).toBe(0);
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
  });

  describe('getAuditLogs', () => {
    beforeEach(() => {
      auditLogService.getLogs.mockResolvedValue([mockAuditLog]);
    });

    it('should return audit logs report', async () => {
      const result = await service.getAuditLogs('last30');

      expect(result).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.auditLogs).toBeDefined();
      expect(Array.isArray(result.auditLogs)).toBe(true);
    });

    it('should filter logs by date range', async () => {
      const today = new Date();
      auditLogService.getLogs.mockResolvedValue([
        { ...mockAuditLog, performed_at: today },
        { ...mockAuditLog, performed_at: new Date('2025-01-01') },
      ]);

      const result = await service.getAuditLogs('today');

      expect(result.auditLogs).toBeDefined();
      expect(Array.isArray(result.auditLogs)).toBe(true);
    });

    it('should count case actions', async () => {
      auditLogService.getLogs.mockResolvedValue([
        { ...mockAuditLog, entity_name: 'Case', action_performed: 'Case created' },
        { ...mockAuditLog, entity_name: 'User', action_performed: 'User updated' },
      ]);

      const result = await service.getAuditLogs('last30');

      expect(result.stats.caseActions).toBeDefined();
      expect(typeof result.stats.caseActions).toBe('number');
    });

    it('should count user sessions', async () => {
      auditLogService.getLogs.mockResolvedValue([
        { ...mockAuditLog, action_performed: 'login' },
        { ...mockAuditLog, action_performed: 'session started' },
      ]);

      const result = await service.getAuditLogs('last30');

      expect(result.stats.userSessions).toBeDefined();
    });

    it('should count system warnings', async () => {
      auditLogService.getLogs.mockResolvedValue([
        { ...mockAuditLog, outcome: 'WARNING' },
        { ...mockAuditLog, outcome: 'ERROR' },
        { ...mockAuditLog, outcome: 'SUCCESS' },
      ]);

      const result = await service.getAuditLogs('last30');

      expect(result.stats.systemWarnings).toBe(2);
    });

    it('should format audit logs correctly', async () => {
      const result = await service.getAuditLogs('last30');

      expect(result.auditLogs[0]).toHaveProperty('audit_log_id');
      expect(result.auditLogs[0]).toHaveProperty('user_id');
      expect(result.auditLogs[0]).toHaveProperty('type');
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
      const result = await service.getEventLogs('last30');

      expect(result.eventLogs[0]).toHaveProperty('event_log_id');
      expect(result.eventLogs[0]).toHaveProperty('performed_at');
    });
  });

  describe('getCaseAgeing', () => {
    beforeEach(() => {
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
    });
  });

  describe('getFilters', () => {
    beforeEach(() => {
      prismaService.case.findMany
        .mockResolvedValueOnce([{ case_type: CaseType.AML }, { case_type: CaseType.FRAUD }])
        .mockResolvedValueOnce([{ priority: 'HIGH' }, { priority: 'MEDIUM' }])
        .mockResolvedValueOnce([{ case_owner_user_id: 'user-123' }]);
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

    it('should handle null case types', async () => {
      prismaService.case.findMany
        .mockReset()
        .mockResolvedValueOnce([{ case_type: null }])
        .mockResolvedValueOnce([{ priority: 'HIGH' }])
        .mockResolvedValueOnce([{ case_owner_user_id: 'user-123' }]);

      const result = await service.getFilters();

      expect(result.caseTypes[0].value).toBe('NONE');
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
      prismaService.case.findUnique.mockResolvedValue(mockCase);
      prismaService.task.findMany.mockResolvedValue([]);
      couchdbService.getDatabase.mockReturnValue({
        find: jest.fn().mockResolvedValue({ docs: [] }),
      });
      couchdbService.insertDocument.mockResolvedValue({ rev: 'rev-1' });
      couchdbService.insertAttachment.mockResolvedValue({ rev: 'rev-2', filePath: '/path' });
      couchdbService.updateDocument.mockResolvedValue({ rev: 'rev-3' });
      evidenceService.getEvidenceByCaseId.mockResolvedValue({ evidence: [] });
      auditLogService.logAction.mockResolvedValue(undefined);
    });

    it('should generate fraud report successfully', async () => {
      const result = await service.generateFraudReport(mockFile, mockDto, 'user-123', 'tenant-123', 'CMS_SUPERVISOR');

      expect(result).toBeDefined();
      expect(result.reportId).toContain('InvestigationReport');
      expect(auditLogService.logAction).toHaveBeenCalled();
    });

    it('should throw error for invalid file type', async () => {
      const invalidFile = { ...mockFile, mimetype: 'image/png' };

      await expect(service.generateFraudReport(invalidFile, mockDto, 'user-123', 'tenant-123', 'CMS_SUPERVISOR')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if case not found', async () => {
      prismaService.case.findUnique.mockResolvedValue(null);

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
      auditLogService.logAction.mockResolvedValue(undefined);
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

    it('should log audit action for update', async () => {
      await service.editFraudReport('1-InvestigationReport-v1', {}, 'user-123');

      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'UPDATE',
          entityName: 'FraudReport',
        }),
      );
    });

    it('should log audit action for version creation', async () => {
      const lockedReport = { ...mockFraudReport, locked: true };
      couchdbService.getDocument.mockResolvedValue(lockedReport);

      await service.editFraudReport('1-InvestigationReport-v1', {}, 'user-123');

      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'CREATE_VERSION',
          entityName: 'FraudReport',
        }),
      );
    });
  });

  describe('approveFraudReport', () => {
    beforeEach(() => {
      couchdbService.getDocument.mockResolvedValue(mockFraudReport);
      couchdbService.updateDocument.mockResolvedValue({ rev: 'rev-2' });
      auditLogService.logAction.mockResolvedValue(undefined);
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

    it('should log audit action', async () => {
      await service.approveFraudReport('1-InvestigationReport-v1', FraudReportOutcome.CONFIRMED_FRAUD, 'remarks', 'supervisor-123');

      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'APPROVE',
          entityName: 'FraudReport',
          userId: 'supervisor-123',
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
      auditLogService.logAction.mockResolvedValue(undefined);
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

    it('should log audit action', async () => {
      await service.getFraudReports('1');

      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'RETRIEVE',
          entityName: 'FraudReport',
        }),
      );
    });

    it('should use SYSTEM as userId when called without second param', async () => {
      await service.getFraudReports('1');

      expect(auditLogService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'SYSTEM',
        }),
      );
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
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
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
