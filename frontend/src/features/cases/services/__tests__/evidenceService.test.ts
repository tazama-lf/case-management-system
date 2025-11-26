import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evidenceService } from '../evidenceService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient');

describe('EvidenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets case evidence', async () => {
    const mockEvidence = {
      evidence: [
        {
          id: 'EVIDENCE-1',
          fileName: 'test.pdf',
          evidenceType: 'DOCUMENT',
        },
      ],
      total: 1,
    };
    (apiClient.get as vi.Mock).mockResolvedValue(mockEvidence);

    const result = await evidenceService.getCaseEvidence('CASE-123');

    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/evidence/case/CASE-123');
    expect(result).toEqual(mockEvidence);
  });

  it('gets evidence by ID', async () => {
    const mockEvidence = {
      id: 'EVIDENCE-1',
      fileName: 'test.pdf',
    };
    (apiClient.get as vi.Mock).mockResolvedValue(mockEvidence);

    const result = await evidenceService.getEvidenceById('EVIDENCE-1');

    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/evidence/EVIDENCE-1');
    expect(result).toBeDefined();
  });

  it('uploads evidence', async () => {
    const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const mockResponse = {
      success: true,
      message: 'Upload successful',
      evidence: {
        id: 'EVIDENCE-1',
        fileName: 'test.pdf',
      },
    };
    (apiClient.upload as vi.Mock).mockResolvedValue(mockResponse);

    const result = await evidenceService.uploadEvidence({
      file: mockFile,
      taskId: 'TASK-1',
      evidenceType: 'DOCUMENT',
      description: 'Test evidence',
    });

    expect(apiClient.upload).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('handles errors when evidence operation fails', async () => {
    const error = new Error('Failed to get evidence');
    (apiClient.get as vi.Mock).mockRejectedValue(error);

    await expect(
      evidenceService.getEvidenceById('EVIDENCE-1'),
    ).rejects.toThrow();
  });
});

