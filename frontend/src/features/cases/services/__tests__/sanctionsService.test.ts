import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as sanctionsService from '../sanctionsService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient');

// Mock document methods
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockClick = vi.fn();

beforeEach(() => {
  const mockLink = {
    href: '',
    download: '',
    click: mockClick,
  };

  global.document.createElement = vi.fn(() => mockLink) as any;

  // Properly mock document.body
  Object.defineProperty(global.document, 'body', {
    value: {
      appendChild: mockAppendChild,
      removeChild: mockRemoveChild,
    },
    writable: true,
    configurable: true,
  });
});

describe('sanctionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCaseSanctionsScreenings', () => {
    it('gets case sanctions screenings', async () => {
      const mockScreenings = {
        screenings: [
          {
            screening_id: 'SCREENING-1',
            case_id: 'CASE-123',
            status: 'PENDING',
          },
        ],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockScreenings);

      const result =
        await sanctionsService.getCaseSanctionsScreenings('CASE-123');

      expect(apiClient.get).toHaveBeenCalled();
      expect(result).toEqual(mockScreenings);
    });

    it('gets case sanctions screenings with filters', async () => {
      const mockScreenings = {
        screenings: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockScreenings);

      await sanctionsService.getCaseSanctionsScreenings('CASE-123', {
        disposition: 'PENDING_REVIEW',
        tool_source: 'OFAC',
        search: 'test',
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('disposition=PENDING_REVIEW'),
      );
    });
  });

  describe('getSanctionsScreening', () => {
    it('gets sanctions screening by ID', async () => {
      const mockScreening = {
        screening_id: 'SCREENING-1',
        case_id: 'CASE-123',
        status: 'PENDING',
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockScreening);

      const result =
        await sanctionsService.getSanctionsScreening('SCREENING-1');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/sanctions-screenings/SCREENING-1',
      );
      expect(result).toEqual(mockScreening);
    });
  });

  describe('createSanctionsScreening', () => {
    it('creates sanctions screening with file', async () => {
      const mockFile = new File(['test'], 'test.pdf', {
        type: 'application/pdf',
      });
      const mockResponse = {
        screening: {
          screening_id: 'SCREENING-1',
          case_id: 'CASE-123',
        },
      };
      (apiClient.post as vi.Mock).mockResolvedValue(mockResponse);

      const result = await sanctionsService.createSanctionsScreening({
        case_id: 'CASE-123',
        screening_date: '2024-01-01',
        tool_source: 'OFAC',
        disposition: 'CLEAR',
        summary: 'Test screening',
        file: mockFile,
      });

      expect(apiClient.post).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('creates sanctions screening without file', async () => {
      const mockResponse = {
        screening: {
          screening_id: 'SCREENING-1',
          case_id: 'CASE-123',
        },
      };
      (apiClient.post as vi.Mock).mockResolvedValue(mockResponse);

      await sanctionsService.createSanctionsScreening({
        case_id: 'CASE-123',
        screening_date: '2024-01-01',
        tool_source: 'OFAC',
        disposition: 'CLEAR',
        summary: 'Test screening',
      });

      expect(apiClient.post).toHaveBeenCalled();
    });

    it('creates sanctions screening with optional fields', async () => {
      const mockResponse = {
        screening: {
          screening_id: 'SCREENING-1',
          case_id: 'CASE-123',
        },
      };
      (apiClient.post as vi.Mock).mockResolvedValue(mockResponse);

      await sanctionsService.createSanctionsScreening({
        case_id: 'CASE-123',
        task_id: 'TASK-1',
        screening_date: '2024-01-01',
        tool_source: 'OFAC',
        disposition: 'CLEAR',
        summary: 'Test screening',
        reference_id: 'REF-123',
        match_count: 5,
        metadata: { key: 'value' },
      });

      expect(apiClient.post).toHaveBeenCalled();
    });
  });

  describe('updateSanctionsScreening', () => {
    it('updates sanctions screening', async () => {
      const mockResponse = {
        screening: {
          screening_id: 'SCREENING-1',
          disposition: 'CLEARED',
        },
      };
      (apiClient.patch as vi.Mock).mockResolvedValue(mockResponse);

      const result = await sanctionsService.updateSanctionsScreening({
        screening_id: 'SCREENING-1',
        disposition: 'CLEARED',
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/sanctions-screenings/SCREENING-1',
        { disposition: 'CLEARED' },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteSanctionsScreening', () => {
    it('deletes sanctions screening', async () => {
      const mockResponse = {
        screening_id: 'SCREENING-1',
        success: true,
      };
      (apiClient.delete as vi.Mock).mockResolvedValue(mockResponse);

      const result =
        await sanctionsService.deleteSanctionsScreening('SCREENING-1');

      expect(apiClient.delete).toHaveBeenCalledWith(
        '/api/v1/sanctions-screenings/SCREENING-1',
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('downloadSanctionsReport', () => {
    it('downloads sanctions report', async () => {
      const mockResponse = {
        url: 'http://example.com/report.pdf',
        file_name: 'report.pdf',
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockResponse);

      const result =
        await sanctionsService.downloadSanctionsReport('SCREENING-1');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/sanctions-screenings/SCREENING-1/download',
      );
      expect(mockClick).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getSanctionsScreeningAuditLogs', () => {
    it('gets audit logs', async () => {
      const mockLogs = [
        {
          log_id: 'LOG-1',
          screening_id: 'SCREENING-1',
          action: 'CREATE',
          user_id: 'user-1',
          timestamp: new Date(),
        },
      ];
      (apiClient.get as vi.Mock).mockResolvedValue(mockLogs);

      const result =
        await sanctionsService.getSanctionsScreeningAuditLogs('SCREENING-1');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/sanctions-screenings/SCREENING-1/audit-logs',
      );
      expect(result).toEqual(mockLogs);
    });
  });

  describe('getCaseSanctionsStatistics', () => {
    it('gets case sanctions statistics', async () => {
      const mockStats = {
        total_screenings: 10,
        high_risk_count: 2,
        pending_review_count: 3,
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockStats);

      const result =
        await sanctionsService.getCaseSanctionsStatistics('CASE-123');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/sanctions-screenings/case/CASE-123/statistics',
      );
      expect(result).toEqual(mockStats);
    });
  });

  describe('searchSanctionsScreenings', () => {
    it('searches sanctions screenings', async () => {
      const mockResponse = {
        screenings: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockResponse);

      const result = await sanctionsService.searchSanctionsScreenings(
        { disposition: 'PENDING_REVIEW' },
        1,
        20,
      );

      expect(apiClient.get).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('searches with all filter options', async () => {
      const mockResponse = {
        screenings: [],
        pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockResponse);

      await sanctionsService.searchSanctionsScreenings(
        {
          case_id: 'CASE-123',
          task_id: 'TASK-1',
          disposition: 'PENDING_REVIEW',
          tool_source: 'OFAC',
          date_from: '2024-01-01',
          date_to: '2024-12-31',
          investigator_id: 'user-1',
          search: 'test',
        },
        2,
        10,
      );

      expect(apiClient.get).toHaveBeenCalled();
    });
  });

  describe('validateScreeningFile', () => {
    it('validates file within size limit', () => {
      const mockFile = new File(['test'], 'test.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(mockFile, 'size', { value: 10 * 1024 * 1024 }); // 10MB

      const result = sanctionsService.validateScreeningFile(mockFile);

      expect(result.valid).toBe(true);
    });

    it('rejects file exceeding size limit', () => {
      const mockFile = new File(['test'], 'test.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(mockFile, 'size', { value: 60 * 1024 * 1024 }); // 60MB

      const result = sanctionsService.validateScreeningFile(mockFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds');
    });

    it('validates allowed file types', () => {
      const mockFile = new File(['test'], 'test.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(mockFile, 'size', { value: 1024 });

      const result = sanctionsService.validateScreeningFile(mockFile);

      expect(result.valid).toBe(true);
    });

    it('rejects disallowed file types', () => {
      const mockFile = new File(['test'], 'test.exe', {
        type: 'application/x-msdownload',
      });
      Object.defineProperty(mockFile, 'size', { value: 1024 });

      const result = sanctionsService.validateScreeningFile(mockFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });
  });

  describe('formatFileSize', () => {
    it('formats file size in bytes', () => {
      const result = sanctionsService.formatFileSize(0);
      expect(result).toBe('0 Bytes');
    });

    it('formats file size in KB', () => {
      const result = sanctionsService.formatFileSize(1024);
      expect(result).toContain('KB');
    });

    it('formats file size in MB', () => {
      const result = sanctionsService.formatFileSize(1024 * 1024);
      expect(result).toContain('MB');
    });
  });

  describe('getDispositionColor', () => {
    it('returns color for known dispositions', () => {
      expect(sanctionsService.getDispositionColor('CLEARED')).toBe('green');
      expect(sanctionsService.getDispositionColor('POSITIVE_MATCH')).toBe(
        'red',
      );
      expect(sanctionsService.getDispositionColor('PENDING_REVIEW')).toBe(
        'blue',
      );
    });

    it('returns gray for unknown disposition', () => {
      expect(sanctionsService.getDispositionColor('UNKNOWN')).toBe('gray');
    });
  });

  describe('getRiskLevelColor', () => {
    it('returns color for known risk levels', () => {
      expect(sanctionsService.getRiskLevelColor('LOW')).toBe('green');
      expect(sanctionsService.getRiskLevelColor('MEDIUM')).toBe('yellow');
      expect(sanctionsService.getRiskLevelColor('HIGH')).toBe('orange');
      expect(sanctionsService.getRiskLevelColor('CRITICAL')).toBe('red');
    });

    it('returns gray for unknown risk level', () => {
      expect(sanctionsService.getRiskLevelColor('UNKNOWN')).toBe('gray');
    });
  });

  describe('error handling', () => {
    it('handles errors when sanctions operation fails', async () => {
      const error = new Error('Failed to get screening');
      (apiClient.get as vi.Mock).mockRejectedValue(error);

      await expect(
        sanctionsService.getSanctionsScreening('SCREENING-1'),
      ).rejects.toThrow();
    });
  });
});
