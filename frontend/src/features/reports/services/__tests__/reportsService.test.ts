import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/shared/services/apiClient';
import { ReportsService } from '../reportsService';

vi.mock('@/shared/services/apiClient', () => ({
  default: {
    get: vi.fn(),
    upload: vi.fn(),
  },
}));

/* ═══════════ helpers ═══════════ */

const mockGet = vi.mocked(apiClient.get);
const mockUpload = vi.mocked(apiClient.upload);

/* ═══════════ getReportsData ═══════════ */

describe('ReportsService.getReportsData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns processed reports data', async () => {
    const raw = {
      stats: { totalCases: 5, closedCases: 2, openCases: 3, avgResolutionTime: 1.5 },
      statusDistribution: { assigned: 1, inProgress: 1, draft: 1, suspended: 1, pendingApproval: 0, closed: 1 },
      caseTypes: [{ type: 'FRAUD', count: 3 }],
      outcomes: { resolved: 1, confirmed: 1, inconclusive: 0, pending: 1 },
      monthlyTrend: [],
      statusDetails: [],
    };
    mockGet.mockResolvedValue(raw as any);

    const result = await ReportsService.getReportsData();
    expect(result.stats.totalCases).toBe(5);
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/v1/reports/case-status'));
  });

  it('passes dateRange and filters as query params', async () => {
    mockGet.mockResolvedValue({
      stats: { totalCases: 0, closedCases: 0, openCases: 0, avgResolutionTime: 0 },
      statusDistribution: { assigned: 0, inProgress: 0, draft: 0, suspended: 0, pendingApproval: 0, closed: 0 },
      caseTypes: [], outcomes: { resolved: 0, confirmed: 0, inconclusive: 0, pending: 0 },
      monthlyTrend: [], statusDetails: [],
    } as any);

    await ReportsService.getReportsData('last7', { caseType: 'FRAUD', priority: 'HIGH', investigator: 'u1' });
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('dateRange=last7');
    expect(url).toContain('caseType=FRAUD');
    expect(url).toContain('priority=HIGH');
    expect(url).toContain('investigator=u1');
  });

  it('returns empty fallback on error', async () => {
    mockGet.mockRejectedValue(new Error('fail'));
    const result = await ReportsService.getReportsData();
    expect(result.stats.totalCases).toBe(0);
    expect(result.caseTypes).toEqual([]);
  });

  it('uses safeFallback for null/undefined stats', async () => {
    mockGet.mockResolvedValue({
      stats: { totalCases: null, closedCases: undefined, openCases: NaN, avgResolutionTime: Infinity },
      statusDistribution: { assigned: 0, inProgress: 0, draft: 0, suspended: 0, pendingApproval: 0, closed: 0 },
      caseTypes: [], outcomes: { resolved: 0, confirmed: 0, inconclusive: 0, pending: 0 },
      monthlyTrend: [], statusDetails: [],
    } as any);

    const result = await ReportsService.getReportsData();
    expect(result.stats.totalCases).toBe(0);
    expect(result.stats.closedCases).toBe(0);
    expect(result.stats.openCases).toBe(0);
    expect(result.stats.avgResolutionTime).toBe(0);
  });
});

/* ═══════════ getInvestigatorWorkloadData ═══════════ */

describe('ReportsService.getInvestigatorWorkloadData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns processed workload data', async () => {
    const raw = {
      stats: { totalInvestigators: 5, avgCasesPerInvestigator: 3, avgResolutionTime: 2, caseClosureRate: 0.8 },
      workloadData: [], volumeTrend: [], efficiencyData: [], outcomeData: [], performanceData: [],
    };
    mockGet.mockResolvedValue(raw as any);

    const result = await ReportsService.getInvestigatorWorkloadData('last7');
    expect(result.stats.totalInvestigators).toBe(5);
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('dateRange=last7'));
  });

  it('uses default dateRange when none provided', async () => {
    mockGet.mockResolvedValue({
      stats: { totalInvestigators: 0, avgCasesPerInvestigator: 0, avgResolutionTime: 0, caseClosureRate: 0 },
      workloadData: [], volumeTrend: [], efficiencyData: [], outcomeData: [], performanceData: [],
    } as any);

    await ReportsService.getInvestigatorWorkloadData();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('dateRange=last30'));
  });

  it('returns empty fallback on error', async () => {
    mockGet.mockRejectedValue(new Error('fail'));
    const result = await ReportsService.getInvestigatorWorkloadData();
    expect(result.stats.totalInvestigators).toBe(0);
    expect(result.workloadData).toEqual([]);
  });
});

