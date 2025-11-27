import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  formatDataForExport,
  getColumnsForReport,
} from '../exportUtils';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import pdfMake from 'pdfmake/build/pdfmake';

vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: vi.fn((data) => ({ data })),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  write: vi.fn(() => new ArrayBuffer(0)),
}));

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

vi.mock('pdfmake/build/pdfmake', () => ({
  default: {
    createPdf: vi.fn(() => ({
      download: vi.fn(),
    })),
  },
}));

describe('exportUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exportToExcel', () => {
    it('exports data to Excel successfully', () => {
      const data = [{ id: 1, name: 'Test' }];
      exportToExcel(data, 'test-file', 'Sheet1');

      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(data);
      expect(XLSX.utils.book_new).toHaveBeenCalled();
      expect(XLSX.utils.book_append_sheet).toHaveBeenCalled();
      expect(XLSX.write).toHaveBeenCalled();
      expect(saveAs).toHaveBeenCalled();
    });

    it('throws error when data is empty', () => {
      expect(() => {
        try {
          exportToExcel([], 'test-file');
        } catch (error: any) {
          expect(error.message).toBe('No data to export');
          throw error;
        }
      }).toThrow('No data to export');
    });

    it('throws error when data is null', () => {
      expect(() => {
        try {
          exportToExcel(null as any, 'test-file');
        } catch (error: any) {
          expect(error.message).toBe('No data to export');
          throw error;
        }
      }).toThrow('No data to export');
    });
  });

  describe('exportToCSV', () => {
    it('exports data to CSV successfully', () => {
      const data = [{ id: 1, name: 'Test' }];
      exportToCSV(data, 'test-file');

      expect(saveAs).toHaveBeenCalled();
      const blob = (saveAs as vi.Mock).mock.calls[0][0];
      expect(blob).toBeInstanceOf(Blob);
    });

    it('handles values with commas and quotes', () => {
      const data = [{ name: 'Test, "Quote"' }];
      exportToCSV(data, 'test-file');

      expect(saveAs).toHaveBeenCalled();
    });

    it('throws error when data is empty', () => {
      expect(() => exportToCSV([], 'test-file')).toThrow('Failed to export to CSV');
    });
  });

  describe('exportToPDF', () => {
    it('exports data to PDF successfully', async () => {
      const data = [{ id: '1', name: 'Test' }];
      const columns = [
        { key: 'id', label: 'ID', width: 100 },
        { key: 'name', label: 'Name', width: 100 },
      ];

      await exportToPDF(data, 'test-file', 'Test Report', columns);

      expect(pdfMake.createPdf).toHaveBeenCalled();
    });

    it('throws error when data is empty', async () => {
      await expect(
        exportToPDF([], 'test-file', 'Test', []),
      ).rejects.toThrow('Failed to export to PDF');
    });
  });

  describe('formatDataForExport', () => {
    it('formats CASE_STATUS report', () => {
      const data = [
        {
          status: 'IN_PROGRESS',
          count: 10,
          percentage: '50%',
          avgTimeInStatus: '5 days',
          currentTrendPeriod: 'Up',
        },
      ];
      const formatted = formatDataForExport(data, 'CASE_STATUS');
      expect(formatted[0]).toHaveProperty('Status');
      expect(formatted[0]).toHaveProperty('Count');
      expect(formatted[0]).toHaveProperty('Percentage');
    });

    it('formats TASK_COMPLETION report', () => {
      const data = [
        {
          taskType: 'Investigation',
          total: 20,
          completed: 15,
          completionRate: 75,
          avgTime: 5,
          trend: 10,
        },
      ];
      const formatted = formatDataForExport(data, 'TASK_COMPLETION');
      expect(formatted[0]).toHaveProperty('Task Type');
      expect(formatted[0]).toHaveProperty('Total');
      expect(formatted[0]).toHaveProperty('Completion Rate');
    });

    it('formats AUDIT_LOGS report', () => {
      const data = [
        {
          audit_log_id: 'LOG-1',
          user_id: 'USER-1',
          operation: 'CREATE',
          entity_name: 'Case',
          action_performed: 'Created case',
          outcome: 'Success',
          performed_at: '2024-01-01',
        },
      ];
      const formatted = formatDataForExport(data, 'AUDIT_LOGS');
      expect(formatted[0]).toHaveProperty('Log ID');
      expect(formatted[0]).toHaveProperty('User ID');
      expect(formatted[0]).toHaveProperty('Operation');
    });

    it('formats CASE_AGEING report', () => {
      const data = [
        {
          caseId: 'CASE-1',
          type: 'FRAUD',
          status: 'IN_PROGRESS',
          createdDate: '2024-01-01',
          ageDays: 30,
          priority: 'HIGH',
          userId: 'USER-1',
          investigator: 'John Doe',
        },
      ];
      const formatted = formatDataForExport(data, 'CASE_AGEING');
      expect(formatted[0]).toHaveProperty('Case ID');
      expect(formatted[0]).toHaveProperty('Age (Days)');
    });

    it('formats INVESTIGATOR_WORKLOAD report', () => {
      const data = [
        {
          investigatorId: 'INV-1',
          investigator: 'John Doe',
          role: 'Investigator',
          activeCases: 10,
          completedCases: 20,
          avgResolutionTime: 5,
          caseClosureRate: 80,
          performanceTrend: 'Up',
        },
      ];
      const formatted = formatDataForExport(data, 'INVESTIGATOR_WORKLOAD');
      expect(formatted[0]).toHaveProperty('Investigator ID');
      expect(formatted[0]).toHaveProperty('Active Cases');
    });

    it('formats generic data correctly', () => {
      const data = [{ id: 1, name: 'A', caseId: 'CASE-1' }];
      const formatted = formatDataForExport(data, 'UNKNOWN');
      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted[0]).toHaveProperty('id');
      expect(formatted[0]).toHaveProperty('name');
      expect(typeof formatted[0].id).toBe('string');
    });
  });

  describe('getColumnsForReport', () => {
    it('returns columns for CASE_STATUS', () => {
      const cols = getColumnsForReport('CASE_STATUS');
      expect(Array.isArray(cols)).toBe(true);
      expect(cols.length).toBeGreaterThan(0);
      expect(cols[0]).toHaveProperty('key');
      expect(cols[0]).toHaveProperty('label');
      expect(cols[0]).toHaveProperty('width');
    });

    it('returns columns for TASK_COMPLETION', () => {
      const cols = getColumnsForReport('TASK_COMPLETION');
      expect(cols.length).toBeGreaterThan(0);
      expect(cols[0].key).toBe('Task Type');
    });

    it('returns columns for AUDIT_LOGS', () => {
      const cols = getColumnsForReport('AUDIT_LOGS');
      expect(cols.length).toBeGreaterThan(0);
    });

    it('returns columns for CASE_AGEING', () => {
      const cols = getColumnsForReport('CASE_AGEING');
      expect(cols.length).toBeGreaterThan(0);
    });

    it('returns columns for INVESTIGATOR_WORKLOAD', () => {
      const cols = getColumnsForReport('INVESTIGATOR_WORKLOAD');
      expect(cols.length).toBeGreaterThan(0);
    });

    it('returns empty array for unknown report type', () => {
      const cols = getColumnsForReport('UNKNOWN');
      expect(cols).toEqual([]);
    });
  });
});
