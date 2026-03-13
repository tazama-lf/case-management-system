import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadEvidence, fetchCasesAndEvidence } from '../investigationUtils';

vi.mock('../../services/evidenceService', () => ({
  evidenceService: { getTaskEvidence: vi.fn() },
}));
vi.mock('../../services/caseService', () => ({
  caseService: { getCaseDetails: vi.fn() },
}));
vi.mock('../../services/commentService', () => ({
  commentService: { getCommentsByTask: vi.fn() },
}));
vi.mock('../../services/taskService', () => ({
  taskService: { getTasksByCaseId: vi.fn() },
}));
vi.mock('../../services/userService', () => ({
  default: { getUserDetailsById: vi.fn() },
  UserService: { formatUserName: vi.fn() },
}));
vi.mock('@/shared/utils/dateUtils', () => ({
  formatDate: vi.fn((d: string) => `formatted-${d}`),
}));

import { evidenceService } from '../../services/evidenceService';
import { caseService } from '../../services/caseService';
import { commentService } from '../../services/commentService';
import { taskService } from '../../services/taskService';
import userService, { UserService } from '../../services/userService';

const mockGetTaskEvidence = vi.mocked(evidenceService.getTaskEvidence);
const mockGetCaseDetails = vi.mocked(caseService.getCaseDetails);
const mockGetCommentsByTask = vi.mocked(commentService.getCommentsByTask);
const mockGetTasksByCaseId = vi.mocked(taskService.getTasksByCaseId);
const mockGetUserDetailsById = vi.mocked(userService.getUserDetailsById);
const mockFormatUserName = vi.mocked(UserService.formatUserName);

describe('loadEvidence', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array when no evidence', async () => {
    mockGetTaskEvidence.mockResolvedValue({ evidence: [] } as any);
    const result = await loadEvidence(1);
    expect(result).toEqual([]);
  });

  it('groups evidence by ordered types', async () => {
    mockGetTaskEvidence.mockResolvedValue({
      evidence: [
        { evidenceType: 'SANCTIONS', id: 1 },
        { evidenceType: 'KYC', id: 2 },
        { evidenceType: 'KYC', id: 3 },
        { evidenceType: 'OTHER', id: 4 },
      ],
    } as any);

    const result = await loadEvidence(1);

    expect(result[0].type).toBe('KYC/EDD Report');
    expect(result[0].count).toBe(2);
    expect(result[0].description).toBe('documents');
    expect(result[1].type).toBe('Sanctions Screening');
    expect(result[1].count).toBe(1);
    expect(result[1].description).toBe('document');
    expect(result[2].type).toBe('Other supporting Documentation and Reference Materials');
  });

  it('includes all ordered types only when present', async () => {
    mockGetTaskEvidence.mockResolvedValue({
      evidence: [
        { evidenceType: 'ADVERSE_MEDIA', id: 1 },
        { evidenceType: 'SAR_STR_FILING', id: 2 },
      ],
    } as any);

    const result = await loadEvidence(1);
    expect(result.map(c => c.type)).toEqual([
      'Adverse Media Screening',
      'SAR/STR Filing Documentation',
    ]);
  });

  it('appends unknown types after ordered types', async () => {
    mockGetTaskEvidence.mockResolvedValue({
      evidence: [
        { evidenceType: 'KYC', id: 1 },
        { evidenceType: 'CUSTOM_TYPE', id: 2 },
      ],
    } as any);

    const result = await loadEvidence(1);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('KYC/EDD Report');
    expect(result[1].type).toBe('CUSTOM_TYPE');
  });

  it('uses plural description for multiple unknown type items', async () => {
    mockGetTaskEvidence.mockResolvedValue({
      evidence: [
        { evidenceType: 'CUSTOM', id: 1 },
        { evidenceType: 'CUSTOM', id: 2 },
      ],
    } as any);

    const result = await loadEvidence(1);
    expect(result[0].description).toBe('documents');
    expect(result[0].count).toBe(2);
  });

  it('assigns OTHER type when evidenceType is missing', async () => {
    mockGetTaskEvidence.mockResolvedValue({
      evidence: [{ id: 1 }],
    } as any);

    const result = await loadEvidence(1);
    expect(result[0].type).toBe('Other supporting Documentation and Reference Materials');
  });

  it('handles null evidence array', async () => {
    mockGetTaskEvidence.mockResolvedValue({ evidence: null } as any);
    const result = await loadEvidence(1);
    expect(result).toEqual([]);
  });
});