/* ═══════════ getTaskCompletionData ═══════════ */

describe('ReportsService.getTaskCompletionData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns processed task completion data', async () => {
    const raw = {
      stats: { totalTasks: 10, completionRate: 80, avgCompletionTime: 3, overdueTasks: 2 },
      completionByType: [], avgCompletionTime: [], completionTrend: [], statusDistribution: [], taskDetails: [],
    };
    mockGet.mockResolvedValue(raw as any);

    const result = await ReportsService.getTaskCompletionData('last7');
    expect(result.stats.totalTasks).toBe(10);
  });

  it('returns empty fallback on error', async () => {
    mockGet.mockRejectedValue(new Error('fail'));
    const result = await ReportsService.getTaskCompletionData();
    expect(result.stats.totalTasks).toBe(0);
    expect(result.completionByType).toEqual([]);
  });
});

/* ═══════════ getAuditLogsData ═══════════ */

describe('ReportsService.getAuditLogsData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns processed audit logs data', async () => {
    const raw = {
      stats: { totalLogs: 100, caseActions: 50, userSessions: 30, systemWarnings: 5 },
      auditLogs: [{ id: 1 }],
    };
    mockGet.mockResolvedValue(raw as any);

    const result = await ReportsService.getAuditLogsData('last7');
    expect(result.stats.totalLogs).toBe(100);
    expect(result.auditLogs).toHaveLength(1);
  });

  it('returns empty fallback on error', async () => {
    mockGet.mockRejectedValue(new Error('fail'));
    const result = await ReportsService.getAuditLogsData();
    expect(result.stats.totalLogs).toBe(0);
    expect(result.auditLogs).toEqual([]);
  });
});

/* ═══════════ getCaseAgeingData ═══════════ */

describe('ReportsService.getCaseAgeingData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns processed case ageing data', async () => {
    const raw = {
      stats: { avgCaseAge: 10, avgResolutionTime: 5, casesOver15Days: 3, casesOver30Days: 1 },
      ageingByStatus: [], resolutionTrend: [], ageingDistribution: [], caseTypeResolution: [], caseDetails: [],
    };
    mockGet.mockResolvedValue(raw as any);

    const result = await ReportsService.getCaseAgeingData('last7');
    expect(result.stats.avgCaseAge).toBe(10);
  });

  it('returns empty fallback on error', async () => {
    mockGet.mockRejectedValue(new Error('fail'));
    const result = await ReportsService.getCaseAgeingData();
    expect(result.stats.avgCaseAge).toBe(0);
    expect(result.caseDetails).toEqual([]);
  });
});

/* ═══════════ generateFraudReport ═══════════ */

