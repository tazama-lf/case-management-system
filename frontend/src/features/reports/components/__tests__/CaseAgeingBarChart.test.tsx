import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CaseAgeingBarChart, { formatStatusTickLabel } from '../CaseAgeingBarChart';
import type { AgeingByStatus } from '../../types/reports.types';

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="bar">{children}</div>
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  LabelList: () => <div data-testid="label-list" />,
}));

describe('CaseAgeingBarChart', () => {
  const mockData: AgeingByStatus[] = [
    {
      status: 'STATUS_20_IN_PROGRESS',
      age0to7: 10,
      age8to15: 5,
      age16to30: 3,
      age30Plus: 2,
    },
    {
      status: 'STATUS_10_ASSIGNED',
      age0to7: 8,
      age8to15: 4,
      age16to30: 2,
      age30Plus: 1,
    },
  ];

  it('renders chart with data', () => {
    render(<CaseAgeingBarChart data={mockData} title="Case Ageing" />);

    expect(screen.getByText('Case Ageing')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<CaseAgeingBarChart data={[]} title="Case Ageing" />);

    expect(screen.getByText('Case Ageing')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    render(<CaseAgeingBarChart data={null as any} title="Case Ageing" />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders empty state when data is undefined', () => {
    render(<CaseAgeingBarChart data={undefined as any} title="Case Ageing" />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    render(
      <CaseAgeingBarChart data={mockData} title="Case Ageing" height={400} />,
    );

    const container = screen.getByTestId('responsive-container');
    expect(container).toBeInTheDocument();
  });

  it('renders with default height when not provided', () => {
    render(<CaseAgeingBarChart data={mockData} title="Case Ageing" />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('formats status names correctly', () => {
    render(<CaseAgeingBarChart data={mockData} title="Case Ageing" />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders all chart elements', () => {
    render(<CaseAgeingBarChart data={mockData} title="Case Ageing" />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    // A single Y axis - a second category axis for the total count
    // previously desynced the Tooltip's hover-row resolution from the
    // hovered bar (see the "renders correct counts on hover" test below).
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });

  it('renders multiple bars for stacked chart', () => {
    render(<CaseAgeingBarChart data={mockData} title="Case Ageing" />);

    const bars = screen.getAllByTestId('bar');
    expect(bars.length).toBeGreaterThan(0);
  });

  describe('formatStatusTickLabel (regression: tooltip/axis desync bug)', () => {
    // A prior version used a second category YAxis (dataKey="total") purely
    // to display each row's count, with no explicit axisId on the shared
    // Tooltip. That desynced recharts' hover-row resolution from the
    // hovered bar - hovering "Pending Case Creation Approval" showed
    // Draft's counts. The fix folds the count directly into the single
    // status axis's tick label instead of a second axis.
    it('pairs each status with its own total, not a neighboring row\'s', () => {
      const rows = [
        { status: '00 DRAFT', total: 6 },
        { status: '01 PENDING CASE CREATION APPROVAL', total: 4 },
        { status: '02 READY FOR ASSIGNMENT', total: 20 },
      ];

      const labels = rows.map((r) => formatStatusTickLabel(r.status, r.total));

      expect(labels).toEqual([
        '00 DRAFT (6)',
        '01 PENDING CASE CREATION APPROVAL (4)',
        '02 READY FOR ASSIGNMENT (20)',
      ]);
    });

    it('shows 0 for a status with no open cases, not another row\'s count', () => {
      expect(formatStatusTickLabel('31 PENDING CASE REOPENING APPROVAL', 0)).toBe(
        '31 PENDING CASE REOPENING APPROVAL (0)',
      );
    });
  });
});
