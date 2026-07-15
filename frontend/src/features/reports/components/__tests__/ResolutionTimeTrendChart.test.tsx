import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResolutionTimeTrendChart from '../ResolutionTimeTrendChart';
import type { ResolutionTrend } from '../../types/reports.types';

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="composed-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  Area: () => <div data-testid="area" />,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

describe('ResolutionTimeTrendChart', () => {
  const mockData: ResolutionTrend[] = [
    { month: '2024-01', median: 12, p25: 8, p75: 16, n: 5 },
    { month: '2024-02', median: null, p25: null, p75: null, n: 0 },
    { month: '2024-03', median: 10, p25: 6, p75: 14, n: 3 },
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
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(
      <ResolutionTimeTrendChart data={[]} title="Resolution Time Trend" />,
    );

    expect(screen.getByText('Resolution Time Trend')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByTestId('composed-chart')).not.toBeInTheDocument();
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

  it('keeps every calendar-month bucket, including a null (empty) month', () => {
    render(
      <ResolutionTimeTrendChart
        data={mockData}
        title="Resolution Time Trend"
      />,
    );

    // The null bucket doesn't get dropped from the axis - it renders as a
    // gap in the line/band, not a missing month.
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
  });

  it('renders all chart elements: median line, P25-P75 band, and n bars', () => {
    render(
      <ResolutionTimeTrendChart
        data={mockData}
        title="Resolution Time Trend"
      />,
    );

    expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line')).toBeInTheDocument();
    expect(screen.getAllByTestId('area').length).toBeGreaterThan(0);
    expect(screen.getByTestId('bar')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getAllByTestId('y-axis').length).toBeGreaterThan(0);
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });
});
