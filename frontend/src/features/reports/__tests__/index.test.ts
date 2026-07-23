import { describe, it, expect, vi } from 'vitest';
import CryptoJS from 'crypto-js';

// Mock the crypto module entirely
vi.mock('@/shared/utils/crypto', () => {
  const mockKey = 'test-secret-key-123';

  return {
    encrypt: (data: unknown): string => {
      const stringified = JSON.stringify(data);
      return CryptoJS.AES.encrypt(stringified, mockKey).toString();
    },
    decrypt: (encryptedData: string): unknown => {
      const bytes = CryptoJS.AES.decrypt(encryptedData, mockKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedString) {
        throw new Error('Failed to decrypt data');
      }
      return JSON.parse(decryptedString) as unknown;
    },
  };
});

import * as Reports from '../index';

describe('reports/index', () => {
  it('exports Reports page component', () => {
    expect(Reports.Reports).toBeDefined();
  });

  it('exports InvestigatorWorkloadReport', () => {
    expect(Reports.InvestigatorWorkloadReport).toBeDefined();
  });

  it('exports CaseAgeingReport', () => {
    expect(Reports.CaseAgeingReport).toBeDefined();
  });

  it('exports ReportStatsCards component', () => {
    expect(Reports.ReportStatsCards).toBeDefined();
  });

  it('exports ReportFilters component', () => {
    expect(Reports.ReportFilters).toBeDefined();
  });

  it('exports FiltersPanel component', () => {
    expect(Reports.FiltersPanel).toBeDefined();
  });

  it('exports PieChart component', () => {
    expect(Reports.PieChart).toBeDefined();
  });

  it('exports BarChart component', () => {
    expect(Reports.BarChart).toBeDefined();
  });

  it('exports LineChart component', () => {
    expect(Reports.LineChart).toBeDefined();
  });

  it('exports ReportsTable component', () => {
    expect(Reports.ReportsTable).toBeDefined();
  });

  it('exports useReports hook', () => {
    expect(Reports.useReports).toBeDefined();
  });

  it('exports useCaseStatusStats hook', () => {
    expect(Reports.useCaseStatusStats).toBeDefined();
  });

  it('exports useInvestigatorWorkload hook', () => {
    expect(Reports.useInvestigatorWorkload).toBeDefined();
  });

  it('exports useTaskCompletion hook', () => {
    expect(Reports.useTaskCompletion).toBeDefined();
  });

  it('exports useCaseAgeing hook', () => {
    expect(Reports.useCaseAgeing).toBeDefined();
  });

  it('exports reportsService', () => {
    expect(Reports.reportsService).toBeDefined();
  });

  it('exports module correctly', () => {
    // TypeScript types don't exist at runtime, so we just verify the module is importable
    // and that value exports are defined
    expect(Reports).toBeDefined();
    expect(typeof Reports).toBe('object');

    // Verify that the module exports exist (components, hooks, services)
    expect(Reports.Reports).toBeDefined();
    expect(Reports.reportsService).toBeDefined();
    expect(Reports.useReports).toBeDefined();
  });
});
