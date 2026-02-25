import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CompletionRateTrendChart from '../CompletionRateTrendChart';
import type { CompletionTrend } from '../../types/reports.types';

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

describe('CompletionRateTrendChart', () => {
  const mockData: CompletionTrend[] = [
    { week: 'Week 1', completionRate: 75 },
    { week: 'Week 2', completionRate: 80 },
    { week: 'Week 3', completionRate: 85 },
  ];

  it('renders chart with data', () => {
    render(
      <CompletionRateTrendChart
        data={mockData}
        title="Completion Rate Trend"
      />,
    );

    expect(screen.getByText('Completion Rate Trend')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(
      <CompletionRateTrendChart data={[]} title="Completion Rate Trend" />,
    );

    expect(screen.getByText('Completion Rate Trend')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    render(
      <CompletionRateTrendChart
        data={null as any}
        title="Completion Rate Trend"
      />,
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders empty state when data is undefined', () => {
    render(
      <CompletionRateTrendChart
        data={undefined as any}
        title="Completion Rate Trend"
      />,
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    render(
      <CompletionRateTrendChart
        data={mockData}
        title="Completion Rate Trend"
        height={400}
      />,
    );

    const container = screen.getByTestId('responsive-container');
    expect(container).toBeInTheDocument();
  });

  it('renders with default height when not provided', () => {
    render(
      <CompletionRateTrendChart
        data={mockData}
        title="Completion Rate Trend"
      />,
    );

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });
});
