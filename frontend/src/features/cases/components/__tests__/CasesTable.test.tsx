import { render, screen, userEvent } from '../../../../test/testUtils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CasesTable from '../CasesTable';
import type { CaseRow } from '../casesTable.utils';

// Mock getCaseStatusBadge to return a simple string
vi.mock('@/shared/constants/case.constant', () => ({
  getCaseStatusBadge: (status: string) => status,
}));

// Mock TablePagination to avoid complex deps
vi.mock('@/shared', () => ({
  TablePagination: ({ pagination }: any) => (
    <div data-testid="table-pagination">
      <button onClick={() => pagination.onPageChange(pagination.currentPage + 1)}>
        Next
      </button>
    </div>
  ),
}));

const mockRows: CaseRow[] = [
  {
    id: 1,
    alertId: 100,
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
  },
  {
    id: 2,
    alertId: 200,
    type: 'AML',
    typeColor: 'bg-purple-50 text-purple-700',
    status: 'STATUS_00_DRAFT',
    statusColor: 'bg-gray-100 text-gray-700',
    typologyId: 'TYP-002',
    score: 45,
    createdOn: '2023-01-03',
    pickedOn: '-',
    action: 'View',
    assignee: 'Unassigned',
    priority: 'LOW',
    userRole: 'none',
    totalTasks: 0,
  },
];

describe('CasesTable', () => {
  const mockOnView = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    rows: mockRows,
    onView: mockOnView,
  };

  it('renders table headers correctly', () => {
    render(<CasesTable {...defaultProps} />);

    expect(screen.getByText('Case ID')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
  });

  it('does not render Actions column', () => {
    render(<CasesTable {...defaultProps} />);

    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
  });

  it('renders case rows with correct CASE-{id} format', () => {
    render(<CasesTable {...defaultProps} />);

    expect(screen.getByText('CASE-1')).toBeInTheDocument();
    expect(screen.getByText('FRAUD')).toBeInTheDocument();
    expect(screen.getByText('STATUS_20_IN_PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();

    expect(screen.getByText('CASE-2')).toBeInTheDocument();
    expect(screen.getByText('AML')).toBeInTheDocument();
    expect(screen.getByText('STATUS_00_DRAFT')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('shows createdOn date for each row', () => {
    render(<CasesTable {...defaultProps} />);

    expect(screen.getByText('2023-01-01')).toBeInTheDocument();
    expect(screen.getByText('2023-01-03')).toBeInTheDocument();
  });

  it('shows empty state when no rows provided', () => {
    render(<CasesTable rows={[]} onView={mockOnView} />);

    expect(screen.getByText('No cases available.')).toBeInTheDocument();
  });

  it('calls onView when a row is clicked', async () => {
    const user = userEvent.setup();
    render(<CasesTable {...defaultProps} />);

    const firstRow = screen.getByText('CASE-1').closest('tr');
    await user.click(firstRow!);

    expect(mockOnView).toHaveBeenCalledWith(mockRows[0]);
  });

  it('calls onView with correct row data when second row clicked', async () => {
    const user = userEvent.setup();
    render(<CasesTable {...defaultProps} />);

    const secondRow = screen.getByText('CASE-2').closest('tr');
    await user.click(secondRow!);

    expect(mockOnView).toHaveBeenCalledWith(mockRows[1]);
  });

  it('does not render SAR/STR column by default', () => {
    render(<CasesTable {...defaultProps} />);

    expect(screen.queryByText('SAR/STR Status')).not.toBeInTheDocument();
    expect(screen.queryByText('SAR/STR')).not.toBeInTheDocument();
  });

  it('renders SAR/STR column when isComplianceOfficer is true', () => {
    render(<CasesTable {...defaultProps} isComplianceOfficer={true} />);

    const sarHeaders = screen.getAllByText(/SAR\/STR/);
    expect(sarHeaders.length).toBeGreaterThan(0);
  });

  it('renders pagination component when pagination prop is provided', () => {
    const mockPagination = {
      currentPage: 1,
      pageSize: 10,
      totalItems: 20,
      totalPages: 2,
      onPageChange: vi.fn(),
    };

    render(<CasesTable {...defaultProps} pagination={mockPagination} />);

    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
  });

  it('does not render pagination when pagination prop is omitted', () => {
    render(<CasesTable {...defaultProps} />);

    expect(screen.queryByTestId('table-pagination')).not.toBeInTheDocument();
  });

  it('calls onPageChange when pagination Next is clicked', async () => {
    const user = userEvent.setup();
    const mockOnPageChange = vi.fn();

    render(
      <CasesTable
        {...defaultProps}
        pagination={{
          currentPage: 1,
          pageSize: 10,
          totalItems: 20,
          totalPages: 2,
          onPageChange: mockOnPageChange,
        }}
      />,
    );

    await user.click(screen.getByText('Next'));

    expect(mockOnPageChange).toHaveBeenCalledWith(2);
  });
});
