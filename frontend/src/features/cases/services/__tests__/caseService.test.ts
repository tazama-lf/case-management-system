import { describe, it, expect, vi, beforeEach } from 'vitest';
import { caseService } from '../caseService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient');

describe('CaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserCases', () => {
    it('fetches user cases with default parameters', async () => {
      const mockResponse = {
        cases: [
          {
            case_id: 'CASE-1',
            status: 'STATUS_20_IN_PROGRESS',
            priority: 'HIGH',
            case_type: 'FRAUD',
            created_at: new Date(),
            updated_at: new Date(),
            total_tasks: 1,
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
        summary: {
          totalOwnedCases: 1,
          totalTaskAssignments: 1,
          casesByStatus: {},
          casesByPriority: {},
        },
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockResponse);

      const result = await caseService.getUserCases();

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/cases/user/assigned'),
      );
      expect(result).toEqual(mockResponse);
    });

    it('fetches user cases with query parameters', async () => {
      const mockResponse = {
        cases: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
        summary: {
          totalOwnedCases: 0,
          totalTaskAssignments: 0,
          casesByStatus: {},
          casesByPriority: {},
        },
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockResponse);

      await caseService.getUserCases({
        status: 'STATUS_20_IN_PROGRESS',
        priority: 'HIGH',
        page: 1,
        limit: 20,
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('status=STATUS_20_IN_PROGRESS'),
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('priority=HIGH'),
      );
    });
  });

  describe('getUserWorkloadStats', () => {
    it('fetches user workload statistics', async () => {
      const mockStats = {
        totalActiveCases: 5,
        totalPendingTasks: 3,
        casesByStatus: { STATUS_20_IN_PROGRESS: 5 },
        casesByPriority: { HIGH: 2, MEDIUM: 3 },
        averageCaseAge: 10,
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockStats);

      const result = await caseService.getUserWorkloadStats();

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/cases/user/workload');
      expect(result).toEqual(mockStats);
    });
  });

  describe('getCaseDetails', () => {
    it('fetches case details by ID', async () => {
      const mockCase = {
        case_id: 'CASE-123',
        case_type: 'FRAUD',
        status: 'STATUS_20_IN_PROGRESS',
        priority: 'HIGH',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockCase);

      const result = await caseService.getCaseDetails('CASE-123');

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/cases/CASE-123');
      expect(result).toEqual(mockCase);
    });

    it('handles errors when case not found', async () => {
      const error = new Error('Case not found');
      (apiClient.get as vi.Mock).mockRejectedValue(error);

      await expect(caseService.getCaseDetails('CASE-123')).rejects.toThrow();
    });
  });

  describe('closeCase', () => {
    it('closes a case with recommended outcome', async () => {
      const mockResponse = {
        message: 'Case closed',
        closed_case: {
          case_id: 'CASE-123',
          status: 'STATUS_82_CLOSED_CONFIRMED',
          updated_at: '2023-01-02T00:00:00Z',
        },
        approval_task: {
          task_id: 'TASK-1',
          name: 'Approve Case Closure',
          status: 'STATUS_10_ASSIGNED',
          assigned_to: 'user-1',
        },
        processInstanceId: 'PROC-1',
      };
      (apiClient.put as vi.Mock).mockResolvedValue(mockResponse);

      const result = await caseService.closeCase('CASE-123', {
        recommendedOutcome: 'STATUS_82_CLOSED_CONFIRMED',
        finalNotes: 'Investigation complete',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/CASE-123/close',
        expect.objectContaining({
          recommendedOutcome: 'STATUS_82_CLOSED_CONFIRMED',
        }),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('createCase', () => {
    it('creates a case manually', async () => {
      const mockCase = {
        case_id: 'CASE-123',
        case_type: 'FRAUD',
        status: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL',
        priority: 'HIGH',
      };
      (apiClient.post as vi.Mock).mockResolvedValue(mockCase);

      const result = await caseService.createCase({
        alertType: 'FRAUD',
        priorityScore: 90,
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/cases/manual',
        expect.objectContaining({
          alertType: 'FRAUD',
        }),
      );
      expect(result).toEqual(mockCase);
    });
  });

  describe('updateCase', () => {
    it('updates a case', async () => {
      const mockCase = {
        case_id: 'CASE-123',
        status: 'STATUS_20_IN_PROGRESS',
        priority: 'HIGH',
      };
      (apiClient.put as vi.Mock).mockResolvedValue(mockCase);

      const result = await caseService.updateCase('CASE-123', {
        status: 'STATUS_20_IN_PROGRESS',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/CASE-123',
        expect.objectContaining({ status: 'STATUS_20_IN_PROGRESS' }),
      );
      expect(result).toEqual(mockCase);
    });
  });

  describe('abandonCase', () => {
    it('abandons a case', async () => {
      const mockCase = {
        case_id: 'CASE-123',
        status: 'STATUS_99_ABANDONED',
      };
      (apiClient.put as vi.Mock).mockResolvedValue(mockCase);

      const result = await caseService.abandonCase('CASE-123', {
        reason: 'No longer relevant',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/CASE-123/abandon',
        expect.objectContaining({ reason: 'No longer relevant' }),
      );
      expect(result).toEqual(mockCase);
    });
  });

  describe('resumeCase', () => {
    it('resumes a suspended case', async () => {
      const mockCase = {
        case_id: 'CASE-123',
        status: 'STATUS_20_IN_PROGRESS',
      };
      (apiClient.put as vi.Mock).mockResolvedValue(mockCase);

      const result = await caseService.resumeCase('CASE-123', {
        reason: 'New information available',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/CASE-123/resume',
        expect.objectContaining({ reason: 'New information available' }),
      );
      expect(result).toEqual(mockCase);
    });
  });

  describe('rejectCase', () => {
    it('rejects a case', async () => {
      const mockCase = {
        case_id: 'CASE-123',
        status: 'STATUS_03_RETURNED',
      };
      (apiClient.put as vi.Mock).mockResolvedValue(mockCase);

      const result = await caseService.rejectCase('CASE-123', {
        rejectionReason: 'Insufficient evidence',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/CASE-123/reject',
        expect.objectContaining({ rejectionReason: 'Insufficient evidence' }),
      );
      expect(result).toEqual(mockCase);
    });
  });

  describe('reopenCase', () => {
    it('reopens a closed case', async () => {
      const mockCase = {
        case_id: 'CASE-123',
        status: 'STATUS_30_PENDING_REOPENING',
      };
      (apiClient.put as vi.Mock).mockResolvedValue(mockCase);

      const result = await caseService.reopenCase('CASE-123', {
        reason: 'New evidence found',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/CASE-123/reopen',
        expect.objectContaining({ reason: 'New evidence found' }),
      );
      expect(result).toEqual(mockCase);
    });
  });

  describe('approveCaseReopening', () => {
    it('approves case reopening', async () => {
      const mockResponse = {
        success: true,
        message: 'Case reopening approved',
        case: {
          case_id: 'CASE-123',
          status: 'STATUS_31_REOPENED',
        },
      };
      (apiClient.put as vi.Mock).mockResolvedValue(mockResponse);

      const result = await caseService.approveCaseReopening('CASE-123');

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/CASE-123/approve-reopening',
        {},
      );
      expect(result.success).toBe(true);
    });
  });

  describe('rejectCaseReopening', () => {
    it('rejects case reopening', async () => {
      const mockResponse = {
        success: false,
        message: 'Case reopening rejected',
        case: {
          case_id: 'CASE-123',
          status: 'STATUS_82_CLOSED_CONFIRMED',
        },
        rejection_reason: 'No new evidence',
      };
      (apiClient.put as vi.Mock).mockResolvedValue(mockResponse);

      const result = await caseService.rejectCaseReopening(
        'CASE-123',
        'No new evidence',
      );

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/CASE-123/reject-reopening',
        { rejectionReason: 'No new evidence' },
      );
      expect(result.rejection_reason).toBe('No new evidence');
    });
  });

  describe('suspendCase', () => {
    it('suspends a case', async () => {
      const mockCase = {
        case_id: 'CASE-123',
        status: 'STATUS_21_SUSPENDED',
      };
      (apiClient.put as vi.Mock).mockResolvedValue(mockCase);

      const result = await caseService.suspendCase('CASE-123', {
        reason: 'Awaiting external information',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/CASE-123/suspend',
        expect.objectContaining({ reason: 'Awaiting external information' }),
      );
      expect(result).toEqual(mockCase);
    });
  });

  describe('approveCaseClosure', () => {
    it('approves case closure', async () => {
      const mockCase = {
        case_id: 'CASE-123',
        status: 'STATUS_82_CLOSED_CONFIRMED',
      };
      (apiClient.put as vi.Mock).mockResolvedValue(mockCase);

      const result = await caseService.approveCaseClosure('CASE-123', {
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
        supervisorComments: 'Approved',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/CASE-123/approve',
        expect.objectContaining({
          finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
        }),
      );
      expect(result).toEqual(mockCase);
    });
  });

  describe('returnCaseForReview', () => {
    it('returns a case for review', async () => {
      const mockCase = {
        case_id: 'CASE-123',
        status: 'STATUS_03_RETURNED',
      };
      (apiClient.put as vi.Mock).mockResolvedValue(mockCase);

      const result = await caseService.returnCaseForReview('CASE-123', {
        reviewComments: 'Needs more investigation',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/CASE-123/return-for-review',
        expect.objectContaining({
          reviewComments: 'Needs more investigation',
        }),
      );
      expect(result).toEqual(mockCase);
    });
  });

  describe('approveCaseCreation', () => {
    it('approves case creation', async () => {
      const mockCase = {
        case_id: 'CASE-123',
        status: 'STATUS_02_READY_FOR_ASSIGNMENT',
      };
      (apiClient.put as vi.Mock).mockResolvedValue(mockCase);

      const result = await caseService.approveCaseCreation('CASE-123');

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/CASE-123/approve-creation',
        {},
      );
      expect(result).toEqual(mockCase);
    });
  });

  describe('rejectCaseCreation', () => {
    it('rejects case creation', async () => {
      const mockCase = {
        case_id: 'CASE-123',
        status: 'STATUS_99_ABANDONED',
      };
      (apiClient.put as vi.Mock).mockResolvedValue(mockCase);

      const result = await caseService.rejectCaseCreation('CASE-123', {
        reason: 'Invalid case data',
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        '/api/v1/cases/CASE-123/reject-creation',
        expect.objectContaining({ reason: 'Invalid case data' }),
      );
      expect(result).toEqual(mockCase);
    });
  });

  describe('getUserAssignedCases', () => {
    it('fetches user assigned cases', async () => {
      const mockResponse = {
        cases: [
          {
            case_id: 'CASE-1',
            status: 'STATUS_20_IN_PROGRESS',
            priority: 'HIGH',
            case_type: 'FRAUD',
            created_at: new Date(),
            updated_at: new Date(),
            total_tasks: 1,
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockResponse);

      const result = await caseService.getUserAssignedCases();

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/cases/user/assigned'),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getAllCases', () => {
    it('fetches all cases', async () => {
      const mockResponse = {
        cases: [
          {
            case_id: 'CASE-1',
            status: 'STATUS_20_IN_PROGRESS',
            priority: 'HIGH',
            case_type: 'FRAUD',
            created_at: new Date(),
            updated_at: new Date(),
            total_tasks: 1,
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockResponse);

      const result = await caseService.getAllCases();

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/cases/all'),
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('error handling', () => {
    it('handles API errors with response data', async () => {
      const apiError = {
        response: {
          data: {
            message: 'Custom error message',
          },
        },
      };
      (apiClient.get as vi.Mock).mockReset();
      (apiClient.get as vi.Mock).mockRejectedValueOnce(apiError);

      await expect(caseService.getCaseDetails('CASE-123' as any)).rejects.toThrow(
        'Custom error message',
      );
    });

    it('handles API errors without response data', async () => {
      const error = new Error('Network error');
      (apiClient.get as vi.Mock).mockReset();
      (apiClient.get as vi.Mock).mockRejectedValueOnce(error);

      await expect(caseService.getCaseDetails('CASE-123' as any)).rejects.toThrow(
        'Failed to get case details: Network error',
      );
    });
  });
});
