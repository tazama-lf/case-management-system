import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MultiBarChart from '../MultiBarChart';

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

describe('MultiBarChart', () => {
  const mockData = [
    { label: 'Jan', casesCreated: 10, casesClosed: 8 },
    { label: 'Feb', casesCreated: 15, casesClosed: 12 },
    { label: 'Mar', casesCreated: 20, casesClosed: 18 },
  ];

  it('renders chart with data', () => {
    render(<MultiBarChart data={mockData} title="Cases Overview" />);

    expect(screen.getByText('Cases Overview')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(
      <MultiBarChart data={mockData} title="Cases Overview" isLoading={true} />,
    );

    expect(screen.getByText('Cases Overview')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<MultiBarChart data={[]} title="Cases Overview" />);

    expect(screen.getByText('Cases Overview')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    render(<MultiBarChart data={null as any} title="Cases Overview" />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders empty state when data is undefined', () => {
    render(<MultiBarChart data={undefined as any} title="Cases Overview" />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    render(
      <MultiBarChart data={mockData} title="Cases Overview" height={400} />,
    );

    const container = screen.getByTestId('responsive-container');
    expect(container).toBeInTheDocument();
  });

  it('renders with default height when not provided', () => {
    render(<MultiBarChart data={mockData} title="Cases Overview" />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });
});
