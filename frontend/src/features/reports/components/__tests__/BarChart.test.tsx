import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BarChart from '../BarChart';

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar">{children}</div>
  ),
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

describe('BarChart', () => {
  const mockData = [
    { label: 'Jan', value: 10, color: '#3b82f6' },
    { label: 'Feb', value: 20, color: '#10b981' },
    { label: 'Mar', value: 15, color: '#f59e0b' },
  ];

  it('renders chart with data', () => {
    render(<BarChart data={mockData} title="Test Chart" />);

    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<BarChart data={mockData} title="Test Chart" isLoading={true} />);

    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<BarChart data={[]} title="Test Chart" />);

    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when data is null', () => {
    render(<BarChart data={null as any} title="Test Chart" />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders empty state when data is undefined', () => {
    render(<BarChart data={undefined as any} title="Test Chart" />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('applies custom height', () => {
    render(<BarChart data={mockData} title="Test Chart" height={400} />);

    const container = screen.getByTestId('responsive-container');
    expect(container).toBeInTheDocument();
  });

  it('renders with default height when not provided', () => {
    render(<BarChart data={mockData} title="Test Chart" />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders all chart elements', () => {
    render(<BarChart data={mockData} title="Test Chart" />);

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });

  it('renders cells for each data point', () => {
    render(<BarChart data={mockData} title="Test Chart" />);

    const cells = screen.getAllByTestId('cell');
    expect(cells.length).toBe(3);
  });
});
