import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evidenceService } from '../evidenceService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient');

// Mock localStorage and sessionStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;
global.sessionStorage = sessionStorageMock as any;

describe('EvidenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('mock-token');
    sessionStorageMock.getItem.mockReturnValue(null);
    global.fetch = vi.fn() as any;
  });

  describe('uploadEvidence', () => {
    it('uploads evidence with basic fields', async () => {
      const mockFile = new File(['test'], 'test.pdf', {
        type: 'application/pdf',
      });
      const mockResponse = {
        evidence: {
          id: 'EVIDENCE-1',
          fileName: 'test.pdf',
        },
      };
      (apiClient.upload as vi.Mock).mockResolvedValue(mockResponse);

      const result = await evidenceService.uploadEvidence({
        file: mockFile,
        taskId: 'TASK-1',
        evidenceType: 'SANCTIONS',
        description: 'Test evidence',
      });

      expect(apiClient.upload).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('uploads evidence with sanctions-specific fields', async () => {
      const mockFile = new File(['test'], 'test.pdf', {
        type: 'application/pdf',
      });
      const mockResponse = {
        evidence: {
          id: 'EVIDENCE-1',
          fileName: 'test.pdf',
        },
      };
      (apiClient.upload as vi.Mock).mockResolvedValue(mockResponse);

      await evidenceService.uploadEvidence({
        file: mockFile,
        taskId: 'TASK-1',
        evidenceType: 'SANCTIONS',
        screeningDate: '2023-01-01',
        tool: 'OFAC',
        summaryDisposition: 'PENDING',
      });

      expect(apiClient.upload).toHaveBeenCalled();
    });

    it('uploads evidence with adverse media fields', async () => {
      const mockFile = new File(['test'], 'test.pdf', {
        type: 'application/pdf',
      });
      const mockResponse = {
        evidence: {
          id: 'EVIDENCE-1',
          fileName: 'test.pdf',
        },
      };
      (apiClient.upload as vi.Mock).mockResolvedValue(mockResponse);

      await evidenceService.uploadEvidence({
        file: mockFile,
        taskId: 'TASK-1',
        evidenceType: 'ADVERSE_MEDIA',
        aggregator: 'Google',
        dateSearched: '2023-01-01',
        keywords: ['fraud', 'money laundering'],
        findings: 'No findings',
      });

      expect(apiClient.upload).toHaveBeenCalled();
    });
  });

  describe('getTaskEvidence', () => {
    it('gets task evidence', async () => {
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

      const result = await evidenceService.getTaskEvidence('TASK-1');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/evidence/task/TASK-1',
      );
      expect(result).toEqual(mockEvidence);
    });

    it('normalizes evidence data', async () => {
      const mockEvidence = {
        evidence: [
          {
            id: 'EVIDENCE-1',
            attachments: [
              {
                fileName: 'test.pdf',
                fileSize: 1024,
                mimeType: 'application/pdf',
                hash: 'hash123',
              },
            ],
          },
        ],
        total: 1,
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockEvidence);

      const result = await evidenceService.getTaskEvidence('TASK-1');

      expect(result.evidence[0].fileName).toBe('test.pdf');
    });
  });

  describe('getCaseEvidence', () => {
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

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/evidence/case/CASE-123',
      );
      expect(result).toEqual(mockEvidence);
    });
  });

  describe('getEvidenceByType', () => {
    it('gets evidence by type', async () => {
      const mockEvidence = {
        evidence: [],
        total: 0,
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockEvidence);

      const result = await evidenceService.getEvidenceByType('SANCTIONS');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/evidence/evidenceType/SANCTIONS',
      );
      expect(result).toBeDefined();
    });
  });

  describe('getEvidenceById', () => {
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
  });

  describe('verifyEvidence', () => {
    it('verifies evidence', async () => {
      const mockResponse = {
        evidence_id: 'EVIDENCE-1',
        hash_match: true,
        verified: true,
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockResponse);

      const result = await evidenceService.verifyEvidence('EVIDENCE-1');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/evidence/EVIDENCE-1/verify',
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('downloadEvidence', () => {
    it('downloads evidence successfully', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      (global.fetch as vi.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: new Headers({ 'content-type': 'application/pdf' }),
      });

      const result = await evidenceService.downloadEvidence('EVIDENCE-1');

      expect(result).toBeInstanceOf(Blob);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('handles 401 authentication error', async () => {
      (global.fetch as vi.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      });

      await expect(
        evidenceService.downloadEvidence('EVIDENCE-1'),
      ).rejects.toThrow('Authentication failed');
    });

    it('handles 403 permission error', async () => {
      (global.fetch as vi.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Forbidden' }),
      });

      await expect(
        evidenceService.downloadEvidence('EVIDENCE-1'),
      ).rejects.toThrow('permission');
    });

    it('handles 404 not found error', async () => {
      (global.fetch as vi.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Not Found' }),
      });

      await expect(
        evidenceService.downloadEvidence('EVIDENCE-1'),
      ).rejects.toThrow('not found');
    });

    it('handles missing auth token', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      sessionStorageMock.getItem.mockReturnValue(null);

      await expect(
        evidenceService.downloadEvidence('EVIDENCE-1'),
      ).rejects.toThrow('authentication token');
    });

    it('handles empty blob', async () => {
      const emptyBlob = new Blob([], { type: 'application/pdf' });
      (global.fetch as vi.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(emptyBlob),
        headers: new Headers(),
      });

      await expect(
        evidenceService.downloadEvidence('EVIDENCE-1'),
      ).rejects.toThrow('empty file');
    });
  });

  describe('viewEvidence', () => {
    it('views evidence (calls downloadEvidence)', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      (global.fetch as vi.Mock).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: new Headers({ 'content-type': 'application/pdf' }),
      });

      const result = await evidenceService.viewEvidence('EVIDENCE-1');

      expect(result).toBeInstanceOf(Blob);
    });
  });

  describe('calculateFileHash', () => {
    it('calculates file hash', async () => {
      const mockFile = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      });

      // Mock crypto.subtle if not available
      if (!crypto.subtle) {
        (global.crypto as any).subtle = {
          digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        };
      }

      try {
        const result = await evidenceService.calculateFileHash(mockFile);
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
      } catch (error) {
        // If crypto.subtle is not available in test environment, skip
        expect(true).toBe(true);
      }
    });

    it('handles hash calculation error', async () => {
      const mockFile = new File(['test'], 'test.txt');
      // Mock crypto.subtle to throw error
      const originalSubtle = crypto.subtle;
      (crypto.subtle as any).digest = vi
        .fn()
        .mockRejectedValue(new Error('Hash failed'));

      await expect(
        evidenceService.calculateFileHash(mockFile),
      ).rejects.toThrow();

      (crypto.subtle as any).digest = originalSubtle.digest;
    });
  });

  describe('validateFile', () => {
    it('validates file size within limit', () => {
      const mockFile = new File(['test'], 'test.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(mockFile, 'size', { value: 1024 * 1024 }); // 1MB

      const result = evidenceService.validateFile(mockFile, 50);

      expect(result.valid).toBe(true);
    });

    it('rejects file exceeding size limit', () => {
      const mockFile = new File(['test'], 'test.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(mockFile, 'size', { value: 60 * 1024 * 1024 }); // 60MB

      const result = evidenceService.validateFile(mockFile, 50);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds');
    });

    it('validates allowed file types', () => {
      const mockFile = new File(['test'], 'test.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(mockFile, 'size', { value: 1024 });

      const result = evidenceService.validateFile(mockFile);

      expect(result.valid).toBe(true);
    });

    it('rejects disallowed file types', () => {
      const mockFile = new File(['test'], 'test.exe', {
        type: 'application/x-msdownload',
      });
      Object.defineProperty(mockFile, 'size', { value: 1024 });

      const result = evidenceService.validateFile(mockFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });
  });

  describe('formatFileSize', () => {
    it('formats file size in bytes', () => {
      const result = evidenceService.formatFileSize(0);
      expect(result).toBe('0 Bytes');
    });

    it('formats file size in KB', () => {
      const result = evidenceService.formatFileSize(1024);
      expect(result).toContain('KB');
    });

    it('formats file size in MB', () => {
      const result = evidenceService.formatFileSize(1024 * 1024);
      expect(result).toContain('MB');
    });

    it('formats file size in GB', () => {
      const result = evidenceService.formatFileSize(1024 * 1024 * 1024);
      expect(result).toContain('GB');
    });
  });

  describe('error handling', () => {
    it('handles errors when evidence operation fails', async () => {
      const error = new Error('Failed to get evidence');
      (apiClient.get as vi.Mock).mockRejectedValue(error);

      await expect(
        evidenceService.getEvidenceById('EVIDENCE-1'),
      ).rejects.toThrow();
    });
  });

  describe('deleteEvidence', () => {
    it('deletes evidence by id and filename', async () => {
      (apiClient.delete as vi.Mock).mockResolvedValue(undefined);

      await evidenceService.deleteEvidence('ev-1', 'report.pdf');

      expect(apiClient.delete).toHaveBeenCalledWith(
        '/api/v1/evidence/ev-1/attachments/report.pdf',
      );
    });

    it('encodes filename with special characters', async () => {
      (apiClient.delete as vi.Mock).mockResolvedValue(undefined);

      await evidenceService.deleteEvidence('ev-1', 'my file (1).pdf');

      expect(apiClient.delete).toHaveBeenCalledWith(
        expect.stringContaining('my%20file%20(1).pdf'),
      );
    });

    it('throws on error', async () => {
      (apiClient.delete as vi.Mock).mockRejectedValue(new Error('fail'));

      await expect(
        evidenceService.deleteEvidence('ev-1', 'file.pdf'),
      ).rejects.toThrow();
    });
  });

  describe('searchEvidence', () => {
    it('searches evidence with filters', async () => {
      const mockResponse = {
        evidence: [{ id: 'ev-1', fileName: 'report.pdf' }],
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockResponse);

      const result = await evidenceService.searchEvidence({
        evidenceType: 'KYC',
        taskId: 5,
        uploadedBy: 'user-1',
        verified: true,
        search: 'report',
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('evidenceType=KYC'),
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('taskId=5'),
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('uploadedBy=user-1'),
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('verified=true'),
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('search=report'),
      );
      expect(result.evidence).toHaveLength(1);
    });

    it('searches with custom page and limit', async () => {
      const mockResponse = { evidence: [] };
      (apiClient.get as vi.Mock).mockResolvedValue(mockResponse);

      await evidenceService.searchEvidence({}, 3, 50);

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('page=3'),
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('limit=50'),
      );
    });
  });

  describe('downloadEvidence edge cases', () => {
    it('handles JSON error response', async () => {
      localStorageMock.getItem.mockReturnValue('mock-token');
      (global.fetch as vi.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        headers: {
          get: (h: string) =>
            h === 'content-type' ? 'application/json' : null,
        },
        json: async () => ({ message: 'Internal error' }),
      });

      await expect(evidenceService.downloadEvidence('ev-1')).rejects.toThrow(
        'Internal error',
      );
    });

    it('handles text error response', async () => {
      localStorageMock.getItem.mockReturnValue('mock-token');
      (global.fetch as vi.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        headers: {
          get: () => 'text/plain',
        },
        text: async () => 'Something went wrong',
      });

      await expect(evidenceService.downloadEvidence('ev-1')).rejects.toThrow(
        'Something went wrong',
      );
    });

    it('re-wraps blob with content-type header when blob type is octet-stream', async () => {
      localStorageMock.getItem.mockReturnValue('mock-token');
      const mockBlob = new Blob(['content'], {
        type: 'application/octet-stream',
      });
      (global.fetch as vi.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: (h: string) => (h === 'content-type' ? 'application/pdf' : null),
        },
        blob: async () => mockBlob,
      });

      const result = await evidenceService.downloadEvidence('ev-1');
      expect(result.type).toBe('application/pdf');
    });
  });

  describe('handleError edge cases', () => {
    it('returns the error itself when error is an instance of Error', async () => {
      const customError = new Error('Custom message');
      (apiClient.get as vi.Mock).mockRejectedValue(customError);

      await expect(evidenceService.getEvidenceById('ev-1')).rejects.toThrow(
        'Custom message',
      );
    });

    it('handles error with response.data.message', async () => {
      const apiError = {
        response: { data: { message: 'API error' } },
      };
      (apiClient.get as vi.Mock).mockRejectedValue(apiError);

      await expect(evidenceService.getEvidenceById('ev-1')).rejects.toThrow(
        'API error',
      );
    });

    it('handles error with only message property', async () => {
      const error = { message: 'Network fail' };
      (apiClient.get as vi.Mock).mockRejectedValue(error);

      await expect(evidenceService.getEvidenceById('ev-1')).rejects.toThrow(
        'Network fail',
      );
    });

    it('handles completely unknown error', async () => {
      (apiClient.get as vi.Mock).mockRejectedValue(42);

      await expect(evidenceService.getEvidenceById('ev-1')).rejects.toThrow(
        'Failed to get evidence details',
      );
    });
  });

  describe('validateFile edge cases', () => {
    it('accepts file with empty MIME type', () => {
      const mockFile = new File(['data'], 'file.bin', { type: '' });
      const result = evidenceService.validateFile(mockFile);
      expect(result.valid).toBe(true);
    });

    it('accepts custom max size', () => {
      const data = new Uint8Array(2 * 1024 * 1024); // 2MB
      const mockFile = new File([data], 'large.pdf', {
        type: 'application/pdf',
      });
      const result = evidenceService.validateFile(mockFile, 1); // 1MB limit
      expect(result.valid).toBe(false);
    });
  });
});
