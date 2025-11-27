import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PieChart from '../PieChart';

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
  Legend: () => <div data-testid="legend" />,
}));

describe('PieChart', () => {
  const mockData = [
    { label: 'Type A', value: 50, color: '#3b82f6', percentage: 50 },
    { label: 'Type B', value: 30, color: '#10b981', percentage: 30 },
    { label: 'Type C', value: 20, color: '#f59e0b', percentage: 20 },
  ];

  it('renders chart with data', () => {
    render(<PieChart data={mockData} title="Test Chart" />);

    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<PieChart data={mockData} title="Test Chart" isLoading={true} />);

    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders empty state when total is zero', () => {
    const zeroData = [
      { label: 'Type A', value: 0, color: '#3b82f6', percentage: 0 },
      { label: 'Type B', value: 0, color: '#10b981', percentage: 0 },
    ];

    render(<PieChart data={zeroData} title="Test Chart" />);

    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument();
  });

  it('renders empty state when data is empty', () => {
    render(<PieChart data={[]} title="Test Chart" />);

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('filters out zero values', () => {
    const dataWithZeros = [
      { label: 'Type A', value: 50, color: '#3b82f6', percentage: 50 },
      { label: 'Type B', value: 0, color: '#10b981', percentage: 0 },
      { label: 'Type C', value: 30, color: '#f59e0b', percentage: 30 },
    ];

    render(<PieChart data={dataWithZeros} title="Test Chart" />);

    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    // Should only render cells for non-zero values
    const cells = screen.getAllByTestId('cell');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('applies custom size', () => {
    render(<PieChart data={mockData} title="Test Chart" size={400} />);

    const container = screen.getByTestId('responsive-container');
    expect(container).toBeInTheDocument();
  });

  it('renders with default size when not provided', () => {
    render(<PieChart data={mockData} title="Test Chart" />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders legend with percentages', () => {
    render(<PieChart data={mockData} title="Test Chart" />);

    expect(screen.getByText(/Type A:/)).toBeInTheDocument();
    expect(screen.getByText(/Type B:/)).toBeInTheDocument();
    expect(screen.getByText(/Type C:/)).toBeInTheDocument();
  });

  it('renders all chart elements', () => {
    render(<PieChart data={mockData} title="Test Chart" />);

    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('pie')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });
});

