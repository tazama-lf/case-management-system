import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkloadBarChart from '../WorkloadBarChart';
import type { InvestigatorWorkload } from '../../types/reports.types';

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

describe('WorkloadBarChart', () => {
  const mockData: InvestigatorWorkload[] = [
    { name: 'Investigator 1', activeCases: 10, pendingTasks: 5 },
    { name: 'Investigator 2', activeCases: 15, pendingTasks: 8 },
    { name: 'Investigator 3', activeCases: 8, pendingTasks: 3 },
  ];

  it('renders chart with data', () => {
    render(<WorkloadBarChart data={mockData} title="Investigator Workload" />);

    expect(screen.getByText('Investigator Workload')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<WorkloadBarChart data={[]} title="Investigator Workload" />);

    expect(screen.getByText('Investigator Workload')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    render(<WorkloadBarChart data={null as any} title="Investigator Workload" />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders empty state when data is undefined', () => {
    render(<WorkloadBarChart data={undefined as any} title="Investigator Workload" />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    render(<WorkloadBarChart data={mockData} title="Investigator Workload" height={400} />);

    const container = screen.getByTestId('responsive-container');
    expect(container).toBeInTheDocument();
  });

  it('renders with default height when not provided', () => {
    render(<WorkloadBarChart data={mockData} title="Investigator Workload" />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders all chart elements', () => {
    render(<WorkloadBarChart data={mockData} title="Investigator Workload" />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('bar')).toHaveLength(2); // Two bars
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });
});

