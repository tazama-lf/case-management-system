import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import OutcomeDistributionChart from '../OutcomeDistributionChart';
import type { OutcomeDistribution } from '../../types/reports.types';

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

describe('OutcomeDistributionChart', () => {
  const mockData: OutcomeDistribution[] = [
    {
      name: 'Type A',
      confirmed: 10,
      refuted: 5,
      inconclusive: 3,
    },
    {
      name: 'Type B',
      confirmed: 8,
      refuted: 4,
      inconclusive: 2,
    },
  ];

  it('renders chart with data', () => {
    render(<OutcomeDistributionChart data={mockData} title="Outcome Distribution" />);

    expect(screen.getByText('Outcome Distribution')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<OutcomeDistributionChart data={[]} title="Outcome Distribution" />);

    expect(screen.getByText('Outcome Distribution')).toBeInTheDocument();
    expect(screen.getByText('No outcome data available')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    render(<OutcomeDistributionChart data={null as any} title="Outcome Distribution" />);

    expect(screen.getByText('No outcome data available')).toBeInTheDocument();
  });

  it('renders empty state when data is undefined', () => {
    render(<OutcomeDistributionChart data={undefined as any} title="Outcome Distribution" />);

    expect(screen.getByText('No outcome data available')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    render(<OutcomeDistributionChart data={mockData} title="Outcome Distribution" height={400} />);

    const container = screen.getByTestId('responsive-container');
    expect(container).toBeInTheDocument();
  });

  it('renders with default height when not provided', () => {
    render(<OutcomeDistributionChart data={mockData} title="Outcome Distribution" />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders all chart elements', () => {
    render(<OutcomeDistributionChart data={mockData} title="Outcome Distribution" />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('bar')).toHaveLength(3); // Three bars
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });
});

