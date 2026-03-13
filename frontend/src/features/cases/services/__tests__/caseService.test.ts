import { describe, it, expect, vi, beforeEach } from 'vitest';
import { caseService, CaseService } from '../caseService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient');

const mockCaseBase = {
  case_id: 123,
  case_type: 'FRAUD',
  status: 'STATUS_20_IN_PROGRESS',
  priority: 'HIGH',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-02T00:00:00Z',
};

describe('CaseService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ─── getUserCases ───────────────────────────────────────────────

  describe('getUserCases', () => {
    it('fetches user cases with default parameters', async () => {
      const mockResponse = {
        cases: [{ ...mockCaseBase, total_tasks: 1 }],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
        summary: {
          totalOwnedCases: 1,
          totalTaskAssignments: 1,
          casesByStatus: {},
          casesByPriority: {},
        },
      };
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await caseService.getUserCases();

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/cases/user/assigned'),
      );
      expect(result).toEqual(mockResponse);
    });

    it('fetches user cases with all query parameters', async () => {
      const mockResponse = {
        cases: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        summary: {
          totalOwnedCases: 0,
          totalTaskAssignments: 0,
          casesByStatus: {},
          casesByPriority: {},
        },
      };
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      await caseService.getUserCases({
        status: 'STATUS_20_IN_PROGRESS',
        priority: 'HIGH',
        page: 2,
        limit: 20,
        sortBy: 'created_at',
        sortOrder: 'desc',
        includeTaskAssignments: false,
        includeOwnedCases: false,
      });

      const calledUrl = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledUrl).toContain('status=STATUS_20_IN_PROGRESS');
      expect(calledUrl).toContain('priority=HIGH');
      expect(calledUrl).toContain('page=2');
      expect(calledUrl).toContain('limit=20');
      expect(calledUrl).toContain('sortBy=created_at');
      expect(calledUrl).toContain('sortOrder=desc');
      expect(calledUrl).toContain('includeTaskAssignments=false');
      expect(calledUrl).toContain('includeOwnedCases=false');
    });

    it('applies default includeTaskAssignments and includeOwnedCases when not provided', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        cases: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
        summary: { totalOwnedCases: 0, totalTaskAssignments: 0, casesByStatus: {}, casesByPriority: {} },
      });

      await caseService.getUserCases({});

      const calledUrl = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledUrl).toContain('includeTaskAssignments=true');
      expect(calledUrl).toContain('includeOwnedCases=true');
    });

    it('throws on error', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      await expect(caseService.getUserCases()).rejects.toThrow('Failed to get user cases: Network error');
    });
  });

  // ─── getUserWorkloadStats ───────────────────────────────────────

  describe('getUserWorkloadStats', () => {
    it('fetches user workload statistics', async () => {
      const mockStats = {
        totalActiveCases: 5,
        totalPendingTasks: 3,
        casesByStatus: { STATUS_20_IN_PROGRESS: 5 },
        casesByPriority: { HIGH: 2, MEDIUM: 3 },
        averageCaseAge: 10,
      };
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockStats);

      const result = await caseService.getUserWorkloadStats();

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/cases/user/workload');
      expect(result).toEqual(mockStats);
    });

    it('throws on error', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      await expect(caseService.getUserWorkloadStats()).rejects.toThrow(
        'Failed to get user workload stats: Network error',
      );
    });
  });

  // ─── getCaseDetails ─────────────────────────────────────────────

  describe('getCaseDetails', () => {
    it('fetches case details by ID with direct case_id', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.getCaseDetails(123);

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/cases/123');
      expect(result).toEqual(mockCaseBase);
    });

    it('handles nested case response', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        case: mockCaseBase,
      });

      const result = await caseService.getCaseDetails(123);
      expect(result).toEqual(mockCaseBase);
    });

    it('throws when case_id is missing from response', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'ok' });

      await expect(caseService.getCaseDetails(123)).rejects.toThrow(
        'Case ID is missing from response',
      );
    });

    it('throws when response is null', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(caseService.getCaseDetails(123)).rejects.toThrow(
        'Invalid case data received',
      );
    });

    it('throws on API error', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Not found'));

      await expect(caseService.getCaseDetails(123)).rejects.toThrow(
        'Failed to get case details: Not found',
      );
    });
  });

  // ─── getSubCasesDetails ─────────────────────────────────────────

  describe('getSubCasesDetails', () => {
    it('fetches sub-cases as array', async () => {
      const mockArray = [mockCaseBase, { ...mockCaseBase, case_id: 456 }];
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockArray);

      const result = await caseService.getSubCasesDetails(1);

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/cases/parentId/1');
      expect(result).toHaveLength(2);
    });

    it('handles {cases: [...]} response', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        cases: [mockCaseBase],
      });

      const result = await caseService.getSubCasesDetails(1);
      expect(result).toHaveLength(1);
    });

    it('handles {data: [...]} response', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [mockCaseBase],
      });

      const result = await caseService.getSubCasesDetails(1);
      expect(result).toHaveLength(1);
    });

    it('throws for invalid array response', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ invalid: true });

      await expect(caseService.getSubCasesDetails(1)).rejects.toThrow(
        'Invalid case array response structure',
      );
    });

    it('throws for null response', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(caseService.getSubCasesDetails(1)).rejects.toThrow(
        'Invalid case data received',
      );
    });

    it('throws on API error', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(caseService.getSubCasesDetails(1)).rejects.toThrow(
        'Failed to get case details: fail',
      );
    });
  });

  // ─── closeCase ──────────────────────────────────────────────────

  describe('closeCase', () => {
    it('closes a case with recommended outcome', async () => {
      const mockResponse = {
        message: 'Case closed',
        closed_case: {
          case_id: 123,
          status: 'STATUS_82_CLOSED_CONFIRMED',
          updated_at: '2023-01-02T00:00:00Z',
        },
        approval_task: {
          task_id: 1,
          name: 'Approve Case Closure',
          status: 'STATUS_10_ASSIGNED',
          assigned_to: 'user-1',
        },
        processInstanceId: 'PROC-1',
      };
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await caseService.closeCase(123, {
        recommendedOutcome: 'STATUS_82_CLOSED_CONFIRMED',
        finalNotes: 'Investigation complete',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/123/close',
        expect.objectContaining({ recommendedOutcome: 'STATUS_82_CLOSED_CONFIRMED' }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('throws on error', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(
        caseService.closeCase(123, {
          recommendedOutcome: 'STATUS_82_CLOSED_CONFIRMED',
          finalNotes: 'notes',
        }),
      ).rejects.toThrow('Failed to close case: fail');
    });
  });

  // ─── createCase ─────────────────────────────────────────────────

  describe('createCase', () => {
    it('creates a case manually', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.createCase({
        alertType: 'FRAUD',
        priorityScore: 90,
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/cases/manual',
        expect.objectContaining({ alertType: 'FRAUD' }),
      );
      expect(result).toEqual(mockCaseBase);
    });

    it('throws on error', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(caseService.createCase({ alertType: 'FRAUD' })).rejects.toThrow(
        'Failed to create case: fail',
      );
    });
  });

  // ─── SaveCaseAsDraft ────────────────────────────────────────────

  describe('SaveCaseAsDraft', () => {
    it('saves a case as draft', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.SaveCaseAsDraft({ alertType: 'FRAUD' });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/cases/save-as-draft',
        { alertType: 'FRAUD' },
      );
      expect(result).toEqual(mockCaseBase);
    });

    it('throws on error', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(caseService.SaveCaseAsDraft({ alertType: 'FRAUD' })).rejects.toThrow(
        'Failed to create case: fail',
      );
    });
  });

  // ─── updateCase ─────────────────────────────────────────────────

  describe('updateCase', () => {
    it('updates a case', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.updateCase(123, {
        status: 'STATUS_20_IN_PROGRESS',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/123',
        expect.objectContaining({ status: 'STATUS_20_IN_PROGRESS' }),
      );
      expect(result).toEqual(mockCaseBase);
    });

    it('throws on error', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(
        caseService.updateCase(123, { status: 'NEW' }),
      ).rejects.toThrow('Failed to update case: fail');
    });
  });

  // ─── completeCase ───────────────────────────────────────────────

  describe('completeCase', () => {
    it('completes case creation', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.completeCase(123, {
        status: 'STATUS_20_IN_PROGRESS',
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/cases/123/complete-case-creation',
        expect.objectContaining({ status: 'STATUS_20_IN_PROGRESS' }),
      );
      expect(result).toEqual(mockCaseBase);
    });

    it('throws on error', async () => {
      (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(
        caseService.completeCase(123, { status: 'NEW' }),
      ).rejects.toThrow('Failed to complete case: fail');
    });
  });

  // ─── abandonCase ────────────────────────────────────────────────

  describe('abandonCase', () => {
    it('abandons a case with direct response', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.abandonCase(123, {
        reason: 'No longer relevant',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/123/abandon',
        expect.objectContaining({ reason: 'No longer relevant' }),
      );
      expect(result).toEqual(mockCaseBase);
    });

    it('handles nested case response', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({
        case: mockCaseBase,
      });

      const result = await caseService.abandonCase(123, { reason: 'test' });
      expect(result).toEqual(mockCaseBase);
    });

    it('throws on error', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(
        caseService.abandonCase(123, { reason: 'test' }),
      ).rejects.toThrow('Failed to abandon case: fail');
    });
  });

  // ─── resumeCase ─────────────────────────────────────────────────

  describe('resumeCase', () => {
    it('resumes a suspended case', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.resumeCase(123, {
        reason: 'New information available',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/123/resume',
        expect.objectContaining({ reason: 'New information available' }),
      );
      expect(result).toEqual(mockCaseBase);
    });

    it('throws on error', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(
        caseService.resumeCase(123, { reason: 'test' }),
      ).rejects.toThrow('Failed to resume case: fail');
    });
  });

  // ─── rejectCase ─────────────────────────────────────────────────

  describe('rejectCase', () => {
    it('rejects a case', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.rejectCase(123, {
        rejectionReason: 'Insufficient evidence',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/123/reject',
        expect.objectContaining({ rejectionReason: 'Insufficient evidence' }),
      );
      expect(result).toEqual(mockCaseBase);
    });

    it('throws on error', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(
        caseService.rejectCase(123, { rejectionReason: 'test' }),
      ).rejects.toThrow('Failed to reject case: fail');
    });
  });

  // ─── reopenCase ─────────────────────────────────────────────────

  describe('reopenCase', () => {
    it('reopens a closed case', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.reopenCase(123, {
        reason: 'New evidence found',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/123/reopen',
        expect.objectContaining({ reason: 'New evidence found' }),
      );
      expect(result).toEqual(mockCaseBase);
    });

    it('throws on error', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(
        caseService.reopenCase(123, { reason: 'test' }),
      ).rejects.toThrow('Failed to reopen case: fail');
    });
  });

  // ─── approveCaseReopening ───────────────────────────────────────

  describe('approveCaseReopening', () => {
    it('returns response directly when it has "case" property', async () => {
      const mockResponse = {
        success: true,
        message: 'Case reopening approved',
        case: mockCaseBase,
      };
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await caseService.approveCaseReopening(123);

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/123/approve-reopening',
        {},
      );
      expect(result).toEqual(mockResponse);
    });

    it('wraps response when "case" property is missing', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.approveCaseReopening(123);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Case reopening approved');
      expect(result.case).toEqual(mockCaseBase);
    });

    it('throws on error', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(caseService.approveCaseReopening(123)).rejects.toThrow(
        'Failed to approve case reopening: fail',
      );
    });
  });

  // ─── rejectCaseReopening ────────────────────────────────────────

  describe('rejectCaseReopening', () => {
    it('returns response directly when it has "case" property', async () => {
      const mockResponse = {
        success: false,
        message: 'Case reopening rejected',
        case: mockCaseBase,
        rejection_reason: 'No new evidence',
      };
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await caseService.rejectCaseReopening(123, 'No new evidence');

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/123/reject-reopening',
        { rejectionReason: 'No new evidence' },
      );
      expect(result.rejection_reason).toBe('No new evidence');
    });

    it('wraps response when "case" property is missing', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.rejectCaseReopening(123, 'No evidence');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Case reopening rejected');
      expect(result.rejection_reason).toBe('No evidence');
    });

    it('throws on error', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(
        caseService.rejectCaseReopening(123, 'reason'),
      ).rejects.toThrow('Failed to reject case reopening: fail');
    });
  });

  // ─── suspendCase ────────────────────────────────────────────────

  describe('suspendCase', () => {
    it('suspends a case', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.suspendCase(123, {
        reason: 'Awaiting external information',
        taskIds: [1, 2],
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/123/suspend',
        expect.objectContaining({ reason: 'Awaiting external information' }),
      );
      expect(result).toEqual(mockCaseBase);
    });

    it('throws on error', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(
        caseService.suspendCase(123, { reason: 'test', taskIds: [] }),
      ).rejects.toThrow('Failed to suspend case: fail');
    });
  });

  // ─── approveCaseClosure ─────────────────────────────────────────

  describe('approveCaseClosure', () => {
    it('approves case closure', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.approveCaseClosure(123, {
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
        supervisorComments: 'Approved',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/123/approve',
        expect.objectContaining({ finalOutcome: 'STATUS_82_CLOSED_CONFIRMED' }),
      );
      expect(result).toEqual(mockCaseBase);
    });

    it('throws on error', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(
        caseService.approveCaseClosure(123, {
          finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
          supervisorComments: 'ok',
        }),
      ).rejects.toThrow('Failed to approve case closure: fail');
    });
  });

  // ─── returnCaseForReview ────────────────────────────────────────

  describe('returnCaseForReview', () => {
    it('returns a case for review', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.returnCaseForReview(123, {
        reviewComments: 'Needs more investigation',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/123/return-for-review',
        expect.objectContaining({ reviewComments: 'Needs more investigation' }),
      );
      expect(result).toEqual(mockCaseBase);
    });

    it('throws on error', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(
        caseService.returnCaseForReview(123, { reviewComments: 'test' }),
      ).rejects.toThrow('Failed to return case for review: fail');
    });
  });

  // ─── approveCaseCreation ────────────────────────────────────────

  describe('approveCaseCreation', () => {
    it('approves case creation', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.approveCaseCreation(123);

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/123/approve-creation',
        {},
      );
      expect(result).toEqual(mockCaseBase);
    });

    it('throws on error', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(caseService.approveCaseCreation(123)).rejects.toThrow(
        'Failed to approve case creation: fail',
      );
    });
  });

  // ─── rejectCaseCreation ─────────────────────────────────────────

  describe('rejectCaseCreation', () => {
    it('rejects case creation', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.rejectCaseCreation(123, {
        reason: 'Invalid case data',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/123/reject-creation',
        expect.objectContaining({ reason: 'Invalid case data' }),
      );
      expect(result).toEqual(mockCaseBase);
    });

    it('throws on error', async () => {
      (apiClient.put as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(
        caseService.rejectCaseCreation(123, { reason: 'test' }),
      ).rejects.toThrow('Failed to reject case creation: fail');
    });
  });

  // ─── getUserAssignedCases ───────────────────────────────────────

  describe('getUserAssignedCases', () => {
    it('fetches user assigned cases with no query', async () => {
      const mockResponse = {
        cases: [{ ...mockCaseBase, total_tasks: 1 }],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await caseService.getUserAssignedCases();

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/cases/user/assigned'),
      );
      expect(result).toEqual(mockResponse);
    });

    it('fetches with all query parameters', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ cases: [] });

      await caseService.getUserAssignedCases({
        status: 'STATUS_20_IN_PROGRESS',
        priority: 'HIGH',
        includeTaskAssignments: true,
        includeOwnedCases: true,
        page: 2,
        limit: 50,
        sortBy: 'priority',
        sortOrder: 'asc',
      });

      const calledUrl = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledUrl).toContain('status=STATUS_20_IN_PROGRESS');
      expect(calledUrl).toContain('priority=HIGH');
      expect(calledUrl).toContain('includeTaskAssignments=true');
      expect(calledUrl).toContain('includeOwnedCases=true');
      expect(calledUrl).toContain('page=2');
      expect(calledUrl).toContain('limit=50');
      expect(calledUrl).toContain('sortBy=priority');
      expect(calledUrl).toContain('sortOrder=asc');
    });

    it('throws on error', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(caseService.getUserAssignedCases()).rejects.toThrow(
        'Failed to get user assigned cases: fail',
      );
    });
  });

  // ─── getAllCases ────────────────────────────────────────────────

  describe('getAllCases', () => {
    it('fetches all cases with no query', async () => {
      const mockResponse = {
        cases: [{ ...mockCaseBase, total_tasks: 1 }],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await caseService.getAllCases();

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/cases/all'),
      );
      expect(result).toEqual(mockResponse);
    });

    it('fetches with all query parameters including boolean flags', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ cases: [] });

      await caseService.getAllCases({
        status: 'STATUS_20_IN_PROGRESS',
        priority: 'HIGH',
        sarStrStatus: 'FILED',
        search: 'test query',
        page: 3,
        limit: 25,
        sortBy: 'updated_at',
        sortOrder: 'desc',
        excludeDraft: true,
        excludeClosed: true,
        closedOnly: true,
      });

      const calledUrl = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledUrl).toContain('status=STATUS_20_IN_PROGRESS');
      expect(calledUrl).toContain('priority=HIGH');
      expect(calledUrl).toContain('sarStrStatus=FILED');
      expect(calledUrl).toContain('page=3');
      expect(calledUrl).toContain('limit=25');
      expect(calledUrl).toContain('sortBy=updated_at');
      expect(calledUrl).toContain('sortOrder=desc');
      expect(calledUrl).toContain('excludeDraft=true');
      expect(calledUrl).toContain('excludeClosed=true');
      expect(calledUrl).toContain('closedOnly=true');
    });

    it('does not include boolean flags when false', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ cases: [] });

      await caseService.getAllCases({
        excludeDraft: false,
        excludeClosed: false,
        closedOnly: false,
      });

      const calledUrl = (apiClient.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('excludeDraft');
      expect(calledUrl).not.toContain('excludeClosed');
      expect(calledUrl).not.toContain('closedOnly');
    });

    it('throws on error', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await expect(caseService.getAllCases()).rejects.toThrow(
        'Failed to get all cases: fail',
      );
    });
  });

  // ─── handleError (static) ──────────────────────────────────────

  describe('error handling', () => {
    it('handles API errors with response data', async () => {
      const apiError = {
        response: {
          data: {
            message: 'Custom error message',
          },
        },
      };
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(apiError);

      await expect(caseService.getUserWorkloadStats()).rejects.toThrow(
        'Custom error message',
      );
    });

    it('handles API errors without message in response data', async () => {
      const apiError = {
        response: {
          data: {},
        },
      };
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(apiError);

      await expect(caseService.getUserWorkloadStats()).rejects.toThrow(
        'Failed to get user workload stats',
      );
    });

    it('handles Error instances', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      await expect(caseService.getUserWorkloadStats()).rejects.toThrow(
        'Failed to get user workload stats: Network error',
      );
    });

    it('handles non-Error rejections (string)', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue('string error');

      await expect(caseService.getUserWorkloadStats()).rejects.toThrow(
        'Failed to get user workload stats',
      );
    });

    it('handles non-Error rejections (null)', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(null);

      await expect(caseService.getUserWorkloadStats()).rejects.toThrow(
        'Failed to get user workload stats',
      );
    });
  });

  // ─── validateCaseResponse (via getCaseDetails) ──────────────────

  describe('validateCaseResponse', () => {
    it('returns case when case_id is present at top level', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockCaseBase);

      const result = await caseService.getCaseDetails(1);
      expect(result.case_id).toBe(123);
    });

    it('extracts case from nested case property', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        case: mockCaseBase,
      });

      const result = await caseService.getCaseDetails(1);
      expect(result.case_id).toBe(123);
    });

    it('throws for non-object data', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue('not an object');

      await expect(caseService.getCaseDetails(1)).rejects.toThrow(
        'Invalid case data received',
      );
    });

    it('throws for null nested case', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ case: null });

      await expect(caseService.getCaseDetails(1)).rejects.toThrow(
        'Case ID is missing from response',
      );
    });

    it('throws for nested case without case_id', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        case: { status: 'ok' },
      });

      await expect(caseService.getCaseDetails(1)).rejects.toThrow(
        'Case ID is missing from response',
      );
    });
  });

  // ─── validateCaseArrayResponse (via getSubCasesDetails) ─────────

  describe('validateCaseArrayResponse', () => {
    it('validates each item in an array', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue([
        mockCaseBase,
        { ...mockCaseBase, case_id: 456 },
      ]);

      const result = await caseService.getSubCasesDetails(1);
      expect(result).toHaveLength(2);
    });

    it('handles {cases: [...]} format', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        cases: [mockCaseBase],
      });

      const result = await caseService.getSubCasesDetails(1);
      expect(result).toHaveLength(1);
    });

    it('handles {data: [...]} format', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [mockCaseBase],
      });

      const result = await caseService.getSubCasesDetails(1);
      expect(result).toHaveLength(1);
    });

    it('throws for non-array and non-recognized object', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ something: 'else' });

      await expect(caseService.getSubCasesDetails(1)).rejects.toThrow(
        'Invalid case array response structure',
      );
    });

    it('throws when null is passed', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(caseService.getSubCasesDetails(1)).rejects.toThrow(
        'Invalid case data received',
      );
    });

    it('throws when cases property is not an array', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ cases: 'not-array' });

      await expect(caseService.getSubCasesDetails(1)).rejects.toThrow(
        'Invalid case array response structure',
      );
    });

    it('throws when data property is not an array', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: 'not-array' });

      await expect(caseService.getSubCasesDetails(1)).rejects.toThrow(
        'Invalid case array response structure',
      );
    });
  });

  // ─── CaseService class existence ───────────────────────────────

  describe('CaseService class', () => {
    it('exports CaseService class and singleton', () => {
      expect(CaseService).toBeDefined();
      expect(caseService).toBeInstanceOf(CaseService);
    });
  });
});