describe('fetchCasesAndEvidence', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns full data on success', async () => {
    const caseDetails = { id: 1, name: 'Case 1' };
    const tasks = [
      { task_id: 10, updated_at: '2024-01-01', assigned_user_id: 'u1', investigationNotes: 'notes', name: 'Investigate' },
      { task_id: 20, name: 'Approve Task' },
    ];
    const userDetails = { firstName: 'John', lastName: 'Doe' };
    const comments = [{ id: 1, text: 'comment' }];

    mockGetCaseDetails.mockResolvedValue(caseDetails as any);
    mockGetTasksByCaseId.mockResolvedValue(tasks as any);
    mockGetUserDetailsById.mockResolvedValue(userDetails as any);
    mockFormatUserName.mockReturnValue('John Doe');
    mockGetCommentsByTask.mockResolvedValue(comments as any);

    const result = await fetchCasesAndEvidence(1, 10);

    expect(result.caseDetails).toEqual(caseDetails);
    expect(result.investigatorName).toBe('John Doe');
    expect(result.submittedDate).toBe('formatted-2024-01-01');
    expect(result.investigationNotes).toBe('notes');
    expect(result.supervisorComments).toEqual(comments);
    expect(result.investigationTask).toEqual(tasks[0]);
  });

  it('returns defaults when investigation task not found', async () => {
    mockGetCaseDetails.mockResolvedValue({ id: 1 } as any);
    mockGetTasksByCaseId.mockResolvedValue([] as any);

    const result = await fetchCasesAndEvidence(1, 999);

    expect(result.investigatorName).toBe('N/A');
    expect(result.submittedDate).toBe('N/A');
    expect(result.investigationTask).toBeUndefined();
    expect(result.investigationNotes).toBe('');
    expect(result.supervisorComments).toEqual([]);
  });

  it('handles task without assigned_user_id', async () => {
    const tasks = [{ task_id: 10, updated_at: '2024-01-01', name: 'Investigate' }];
    mockGetCaseDetails.mockResolvedValue({ id: 1 } as any);
    mockGetTasksByCaseId.mockResolvedValue(tasks as any);

    const result = await fetchCasesAndEvidence(1, 10);

    expect(result.investigatorName).toBe('N/A');
    expect(mockGetUserDetailsById).not.toHaveBeenCalled();
  });

  it('handles null user details', async () => {
    const tasks = [{ task_id: 10, assigned_user_id: 'u1', name: 'Investigate' }];
    mockGetCaseDetails.mockResolvedValue({ id: 1 } as any);
    mockGetTasksByCaseId.mockResolvedValue(tasks as any);
    mockGetUserDetailsById.mockResolvedValue(null as any);

    const result = await fetchCasesAndEvidence(1, 10);

    expect(result.investigatorName).toBe('N/A');
  });

  it('handles no approval task', async () => {
    const tasks = [{ task_id: 10, name: 'Investigate' }];
    mockGetCaseDetails.mockResolvedValue({ id: 1 } as any);
    mockGetTasksByCaseId.mockResolvedValue(tasks as any);

    const result = await fetchCasesAndEvidence(1, 10);

    expect(result.supervisorComments).toEqual([]);
    expect(mockGetCommentsByTask).not.toHaveBeenCalled();
  });

  it('falls back to empty array when getCommentsByTask returns null', async () => {
    const tasks = [
      { task_id: 10, name: 'Investigate' },
      { task_id: 20, name: 'Approve Task' },
    ];
    mockGetCaseDetails.mockResolvedValue({ id: 1 } as any);
    mockGetTasksByCaseId.mockResolvedValue(tasks as any);
    mockGetCommentsByTask.mockResolvedValue(null as any);

    const result = await fetchCasesAndEvidence(1, 10);

    expect(result.supervisorComments).toEqual([]);
  });

  it('returns defaults on error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetCaseDetails.mockRejectedValue(new Error('fail'));

    const result = await fetchCasesAndEvidence(1, 10);

    expect(result.caseDetails).toBeNull();
    expect(result.investigatorName).toBe('N/A');
    expect(result.submittedDate).toBe('N/A');
    expect(consoleSpy).toHaveBeenCalledWith('Error fetching case and evidence:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('handles task without updated_at', async () => {
    const tasks = [{ task_id: 10, name: 'Investigate' }];
    mockGetCaseDetails.mockResolvedValue({ id: 1 } as any);
    mockGetTasksByCaseId.mockResolvedValue(tasks as any);

    const result = await fetchCasesAndEvidence(1, 10);
    expect(result.submittedDate).toBe('N/A');
  });

  it('handles task without investigationNotes', async () => {
    const tasks = [{ task_id: 10, name: 'Investigate', updated_at: '2024-01-01' }];
    mockGetCaseDetails.mockResolvedValue({ id: 1 } as any);
    mockGetTasksByCaseId.mockResolvedValue(tasks as any);

    const result = await fetchCasesAndEvidence(1, 10);
    expect(result.investigationNotes).toBe('');
  });
});
