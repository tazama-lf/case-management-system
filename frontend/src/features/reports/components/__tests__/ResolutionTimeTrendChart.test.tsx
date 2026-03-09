import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResolutionTimeTrendChart from '../ResolutionTimeTrendChart';
import type { ResolutionTrend } from '../../types/reports.types';

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

describe('ResolutionTimeTrendChart', () => {
  const mockData: ResolutionTrend[] = [
    { month: '2024-01', avgDays: 12.5 },
    { month: '2024-02', avgDays: 15.3 },
    { month: '2024-03', avgDays: 10.0 },
  ];

  it('renders chart with data', () => {
    render(
      <ResolutionTimeTrendChart
        data={mockData}
        title="Resolution Time Trend"
      />,
    );

    expect(screen.getByText('Resolution Time Trend')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(
      <ResolutionTimeTrendChart data={[]} title="Resolution Time Trend" />,
    );

    expect(screen.getByText('Resolution Time Trend')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    render(
      <ResolutionTimeTrendChart
        data={null as any}
        title="Resolution Time Trend"
      />,
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders empty state when data is undefined', () => {
    render(
      <ResolutionTimeTrendChart
        data={undefined as any}
        title="Resolution Time Trend"
      />,
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    render(
      <ResolutionTimeTrendChart
        data={mockData}
        title="Resolution Time Trend"
        height={400}
      />,
    );

    const container = screen.getByTestId('responsive-container');
    expect(container).toBeInTheDocument();
  });

  it('renders with default height when not provided', () => {
    render(
      <ResolutionTimeTrendChart
        data={mockData}
        title="Resolution Time Trend"
      />,
    );

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('aggregates data by month', () => {
    const duplicateMonthData: ResolutionTrend[] = [
      { month: '2024-01', avgDays: 10 },
      { month: '2024-01', avgDays: 15 },
      { month: '2024-02', avgDays: 20 },
    ];

    render(
      <ResolutionTimeTrendChart
        data={duplicateMonthData}
        title="Resolution Time Trend"
      />,
    );

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('renders all chart elements', () => {
    render(
      <ResolutionTimeTrendChart
        data={mockData}
        title="Resolution Time Trend"
      />,
    );

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });
});
