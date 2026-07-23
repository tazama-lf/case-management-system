import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompletionTimeChart from '../CompletionTimeChart';
import type { CompletionTime } from '../../types/reports.types';

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

describe('CompletionTimeChart', () => {
  const mockData: CompletionTime[] = [
    { type: 'Type A', avgDays: 5 },
    { type: 'Type B', avgDays: 7 },
    { type: 'Type C', avgDays: 10 },
  ];

  it('renders chart with data', () => {
    render(<CompletionTimeChart data={mockData} title="Completion Time" />);

    expect(screen.getByText('Completion Time')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<CompletionTimeChart data={[]} title="Completion Time" />);

    expect(screen.getByText('Completion Time')).toBeInTheDocument();
    expect(
      screen.getByText('No completion time data available'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    render(<CompletionTimeChart data={null as any} title="Completion Time" />);

    expect(
      screen.getByText('No completion time data available'),
    ).toBeInTheDocument();
  });

  it('renders empty state when data is undefined', () => {
    render(
      <CompletionTimeChart data={undefined as any} title="Completion Time" />,
    );

    expect(
      screen.getByText('No completion time data available'),
    ).toBeInTheDocument();
  });

  it('applies custom height', () => {
    render(
      <CompletionTimeChart
        data={mockData}
        title="Completion Time"
        height={400}
      />,
    );

    const container = screen.getByTestId('responsive-container');
    expect(container).toBeInTheDocument();
  });

  it('renders with default height when not provided', () => {
    render(<CompletionTimeChart data={mockData} title="Completion Time" />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });
});
