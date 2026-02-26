import { describe, it, expect } from 'vitest';
import * as Reports from '../index';

describe('reports/index', () => {
  it('exports Reports page component', () => {
    expect(Reports.Reports).toBeDefined();
  });

  it('exports InvestigatorWorkloadReport', () => {
    expect(Reports.InvestigatorWorkloadReport).toBeDefined();
  });

  it('exports AuditLogsReport', () => {
    expect(Reports.AuditLogsReport).toBeDefined();
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

  it('exports useAuditLogs hook', () => {
    expect(Reports.useAuditLogs).toBeDefined();
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
