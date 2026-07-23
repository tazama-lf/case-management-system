import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import CaseStatusReport from '../CaseStatusReport';
import { useReports } from '@/features/reports/hooks/useReports';

import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  formatDataForExport,
  getColumnsForReport,
} from '@/shared/utils/exportUtils';

vi.mock('@/features/reports/hooks/useReports', () => ({
  useReports: vi.fn(),
}));

vi.mock('@/shared/utils/exportUtils', () => ({
  exportToExcel: vi.fn(),
  exportToCSV: vi.fn(),
  exportToPDF: vi.fn(),
  formatDataForExport: vi.fn((data) => data),
  getColumnsForReport: vi.fn(() => ['column1', 'column2']),
}));

vi.mock('@/shared/components/ui', () => ({
  PageContainer: ({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}));

vi.mock('@/features/reports/components/ReportStatsCards', () => ({
  default: () => <div>Report Stats Cards</div>,
}));

vi.mock('@/features/reports/components/ReportFilters', () => ({
  default: (props: any) => (
    <div>
      <button onClick={() => props.onChangeReportType('CASE_AGEING')}>
        Change Report Type
      </button>
    </div>
  ),
}));

vi.mock('@/features/reports/components/ReportsTable', () => ({
  default: (props: any) => (
    <div>
      <div>Reports Table</div>

      <button onClick={props.onExportExcel}>Export Excel</button>

      <button onClick={props.onExportCSV}>Export CSV</button>

      <button onClick={props.onExportPDF}>Export PDF</button>
    </div>
  ),
}));

vi.mock('@/features/reports/components/PieChart', () => ({
  default: () => <div>Pie Chart</div>,
}));

vi.mock('@/features/reports/components/BarChart', () => ({
  default: () => <div>Bar Chart</div>,
}));

vi.mock('@/features/reports/components/MultiBarChart', () => ({
  default: () => <div>Multi Bar Chart</div>,
}));

vi.mock('./InvestigatorWorkloadReport', () => ({
  default: () => <div>Investigator Workload Report</div>,
}));

vi.mock('./CaseAgeingReport', () => ({
  default: () => <div>Case Ageing Report</div>,
}));

vi.mock('./EvidenceFindingsReport', () => ({
  default: () => <div>Evidence Findings Report</div>,
}));

describe('Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders loading state', () => {
    vi.mocked(useReports).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as any);

    render(<CaseStatusReport />);

    expect(screen.getByText('Reports Dashboard')).toBeInTheDocument();
  });

  it('renders error state', () => {
    vi.mocked(useReports).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed'),
    } as any);

    render(<CaseStatusReport />);

    expect(
      screen.getByText('Failed to load reports data. Please try again.'),
    ).toBeInTheDocument();
  });

  it('renders reports dashboard successfully', async () => {
    vi.mocked(useReports).mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        stats: {
          totalCases: 10,
          closedCases: 5,
          openCases: 5,
          avgResolutionTime: 7,
        },
        statusDistribution: {
          assigned: 1,
          inProgress: 2,
          draft: 1,
          suspended: 1,
          pendingApproval: 1,
          closed: 4,
        },
        caseTypes: [
          {
            name: 'Fraud',
            count: 5,
          },
        ],
        outcomes: {
          resolved: 2,
          confirmed: 3,
          inconclusive: 1,
          pending: 4,
        },
        monthlyTrend: [
          {
            month: 'Jan',
            casesCreated: 10,
            casesClosed: 8,
          },
        ],
        statusDetails: [
          {
            id: 1,
            name: 'Case 1',
          },
        ],
      },
    } as any);

    render(<CaseStatusReport />);

    await waitFor(() => {
      expect(screen.getByText('Case Status Report')).toBeInTheDocument();
    });

    expect(screen.getByText('Report Stats Cards')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Pie Chart').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('Bar Chart')).toBeInTheDocument();

    expect(screen.getByText('Multi Bar Chart')).toBeInTheDocument();

    expect(screen.getByText('Reports Table')).toBeInTheDocument();
  });

  it('exports excel successfully', () => {
    vi.mocked(useReports).mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        stats: {},
        statusDistribution: {},
        caseTypes: [],
        outcomes: {},
        monthlyTrend: [],
        statusDetails: [],
      },
    } as any);

    render(<CaseStatusReport />);

    fireEvent.click(screen.getByText('Export Excel'));

    expect(formatDataForExport).toHaveBeenCalled();
    expect(exportToExcel).toHaveBeenCalled();
  });

  it('exports csv successfully', () => {
    vi.mocked(useReports).mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        stats: {},
        statusDistribution: {},
        caseTypes: [],
        outcomes: {},
        monthlyTrend: [],
        statusDetails: [],
      },
    } as any);

    render(<CaseStatusReport />);

    fireEvent.click(screen.getByText('Export CSV'));

    expect(formatDataForExport).toHaveBeenCalled();
    expect(exportToCSV).toHaveBeenCalled();
  });

  it('exports pdf successfully', () => {
    vi.mocked(useReports).mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        stats: {},
        statusDistribution: {},
        caseTypes: [],
        outcomes: {},
        monthlyTrend: [],
        statusDetails: [],
      },
    } as any);

    render(<CaseStatusReport />);

    fireEvent.click(screen.getByText('Export PDF'));

    expect(formatDataForExport).toHaveBeenCalled();
    expect(getColumnsForReport).toHaveBeenCalled();
    expect(exportToPDF).toHaveBeenCalled();
  });

  it('changes report type correctly', async () => {
    vi.mocked(useReports).mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        stats: {},
        statusDistribution: {},
        caseTypes: [],
        outcomes: {},
        monthlyTrend: [],
        statusDetails: [],
      },
    } as any);

    render(<CaseStatusReport />);

    fireEvent.click(screen.getByText('Change Report Type'));

    await waitFor(() => {
      expect(screen.getByText('Case Ageing Report')).toBeInTheDocument();
    });
  });

  it('handles missing reports data safely', () => {
    vi.mocked(useReports).mockReturnValue({
      isLoading: false,
      error: null,
      data: null,
    } as any);

    render(<CaseStatusReport />);

    expect(screen.getByText('Case Status Report')).toBeInTheDocument();
  });

  it('handles export errors gracefully', () => {
    vi.stubGlobal('alert', vi.fn());

    vi.mocked(exportToExcel).mockImplementation(() => {
      throw new Error('Export failed');
    });

    vi.mocked(useReports).mockReturnValue({
      isLoading: false,
      error: null,
      data: {
        stats: {},
        statusDistribution: {},
        caseTypes: [],
        outcomes: {},
        monthlyTrend: [],
        statusDetails: [],
      },
    } as any);

    render(<CaseStatusReport />);

    fireEvent.click(screen.getByText('Export Excel'));

    expect(globalThis.alert).toHaveBeenCalledWith(
      'Export failed. Please try again.',
    );
  });
});
