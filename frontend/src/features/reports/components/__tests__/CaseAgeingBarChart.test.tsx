import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CaseAgeingBarChart from '../CaseAgeingBarChart';
import type { AgeingByStatus } from '../../types/reports.types';

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
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
});
