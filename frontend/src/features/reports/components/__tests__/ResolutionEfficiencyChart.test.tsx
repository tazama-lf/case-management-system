import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResolutionEfficiencyChart from '../ResolutionEfficiencyChart';
import type { ResolutionEfficiency } from '../../types/reports.types';

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
}));

describe('ResolutionEfficiencyChart', () => {
  const mockData: ResolutionEfficiency[] = [
    { name: 'Type A', avgDays: 12.5 },
    { name: 'Type B', avgDays: 18.3 },
    { name: 'Type C', avgDays: 5.0 },
  ];

  it('renders chart with data', () => {
    render(<ResolutionEfficiencyChart data={mockData} title="Resolution Efficiency" />);

    expect(screen.getByText('Resolution Efficiency')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<ResolutionEfficiencyChart data={[]} title="Resolution Efficiency" />);

    expect(screen.getByText('Resolution Efficiency')).toBeInTheDocument();
    expect(screen.getByText('No efficiency data available')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    render(<ResolutionEfficiencyChart data={null as any} title="Resolution Efficiency" />);

    expect(screen.getByText('No efficiency data available')).toBeInTheDocument();
  });

  it('renders empty state when data is undefined', () => {
    render(<ResolutionEfficiencyChart data={undefined as any} title="Resolution Efficiency" />);

    expect(screen.getByText('No efficiency data available')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    render(<ResolutionEfficiencyChart data={mockData} title="Resolution Efficiency" height={400} />);

    const container = screen.getByTestId('responsive-container');
    expect(container).toBeInTheDocument();
  });

  it('renders with default height when not provided', () => {
    render(<ResolutionEfficiencyChart data={mockData} title="Resolution Efficiency" />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders all chart elements', () => {
    render(<ResolutionEfficiencyChart data={mockData} title="Resolution Efficiency" />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });
});

