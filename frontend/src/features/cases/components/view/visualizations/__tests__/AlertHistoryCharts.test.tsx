import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AlertHistoryCharts } from '../alerthistory/components/AlertHistoryCharts';

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => (
    <div data-testid="line-chart">{children}</div>
  ),
  BarChart: ({ children }: any) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Line: () => <div />,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

describe('AlertHistoryCharts', () => {
  const countData = [
    { date: '2024-01', alerts: 5, cases: 3, investigations: 2 },
    { date: '2024-02', alerts: 8, cases: 4, investigations: 3 },
  ];
  const valueData = [
    { date: '2024-01', value: 1000 },
    { date: '2024-02', value: 2000 },
  ];

  it('renders both charts', () => {
    render(<AlertHistoryCharts countData={countData} valueData={valueData} />);
    expect(
      screen.getByText('Alert, Case & Investigation Trend'),
    ).toBeInTheDocument();
    expect(screen.getByText('Transaction Value Trend')).toBeInTheDocument();
  });

  it('renders bar and line chart components', () => {
    render(<AlertHistoryCharts countData={countData} valueData={valueData} />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });
});
