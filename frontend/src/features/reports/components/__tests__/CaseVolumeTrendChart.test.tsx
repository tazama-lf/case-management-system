import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CaseVolumeTrendChart from '../CaseVolumeTrendChart';
import type { VolumeTrend } from '../../types/reports.types';

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
  Legend: () => <div data-testid="legend" />,
}));

describe('CaseVolumeTrendChart', () => {
  const mockData: VolumeTrend[] = [
    {
      month: 'Jan',
      investigators: {
        investigator1: 10,
        investigator2: 15,
      },
    },
    {
      month: 'Feb',
      investigators: {
        investigator1: 12,
        investigator2: 18,
      },
    },
    {
      month: 'Mar',
      investigators: {
        investigator1: 8,
        investigator2: 20,
      },
    },
  ];

  it('renders chart with data', () => {
    render(<CaseVolumeTrendChart data={mockData} title="Case Volume Trend" />);

    expect(screen.getByText('Case Volume Trend')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<CaseVolumeTrendChart data={[]} title="Case Volume Trend" />);

    expect(screen.getByText('Case Volume Trend')).toBeInTheDocument();
    expect(
      screen.getByText('No volume trend data available'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    render(
      <CaseVolumeTrendChart data={null as any} title="Case Volume Trend" />,
    );

    expect(
      screen.getByText('No volume trend data available'),
    ).toBeInTheDocument();
  });

  it('renders empty state when data is undefined', () => {
    render(
      <CaseVolumeTrendChart
        data={undefined as any}
        title="Case Volume Trend"
      />,
    );

    expect(
      screen.getByText('No volume trend data available'),
    ).toBeInTheDocument();
  });

  it('applies custom height', () => {
    render(
      <CaseVolumeTrendChart
        data={mockData}
        title="Case Volume Trend"
        height={400}
      />,
    );

    const container = screen.getByTestId('responsive-container');
    expect(container).toBeInTheDocument();
  });

  it('renders with default height when not provided', () => {
    render(<CaseVolumeTrendChart data={mockData} title="Case Volume Trend" />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders lines for each investigator', () => {
    render(<CaseVolumeTrendChart data={mockData} title="Case Volume Trend" />);

    const lines = screen.getAllByTestId('line');
    expect(lines.length).toBe(2); // Two investigators
  });

  it('handles single investigator', () => {
    const singleInvestigatorData: VolumeTrend[] = [
      {
        month: 'Jan',
        investigators: {
          investigator1: 10,
        },
      },
    ];

    render(
      <CaseVolumeTrendChart
        data={singleInvestigatorData}
        title="Case Volume Trend"
      />,
    );

    const lines = screen.getAllByTestId('line');
    expect(lines.length).toBe(1);
  });

  it('handles empty investigators object', () => {
    const emptyInvestigatorsData: VolumeTrend[] = [
      {
        month: 'Jan',
        investigators: {},
      },
    ];

    render(
      <CaseVolumeTrendChart
        data={emptyInvestigatorsData}
        title="Case Volume Trend"
      />,
    );

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('renders all chart elements', () => {
    render(<CaseVolumeTrendChart data={mockData} title="Case Volume Trend" />);

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });
});
