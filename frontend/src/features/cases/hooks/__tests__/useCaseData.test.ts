import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCaseData } from '../useCaseData';
import { caseService } from '../../services/caseService';
import { useAuth } from '../../../auth/components/AuthContext';

vi.mock('../../services/caseService');
vi.mock('../../../auth/components/AuthContext');

describe('useCaseData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as vi.Mock).mockReturnValue({
      hasInvestigatorRole: () => false,
      hasSupervisorRole: () => true,
      hasAdminRole: () => false,
    });
  });

  it('fetches cases for supervisor/admin', async () => {
    const mockResponse = {
      cases: [
        { id: 'CASE-1', status: 'IN_PROGRESS' },
        { id: 'CASE-2', status: 'CLOSED' },
      ],
    };
    (caseService.getAllCases as vi.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useCaseData());

    await act(async () => {
      await result.current.fetchCases();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(caseService.getAllCases).toHaveBeenCalled();
    expect(result.current.cases.length).toBeGreaterThan(0);
  });

  it('fetches cases for investigator only', async () => {
    (useAuth as vi.Mock).mockReturnValue({
      hasInvestigatorRole: () => true,
      hasSupervisorRole: () => false,
      hasAdminRole: () => false,
    });

    const mockResponse = {
      cases: [{ id: 'CASE-1', status: 'IN_PROGRESS' }],
    };
    (caseService.getUserAssignedCases as vi.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useCaseData());

    await act(async () => {
      await result.current.fetchCases();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(caseService.getUserAssignedCases).toHaveBeenCalled();
  });

  it('handles error when fetching cases fails', async () => {
    const error = new Error('Failed to fetch');
    (caseService.getAllCases as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useCaseData());

    await act(async () => {
      await result.current.fetchCases();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.errorState).toBeTruthy();
    });
  });
});

