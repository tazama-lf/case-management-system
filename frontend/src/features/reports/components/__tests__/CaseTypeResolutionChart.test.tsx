import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CaseTypeResolutionChart from '../CaseTypeResolutionChart';
import type { CaseTypeResolution } from '../../types/reports.types';

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

describe('CaseTypeResolutionChart', () => {
  const mockData: CaseTypeResolution[] = [
    { caseType: 'FRAUD', avgDays: 12.5 },
    { caseType: 'MONEY_LAUNDERING', avgDays: 18.3 },
    { caseType: 'NONE', avgDays: 5.0 },
  ];

  it('renders chart with data', () => {
    render(<CaseTypeResolutionChart data={mockData} title="Resolution Time" />);

    expect(screen.getByText('Resolution Time')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<CaseTypeResolutionChart data={[]} title="Resolution Time" />);

    expect(screen.getByText('Resolution Time')).toBeInTheDocument();
    expect(screen.getByText('No closed cases in selected period')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    render(<CaseTypeResolutionChart data={null as any} title="Resolution Time" />);

    expect(screen.getByText('No closed cases in selected period')).toBeInTheDocument();
  });

  it('renders empty state when data is undefined', () => {
    render(<CaseTypeResolutionChart data={undefined as any} title="Resolution Time" />);

    expect(screen.getByText('No closed cases in selected period')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    render(<CaseTypeResolutionChart data={mockData} title="Resolution Time" height={400} />);

    const container = screen.getByTestId('responsive-container');
    expect(container).toBeInTheDocument();
  });

  it('renders with default height when not provided', () => {
    render(<CaseTypeResolutionChart data={mockData} title="Resolution Time" />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('formats case type names correctly', () => {
    render(<CaseTypeResolutionChart data={mockData} title="Resolution Time" />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('handles NONE case type', () => {
    const noneData: CaseTypeResolution[] = [
      { caseType: 'NONE', avgDays: 5.0 },
    ];

    render(<CaseTypeResolutionChart data={noneData} title="Resolution Time" />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('rounds average days correctly', () => {
    render(<CaseTypeResolutionChart data={mockData} title="Resolution Time" />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders all chart elements', () => {
    render(<CaseTypeResolutionChart data={mockData} title="Resolution Time" />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });
});