describe('ReportsService.generateFraudReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uploads fraud report with FormData', async () => {
    const file = new File(['data'], 'report.pdf', { type: 'application/pdf' });
    const dto = {
      file,
      caseId: 1,
      reportType: 'FRAUD',
      investigatorInputs: 'inputs',
      supervisorRemarks: 'remarks',
      outcome: 'Confirmed',
      description: 'desc',
    };
    mockUpload.mockResolvedValue({ id: 1, url: '/reports/1' } as any);

    const result = await ReportsService.generateFraudReport(dto as any);
    expect(mockUpload).toHaveBeenCalledWith('/api/v1/reports/fraud/generate', expect.any(FormData));
    expect(result).toEqual({ id: 1, url: '/reports/1' });
  });

  it('appends empty strings for optional fields', async () => {
    const file = new File(['data'], 'r.pdf');
    const dto = { file, caseId: 2, reportType: 'FRAUD' };
    mockUpload.mockResolvedValue({} as any);

    await ReportsService.generateFraudReport(dto as any);
    const formData = mockUpload.mock.calls[0][1] as FormData;
    expect(formData.get('investigatorInputs')).toBe('');
    expect(formData.get('supervisorRemarks')).toBe('');
    expect(formData.get('outcome')).toBe('');
    expect(formData.get('description')).toBe('');
  });

  it('throws error via handleError on failure', async () => {
    mockUpload.mockRejectedValue(new Error('upload failed'));

    await expect(ReportsService.generateFraudReport({ file: new File([], 'f'), caseId: 1, reportType: 'X' } as any))
      .rejects.toThrow('upload failed');
  });

  it('throws from response.data.message shape', async () => {
    mockUpload.mockRejectedValue({ response: { data: { message: 'server msg' } } });

    await expect(ReportsService.generateFraudReport({ file: new File([], 'f'), caseId: 1, reportType: 'X' } as any))
      .rejects.toThrow('server msg');
  });
});

/* ═══════════ getEvidenceFindingsData ═══════════ */

