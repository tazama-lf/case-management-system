import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useInvestigatorSupervisorList } from '../useInvestigatorSupervisorList';
import userService from '../../services/userService';

vi.mock('../../services/userService', () => ({
    default: {
        getInvestigators: vi.fn().mockResolvedValue([]),
        getSupervisors: vi.fn().mockResolvedValue([]),
        getComplianceOfficers: vi.fn().mockResolvedValue([]),
    },
}));

const mockGetInvestigators = vi.mocked(userService.getInvestigators);
const mockGetSupervisors = vi.mocked(userService.getSupervisors);
const mockGetComplianceOfficers = vi.mocked(userService.getComplianceOfficers);

const mockInvestigators = [{ value: 'u1', label: 'Alice' }];
const mockSupervisors = [{ value: 'u2', label: 'Bob' }];
const mockCompliance = [{ value: 'u3', label: 'Carol' }];

// Hook auto-fetches all three lists on mount — always set up default empty mocks
const setupDefaultMocks = () => {
    mockGetInvestigators.mockResolvedValue([] as any);
    mockGetSupervisors.mockResolvedValue([] as any);
    mockGetComplianceOfficers.mockResolvedValue([] as any);
};

describe('useInvestigatorSupervisorList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    it('starts with empty lists after mount', async () => {
        setupDefaultMocks();
        const { result } = renderHook(() => useInvestigatorSupervisorList());

        await waitFor(() => expect(result.current.loadingInvestigators).toBe(false));

        expect(result.current.investigators).toHaveLength(0);
        expect(result.current.supervisors).toHaveLength(0);
    });

    it('fetchInvestigatorsList populates investigators from API', async () => {
        setupDefaultMocks();
        const { result } = renderHook(() => useInvestigatorSupervisorList());
        await waitFor(() => expect(result.current.loadingInvestigators).toBe(false));

        mockGetInvestigators.mockResolvedValueOnce(mockInvestigators as any);
        await act(() => result.current.fetchInvestigatorsList());

        expect(result.current.investigators).toHaveLength(1);
        expect(result.current.investigators[0].label).toBe('Alice');
    });

    it('reads investigators from sessionStorage cache on mount', async () => {
        sessionStorage.setItem('investigators', JSON.stringify(mockInvestigators));
        setupDefaultMocks();

        const { result } = renderHook(() => useInvestigatorSupervisorList());
        await waitFor(() => expect(result.current.loadingInvestigators).toBe(false));

        expect(result.current.investigators).toHaveLength(1);
    });

    it('fetchSupervisorsList populates supervisors from API', async () => {
        setupDefaultMocks();
        const { result } = renderHook(() => useInvestigatorSupervisorList());
        await waitFor(() => expect(result.current.loadingSupervisors).toBe(false));

        mockGetSupervisors.mockResolvedValueOnce(mockSupervisors as any);
        await act(() => result.current.fetchSupervisorsList());

        expect(result.current.supervisors).toHaveLength(1);
        expect(result.current.supervisors[0].label).toBe('Bob');
    });

    it('fetchComplianceOfficersList populates complianceOfficers from API', async () => {
        setupDefaultMocks();
        const { result } = renderHook(() => useInvestigatorSupervisorList());
        await waitFor(() => expect(result.current.loadingInvestigators).toBe(false));

        mockGetComplianceOfficers.mockResolvedValueOnce(mockCompliance as any);
        await act(() => result.current.fetchComplianceOfficersList());

        expect(result.current.complianceOfficers).toHaveLength(1);
    });

    it('sets empty array when API returns no investigators', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        setupDefaultMocks();
        const { result } = renderHook(() => useInvestigatorSupervisorList());
        await waitFor(() => expect(result.current.loadingInvestigators).toBe(false));

        mockGetInvestigators.mockResolvedValueOnce([] as any);
        await act(() => result.current.fetchInvestigatorsList());

        expect(result.current.investigators).toHaveLength(0);
        consoleSpy.mockRestore();
    });

    it('sets empty array and logs when fetch fails', async () => {
        setupDefaultMocks();
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const { result } = renderHook(() => useInvestigatorSupervisorList());
        await waitFor(() => expect(result.current.loadingInvestigators).toBe(false));

        mockGetInvestigators.mockRejectedValueOnce(new Error('Network error'));
        await act(() => result.current.fetchInvestigatorsList());

        expect(result.current.investigators).toHaveLength(0);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('clearCache removes sessionStorage and resets state', async () => {
        sessionStorage.setItem('investigators', JSON.stringify(mockInvestigators));
        sessionStorage.setItem('supervisors', JSON.stringify(mockSupervisors));
        setupDefaultMocks();

        const { result } = renderHook(() => useInvestigatorSupervisorList());
        await waitFor(() => expect(result.current.loadingInvestigators).toBe(false));

        act(() => result.current.clearCache());

        expect(sessionStorage.getItem('investigators')).toBeNull();
        expect(sessionStorage.getItem('supervisors')).toBeNull();
        expect(result.current.investigators).toHaveLength(0);
    });
});
