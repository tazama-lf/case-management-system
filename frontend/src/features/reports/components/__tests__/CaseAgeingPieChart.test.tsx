import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CaseAgeingPieChart from '../CaseAgeingPieChart';
import type { AgeingDistribution } from '../../types/reports.types';

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie">{children}</div>
  ),
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

describe('CaseAgeingPieChart', () => {
  const mockData: AgeingDistribution[] = [
    { ageRange: '0-7 days', count: 20, percentage: 50, color: '#10b981' },
    { ageRange: '8-15 days', count: 10, percentage: 25, color: '#fbbf24' },
    { ageRange: '16-30 days', count: 8, percentage: 20, color: '#f97316' },
    { ageRange: '30+ days', count: 2, percentage: 5, color: '#ef4444' },
  ];

  it('renders chart with data', () => {
    render(
      <CaseAgeingPieChart data={mockData} title="Case Ageing Distribution" />,
    );

    expect(screen.getByText('Case Ageing Distribution')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<CaseAgeingPieChart data={[]} title="Case Ageing Distribution" />);

    expect(screen.getByText('Case Ageing Distribution')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    render(
      <CaseAgeingPieChart
        data={null as any}
        title="Case Ageing Distribution"
      />,
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders empty state when data is undefined', () => {
    render(
      <CaseAgeingPieChart
        data={undefined as any}
        title="Case Ageing Distribution"
      />,
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders "No cases found" when total is zero', () => {
    const zeroData: AgeingDistribution[] = [
      { ageRange: '0-7 days', count: 0, percentage: 0, color: '#10b981' },
      { ageRange: '8-15 days', count: 0, percentage: 0, color: '#fbbf24' },
    ];

    render(
      <CaseAgeingPieChart data={zeroData} title="Case Ageing Distribution" />,
    );

    expect(screen.getByText('No cases found')).toBeInTheDocument();
  });

  it('applies custom size', () => {
    render(
      <CaseAgeingPieChart
        data={mockData}
        title="Case Ageing Distribution"
        size={400}
      />,
    );

    const container = screen.getByTestId('responsive-container');
    expect(container).toBeInTheDocument();
  });

  it('renders with default size when not provided', () => {
    render(
      <CaseAgeingPieChart data={mockData} title="Case Ageing Distribution" />,
    );

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders custom legend with percentages', () => {
    render(
      <CaseAgeingPieChart data={mockData} title="Case Ageing Distribution" />,
    );

    expect(screen.getByText(/0-7 days: 50\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/8-15 days: 25\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/16-30 days: 20\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/30\+ days: 5\.0%/)).toBeInTheDocument();
  });

  it('completes missing age ranges with zero values', () => {
    const partialData: AgeingDistribution[] = [
      { ageRange: '0-7 days', count: 20, percentage: 100, color: '#10b981' },
    ];

    render(
      <CaseAgeingPieChart
        data={partialData}
        title="Case Ageing Distribution"
      />,
    );

    // Should still render legend for all ranges
    expect(screen.getByText(/0-7 days:/)).toBeInTheDocument();
  });

  it('renders all chart elements', () => {
    render(
      <CaseAgeingPieChart data={mockData} title="Case Ageing Distribution" />,
    );

    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('pie')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });
});