describe('ReportsService.getEvidenceFindingsData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty findings when no cases', async () => {
    mockGet.mockResolvedValueOnce([] as any);

    const result = await ReportsService.getEvidenceFindingsData();
    expect(result.stats.totalFindings).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('returns empty findings when casesResponse has data/cases arrays that are empty', async () => {
    mockGet.mockResolvedValueOnce({ cases: [] } as any);

    const result = await ReportsService.getEvidenceFindingsData();
    expect(result.stats.totalFindings).toBe(0);
  });

  it('skips draft/abandoned/pending cases', async () => {
    const cases = [
      { case_id: 1, status: 'STATUS_00_DRAFT' },
      { case_id: 2, status: 'STATUS_99_ABANDONED' },
      { case_id: 3, status: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL' },
    ];
    mockGet.mockResolvedValueOnce(cases as any);

    const result = await ReportsService.getEvidenceFindingsData();
    expect(result.stats.totalFindings).toBe(0);
    // apiClient.get should be called once for cases but never for evidence
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('processes cases with evidence and determines conclusion', async () => {
    const cases = [
      { case_id: 1, status: 'STATUS_82_CLOSED_CONFIRMED', created_at: '2024-01-01' },
      { case_id: 2, status: 'STATUS_81_CLOSED_REFUTED', created_at: '2024-01-02' },
      { case_id: 3, status: 'STATUS_83_CLOSED_INCONCLUSIVE', created_at: '2024-01-03' },
      { case_id: 4, status: 'STATUS_20_IN_PROGRESS', created_at: '2024-01-04' },
    ];
    mockGet
      .mockResolvedValueOnce(cases as any)
      // Evidence for case 1
      .mockResolvedValueOnce({ evidence: [{ id: 'e1', taskId: 10, fileName: 'doc1.pdf' }] } as any)
      // Evidence for case 2
      .mockResolvedValueOnce({ evidence: [{ id: 'e2', task_id: 20, fileName: 'doc2.pdf' }] } as any)
      // Evidence for case 3
      .mockResolvedValueOnce({ evidence: [{ id: 'e3', fileName: 'doc3.pdf' }] } as any)
      // Evidence for case 4
      .mockResolvedValueOnce({ evidence: [{ id: 'e4', taskId: 30, fileName: 'doc4.pdf' }] } as any);

    const result = await ReportsService.getEvidenceFindingsData();

    expect(result.stats.totalFindings).toBe(4);
    expect(result.stats.evidenceItems).toBe(4);
    expect(result.stats.confirmedFindings).toBe(1);
    expect(result.stats.refutedFindings).toBe(1);
    expect(result.stats.inconclusiveFindings).toBe(1);
    expect(result.findings).toHaveLength(4);
    expect(result.findings[0].conclusion).toBe('Confirmed');
    expect(result.findings[1].conclusion).toBe('Refuted');
    expect(result.findings[2].conclusion).toBe('Inconclusive');
    expect(result.findings[3].conclusion).toBe('InProgress');
  });

  it('handles autoclosed statuses correctly', async () => {
    const cases = [
      { case_id: 1, status: 'STATUS_71_AUTOCLOSED_CONFIRMED', created_at: '2024-01-01' },
      { case_id: 2, status: 'STATUS_72_AUTOCLOSED_REFUTED', created_at: '2024-01-02' },
    ];
    mockGet
      .mockResolvedValueOnce(cases as any)
      .mockResolvedValueOnce({ evidence: [{ id: 'e1', taskId: 1 }] } as any)
      .mockResolvedValueOnce({ evidence: [{ id: 'e2', taskId: 2 }] } as any);

    const result = await ReportsService.getEvidenceFindingsData();
    expect(result.findings[0].conclusion).toBe('Confirmed');
    expect(result.findings[1].conclusion).toBe('Refuted');
  });

  it('skips cases with no evidence', async () => {
    const cases = [
      { case_id: 1, status: 'STATUS_20_IN_PROGRESS', created_at: '2024-01-01' },
    ];
    mockGet
      .mockResolvedValueOnce(cases as any)
      .mockResolvedValueOnce({ evidence: [] } as any);

    const result = await ReportsService.getEvidenceFindingsData();
    expect(result.stats.totalFindings).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('handles evidence as array response (not wrapped in evidence property)', async () => {
    const cases = [{ case_id: 1, status: 'STATUS_20_IN_PROGRESS', created_at: '2024-01-01' }];
    mockGet
      .mockResolvedValueOnce(cases as any)
      .mockResolvedValueOnce([{ id: 'e1', taskId: 1 }] as any);

    const result = await ReportsService.getEvidenceFindingsData();
    expect(result.stats.totalFindings).toBe(1);
  });

  it('filters out evidence with reportId', async () => {
    const cases = [{ case_id: 1, status: 'STATUS_20_IN_PROGRESS', created_at: '2024-01-01' }];
    mockGet
      .mockResolvedValueOnce(cases as any)
      .mockResolvedValueOnce({
        evidence: [
          { id: 'e1', taskId: 1, reportId: null },
          { id: 'e2', taskId: 2, reportId: 'report-1' },
        ],
      } as any);

    const result = await ReportsService.getEvidenceFindingsData();
    expect(result.stats.evidenceItems).toBe(1);
  });

  it('groups evidence by taskId', async () => {
    const cases = [{ case_id: 1, status: 'STATUS_20_IN_PROGRESS', created_at: '2024-01-01' }];
    mockGet
      .mockResolvedValueOnce(cases as any)
      .mockResolvedValueOnce({
        evidence: [
          { id: 'e1', taskId: 10 },
          { id: 'e2', taskId: 10 },
          { id: 'e3', taskId: 20 },
        ],
      } as any);

    const result = await ReportsService.getEvidenceFindingsData();
    expect(result.findings[0].tasks).toHaveLength(2); // two task groups
    expect(result.findings[0].tasks[0].supportingEvidence).toHaveLength(2);
    expect(result.findings[0].tasks[1].supportingEvidence).toHaveLength(1);
  });

  it('handles evidence with no taskId (unknown_task)', async () => {
    const cases = [{ case_id: 1, status: 'STATUS_20_IN_PROGRESS', created_at: '2024-01-01' }];
    mockGet
      .mockResolvedValueOnce(cases as any)
      .mockResolvedValueOnce({
        evidence: [{ id: 'e1' }],
      } as any);

    const result = await ReportsService.getEvidenceFindingsData();
    expect(result.findings[0].tasks[0].taskId).toBeUndefined();
  });

  it('handles evidence with attachments', async () => {
    const cases = [{ case_id: 1, status: 'STATUS_20_IN_PROGRESS', created_at: '2024-01-01' }];
    mockGet
      .mockResolvedValueOnce(cases as any)
      .mockResolvedValueOnce({
        evidence: [{
          id: 'e1',
          taskId: 1,
          attachments: [{ fileName: 'att.pdf', fileSize: 1024, mimeType: 'application/pdf', hash: 'abc' }],
        }],
      } as any);

    const result = await ReportsService.getEvidenceFindingsData();
    const ev = result.findings[0].tasks[0].supportingEvidence[0];
    expect(ev.fileName).toBe('att.pdf');
    expect(ev.fileSize).toBe(1024);
    expect(ev.mimeType).toBe('application/pdf');
    expect(ev.hash).toBe('abc');
  });

  it('handles per-case evidence fetch failure gracefully', async () => {
    const cases = [
      { case_id: 1, status: 'STATUS_20_IN_PROGRESS', created_at: '2024-01-01' },
      { case_id: 2, status: 'STATUS_20_IN_PROGRESS', created_at: '2024-01-02' },
    ];
    mockGet
      .mockResolvedValueOnce(cases as any)
      .mockRejectedValueOnce(new Error('evidence fetch fail')) // case 1 fails
      .mockResolvedValueOnce({ evidence: [{ id: 'e1', taskId: 1 }] } as any); // case 2 succeeds

    const result = await ReportsService.getEvidenceFindingsData();
    expect(result.stats.totalFindings).toBe(1); // only case 2 has findings
  });

  it('returns empty on outer error', async () => {
    mockGet.mockRejectedValue(new Error('total fail'));

    const result = await ReportsService.getEvidenceFindingsData();
    expect(result.stats.totalFindings).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it('handles casesResponse with data property', async () => {
    mockGet.mockResolvedValueOnce({
      data: [{ case_id: 1, status: 'STATUS_20_IN_PROGRESS', created_at: '2024-01-01' }],
    } as any);
    mockGet.mockResolvedValueOnce({ evidence: [{ id: 'e1', taskId: 1 }] } as any);

    const result = await ReportsService.getEvidenceFindingsData();
    expect(result.stats.totalFindings).toBe(1);
  });
});

/* ═══════════ formatDisplayValue ═══════════ */

describe('ReportsService.formatDisplayValue', () => {
  it('formats number without unit', () => {
    expect(ReportsService.formatDisplayValue(42)).toBe('42');
  });

  it('formats number with unit', () => {
    expect(ReportsService.formatDisplayValue(42, '%')).toBe('42%');
  });

  it('returns fallback for null', () => {
    expect(ReportsService.formatDisplayValue(null)).toBe('0');
  });

  it('returns fallback for undefined', () => {
    expect(ReportsService.formatDisplayValue(undefined)).toBe('0');
  });

  it('returns fallback for NaN', () => {
    expect(ReportsService.formatDisplayValue(NaN, 'hrs')).toBe('0hrs');
  });
});

/* ═══════════ handleError (tested via generateFraudReport) ═══════════ */

describe('ReportsService.handleError (via generateFraudReport)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns original Error', async () => {
    mockUpload.mockRejectedValue(new Error('original'));
    await expect(ReportsService.generateFraudReport({ file: new File([], 'f'), caseId: 1, reportType: 'X' } as any))
      .rejects.toThrow('original');
  });

  it('extracts response.data.message', async () => {
    mockUpload.mockRejectedValue({ response: { data: { message: 'server error' } } });
    await expect(ReportsService.generateFraudReport({ file: new File([], 'f'), caseId: 1, reportType: 'X' } as any))
      .rejects.toThrow('server error');
  });

  it('falls back to response.data without message', async () => {
    mockUpload.mockRejectedValue({ response: { data: {} } });
    await expect(ReportsService.generateFraudReport({ file: new File([], 'f'), caseId: 1, reportType: 'X' } as any))
      .rejects.toThrow('Failed to upload evidence');
  });

  it('extracts err.message', async () => {
    mockUpload.mockRejectedValue({ message: 'generic msg' });
    await expect(ReportsService.generateFraudReport({ file: new File([], 'f'), caseId: 1, reportType: 'X' } as any))
      .rejects.toThrow('generic msg');
  });

  it('returns default error for unknown shape', async () => {
    mockUpload.mockRejectedValue(42);
    await expect(ReportsService.generateFraudReport({ file: new File([], 'f'), caseId: 1, reportType: 'X' } as any))
      .rejects.toThrow('Failed to upload evidence');
  });
});
