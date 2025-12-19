import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ReportsService } from '../../src/report/report.service';
import { AuditLogService } from '../../src/audit/auditLog.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EvidenceService } from '../../src/evidence/evidence.service';
import { CouchdbService } from '../../src/modules/couchdb/couchdb.service';
import { NotificationService } from '../../src/notification/notification.service';
import { CaseService } from '../../src/case/case.service';
import { FraudReportOutcome } from '../../src/report/report.model';

describe('Fraud Report Business Flow (Integration)', () => {
  let app: INestApplication;
  let reportsService: ReportsService;
  let auditLogService: AuditLogService;
  let evidenceService: EvidenceService;
  let couchdbService: CouchdbService;
  let notificationService: NotificationService;
  let caseService: CaseService;

  const mockCouchdbService = {
    insertDocument: jest.fn(),
    updateDocument: jest.fn(),
    getDocument: jest.fn(),
    getDatabase: jest.fn(() => ({ find: jest.fn() })),
  };
  const mockEvidenceService = {
    getEvidenceByCaseId: jest.fn().mockResolvedValue({ evidence: [] }),
  };
  const mockAuditLogService = {
    logAction: jest.fn(),
  };
  const mockNotificationService = {
    sendGroupNotification: jest.fn(),
  };
  const mockCaseService = {
    updateCase: jest.fn(),
  };
  const mockPrismaService: any = {
    case: {
      findUnique: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: EvidenceService, useValue: mockEvidenceService },
        { provide: CouchdbService, useValue: mockCouchdbService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: CaseService, useValue: mockCaseService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    reportsService = moduleFixture.get<ReportsService>(ReportsService);
    auditLogService = moduleFixture.get<AuditLogService>(AuditLogService);
    evidenceService = moduleFixture.get<EvidenceService>(EvidenceService);
    couchdbService = moduleFixture.get<CouchdbService>(CouchdbService);
    notificationService = moduleFixture.get<NotificationService>(NotificationService);
    caseService = moduleFixture.get<CaseService>(CaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate a fraud report and log audit action', async () => {
    // Arrange
    const caseId = 'case-1';
    const investigatorInputs = 'Investigator details';
    const supervisorRemarks = 'Supervisor remarks';
    const userId = 'user-123';
    const tenantId = 'tenant-1';
    const role = 'CMS_SUPERVISOR';
    const caseData = {
      case_id: caseId,
      case_type: 'FRAUD',
      case_owner_user_id: 'user-123',
    };
    mockPrismaService.case.findUnique.mockResolvedValue(caseData);

    // Act
    const report = await reportsService.generateFraudReport(
      caseId,
      investigatorInputs,
      supervisorRemarks,
      userId,
      tenantId,
      role,
    );

    // Assert
    expect(report.caseId).toBe(caseId);
    expect(report.investigatorInputs).toBe(investigatorInputs);
    expect(report.supervisorRemarks).toBe(supervisorRemarks);
    expect(report.category).toBe('report');
    expect(mockCouchdbService.insertDocument).toHaveBeenCalled();
    expect(mockAuditLogService.logAction).toHaveBeenCalled();
  });

  it('should edit a fraud report and log audit action', async () => {
    // Arrange
    const reportId = 'case-1-v1';
    const updates = { keyFindings: 'Updated findings' };
    const userId = 'user-123';
    const existingReport = {
      reportId,
      caseId: 'case-1',
      keyFindings: '',
      version: 1,
      history: [],
      category: 'report',
    };
    mockCouchdbService.getDocument.mockResolvedValue(existingReport);

    // Act
    const updatedReport = await reportsService.editFraudReport(reportId, updates, userId);

    // Assert
    expect(updatedReport.keyFindings).toBe('Updated findings');
    expect(updatedReport.category).toBe('report');
    expect(mockCouchdbService.updateDocument).toHaveBeenCalled();
    expect(mockAuditLogService.logAction).toHaveBeenCalled();
  });

  it('should approve a fraud report, archive it, update case, and send notification', async () => {
    // Arrange
    const reportId = 'case-1-v1';
    const outcome = FraudReportOutcome.CONFIRMED_FRAUD;
    const supervisor = 'Jane Supervisor';
    const supervisorUserId = 'user-456';
    const report = {
      reportId,
      caseId: 'case-1',
      archived: false,
      metadata: {},
      history: [],
      version: 1,
      category: 'report',
    };
    mockCouchdbService.getDocument.mockResolvedValue(report);

    // Act
    const approvedReport = await reportsService.approveFraudReport(
      reportId,
      outcome,
      supervisor,
      supervisorUserId,
    );

    // Assert
    expect(approvedReport.archived).toBe(true);
    expect(approvedReport.category).toBe('report');
    expect(mockCouchdbService.updateDocument).toHaveBeenCalled();
    expect(mockAuditLogService.logAction).toHaveBeenCalled();
    expect(mockNotificationService.sendGroupNotification).toHaveBeenCalled();
    expect(mockCaseService.updateCase).toHaveBeenCalled();
  });

  it('should retrieve fraud reports for a case', async () => {
    // Arrange
    const caseId = 'case-1';
    const mockReports = [
      { reportId: 'case-1-v1', caseId, version: 1, category: 'report' },
      { reportId: 'case-1-v2', caseId, version: 2, category: 'report' },
    ];
    const db = { find: jest.fn().mockResolvedValue({ docs: mockReports }) };
    mockCouchdbService.getDatabase.mockReturnValue(db);

    // Act
    const reports = await reportsService.getFraudReports(caseId);

    // Assert
    expect(Array.isArray(reports)).toBe(true);
    expect(reports.length).toBe(2);
    expect(reports[0].category).toBe('report');
    expect(mockAuditLogService.logAction).toHaveBeenCalled();
  });
});
