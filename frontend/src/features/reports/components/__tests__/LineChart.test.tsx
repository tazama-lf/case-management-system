import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LineChart from '../LineChart';

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

describe('LineChart', () => {
  const mockData = [
    { label: 'Jan', casesCreated: 10, casesClosed: 8 },
    { label: 'Feb', casesCreated: 15, casesClosed: 12 },
    { label: 'Mar', casesCreated: 20, casesClosed: 18 },
  ];

  it('renders chart with data', () => {
    render(<LineChart data={mockData} title="Test Chart" />);

    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<LineChart data={mockData} title="Test Chart" isLoading={true} />);

    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<LineChart data={[]} title="Test Chart" />);

    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    render(<LineChart data={null as any} title="Test Chart" />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders empty state when data is undefined', () => {
    render(<LineChart data={undefined as any} title="Test Chart" />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    render(<LineChart data={mockData} title="Test Chart" height={400} />);

    const container = screen.getByTestId('responsive-container');
    expect(container).toBeInTheDocument();
  });

  it('renders with default height when not provided', () => {
    render(<LineChart data={mockData} title="Test Chart" />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders all chart elements', () => {
    render(<LineChart data={mockData} title="Test Chart" />);

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('line')).toHaveLength(2); // Two lines
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });
});

