import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadEvidence } from '../investigationUtils';
import { evidenceService } from '../../services/evidenceService';

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
    default: { getUserDetailsById: vi.fn(), formatUserName: vi.fn() },
}));

const mockGetEv = vi.mocked(evidenceService.getTaskEvidence);

describe('loadEvidence', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns empty categories when no evidence', async () => {
        mockGetEv.mockResolvedValueOnce({ evidence: [] } as any);

        const result = await loadEvidence(1);

        expect(result).toHaveLength(0);
    });

    it('groups evidence by type with display labels', async () => {
        mockGetEv.mockResolvedValueOnce({
            evidence: [
                { evidenceType: 'KYC', id: '1', name: 'doc.pdf' },
                { evidenceType: 'SANCTIONS', id: '2', name: 'screen.pdf' },
                { evidenceType: 'KYC', id: '3', name: 'doc2.pdf' },
            ],
        } as any);

        const result = await loadEvidence(1);

        expect(result).toHaveLength(2);
        const kycCategory = result.find((c) => c.type === 'KYC/EDD Report');
        expect(kycCategory?.count).toBe(2);
        const sanctionsCategory = result.find((c) => c.type === 'Sanctions Screening');
        expect(sanctionsCategory?.count).toBe(1);
    });

    it('assigns correct display labels for all known types', async () => {
        const types = ['KYC', 'SANCTIONS', 'ADVERSE_MEDIA', 'SAR_STR_FILING', 'OTHER'];
        const expectedLabels = [
            'KYC/EDD Report',
            'Sanctions Screening',
            'Adverse Media Screening',
            'SAR/STR Filing Documentation',
            'Other supporting Documentation and Reference Materials',
        ];

        mockGetEv.mockResolvedValueOnce({
            evidence: types.map((t, i) => ({ evidenceType: t, id: String(i), name: `${t}.pdf` })),
        } as any);

        const result = await loadEvidence(1);

        expect(result).toHaveLength(5);
        expectedLabels.forEach((label) => {
            expect(result.some((c) => c.type === label)).toBe(true);
        });
    });

    it('sets description to "document" for single item and "documents" for multiple', async () => {
        mockGetEv.mockResolvedValueOnce({
            evidence: [
                { evidenceType: 'KYC', id: '1', name: 'a.pdf' },
                { evidenceType: 'SANCTIONS', id: '2', name: 'b.pdf' },
                { evidenceType: 'SANCTIONS', id: '3', name: 'c.pdf' },
            ],
        } as any);

        const result = await loadEvidence(1);

        const kyc = result.find((c) => c.type === 'KYC/EDD Report');
        expect(kyc?.description).toBe('document');
        const sanctions = result.find((c) => c.type === 'Sanctions Screening');
        expect(sanctions?.description).toBe('documents');
    });

    it('handles unknown evidence types with type name as label', async () => {
        mockGetEv.mockResolvedValueOnce({
            evidence: [{ evidenceType: 'CUSTOM_TYPE', id: '1', name: 'x.pdf' }],
        } as any);

        const result = await loadEvidence(1);

        expect(result.some((c) => c.type === 'CUSTOM_TYPE')).toBe(true);
    });

    it('handles evidence with no evidenceType (defaults to OTHER)', async () => {
        mockGetEv.mockResolvedValueOnce({
            evidence: [{ id: '1', name: 'noType.pdf' }],
        } as any);

        const result = await loadEvidence(1);

        const other = result.find((c) => c.type === 'Other supporting Documentation and Reference Materials');
        expect(other).toBeTruthy();
    });

    it('handles null evidence array gracefully', async () => {
        mockGetEv.mockResolvedValueOnce({ evidence: null } as any);

        const result = await loadEvidence(1);

        expect(result).toHaveLength(0);
    });
});
