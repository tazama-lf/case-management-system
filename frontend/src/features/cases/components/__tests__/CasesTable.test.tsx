import { render, screen } from '../../../../test/testUtils';
import { describe, it, expect, vi } from 'vitest';
import CasesTable from '../CasesTable';
import type { CaseRow } from '../casesTable.utils';

describe('CasesTable', () => {
  const mockRows: CaseRow[] = [
    {
      id: 1,
      type: 'FRAUD',
      typeColor: 'bg-red-50 text-red-700',
      status: 'STATUS_20_IN_PROGRESS',
      statusColor: 'bg-yellow-50 text-yellow-700',
      typologyId: 'TYP-001',
      score: 85,
      createdOn: '2023-01-01',
      pickedOn: '2023-01-02',
      action: 'View',
      assignee: 'User 1',
      priority: 'HIGH',
      userRole: 'owner',
      totalTasks: 5,
      alertId: 1,
    },
    {
      id: 2,
      type: 'AML',
      typeColor: 'bg-purple-50 text-purple-700',
      status: 'STATUS_00_DRAFT',
      statusColor: 'bg-gray-100 text-gray-700',
      typologyId: 'TYP-002',
      score: 45,
      createdOn: '2023-01-03',
      pickedOn: '-',
      action: 'Complete',
      assignee: 'Unassigned',
      priority: 'LOW',
      userRole: 'none',
      totalTasks: 0,
      alertId: 2,
    },
  ];

  const defaultProps = {
    rows: mockRows,
    onView: vi.fn(),
    pagination: {
      currentPage: 1,
      pageSize: 10,
      totalItems: 20,
      totalPages: 2,
      onPageChange: vi.fn(),
    },
  };

  it('should render table headers correctly', () => {
    render(<CasesTable {...defaultProps} />);
    expect(screen.getByText('Case ID')).toBeInTheDocument();
    expect(screen.getByText('Case Type')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
  });

  it('should render case rows correctly', () => {
    render(<CasesTable {...defaultProps} />);
    expect(screen.getByText('CASE-1')).toBeInTheDocument();
    expect(screen.getByText('FRAUD')).toBeInTheDocument();
    expect(screen.getByText('20_IN_PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('CASE-2')).toBeInTheDocument();
    expect(screen.getByText('AML')).toBeInTheDocument();
    expect(screen.getByText('00_DRAFT')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('should call onView when a row is clicked', () => {
    render(<CasesTable {...defaultProps} />);
    const row = screen.getByText('CASE-1').closest('tr')!;
    row.click();
    expect(defaultProps.onView).toHaveBeenCalledWith(mockRows[0]);
  });

  it('should render pagination controls', () => {
    render(<CasesTable {...defaultProps} />);
    expect(screen.getByText(/cases/i)).toBeInTheDocument();
  });

  it('should show "No cases available" when rows is empty', () => {
    render(<CasesTable {...defaultProps} rows={[]} />);
    expect(screen.getByText('No cases available.')).toBeInTheDocument();
  });

  it('should render SAR/STR Status column when isComplianceOfficer is true', () => {
    render(<CasesTable {...defaultProps} isComplianceOfficer={true} />);
    expect(screen.getByText('SAR/STR Status')).toBeInTheDocument();
  });

  it('should NOT render SAR/STR Status column by default', () => {
    render(<CasesTable {...defaultProps} />);
    expect(screen.queryByText('SAR/STR Status')).not.toBeInTheDocument();
  });

  it('should render created dates for each row', () => {
    render(<CasesTable {...defaultProps} />);
    expect(screen.getByText('2023-01-01')).toBeInTheDocument();
    expect(screen.getByText('2023-01-03')).toBeInTheDocument();
  });

  it('should render score with color coding', () => {
    render(<CasesTable {...defaultProps} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('should render case type for each row', () => {
    render(<CasesTable {...defaultProps} />);
    expect(screen.getByText('FRAUD')).toBeInTheDocument();
    expect(screen.getByText('AML')).toBeInTheDocument();
  });
});
