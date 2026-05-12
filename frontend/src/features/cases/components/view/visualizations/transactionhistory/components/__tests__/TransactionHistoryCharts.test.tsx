import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

let capturedDotFn: any = null;

vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: (props: any) => {
    capturedDotFn = props.dot;
    return <div data-testid="line" />;
  },
  BarChart: ({ children }: any) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

import { TransactionHistoryCharts } from '../TransactionHistoryCharts';

describe('TransactionHistoryCharts', () => {
  const sampleData = [
    { date: '2024-01-01', amount: 100, count: 5, alert: false },
    { date: '2024-01-02', amount: 200, count: 3, alert: true },
  ];

  it('renders both chart titles', () => {
    render(<TransactionHistoryCharts data={sampleData} />);
    expect(screen.getByText('Transaction Amount Trend')).toBeInTheDocument();
    expect(screen.getByText('Transaction Count')).toBeInTheDocument();
  });

  it('renders line chart and bar chart', () => {
    render(<TransactionHistoryCharts data={sampleData} />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders with empty data array', () => {
    render(<TransactionHistoryCharts data={[]} />);
    expect(screen.getByText('Transaction Amount Trend')).toBeInTheDocument();
  });

  it('renders with alert data points', () => {
    render(<TransactionHistoryCharts data={sampleData} />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('dot function returns larger red circle for alert points', () => {
    render(<TransactionHistoryCharts data={sampleData} />);
    expect(capturedDotFn).toBeDefined();
    // Alert point (sampleData[1] has alert: true)
    const alertDot = capturedDotFn({ cx: 100, cy: 50, payload: sampleData[1] });
    expect(alertDot.props.r).toBe(6);
    expect(alertDot.props.fill).toBe('#ef4444');
  });

  it('dot function returns smaller blue circle for non-alert points', () => {
    render(<TransactionHistoryCharts data={sampleData} />);
    expect(capturedDotFn).toBeDefined();
    // Non-alert point (sampleData[0] has alert: false)
    const normalDot = capturedDotFn({ cx: 50, cy: 30, payload: sampleData[0] });
    expect(normalDot.props.r).toBe(4);
    expect(normalDot.props.fill).toBe('#3b82f6');
  });

  it('dot function handles undefined alert value', () => {
    const dataNoAlert = [{ date: '2024-01-01', amount: 100, count: 5 }];
    render(<TransactionHistoryCharts data={dataNoAlert} />);
    expect(capturedDotFn).toBeDefined();
    const dot = capturedDotFn({ cx: 10, cy: 20, payload: { index: 0 } });
    expect(dot.props.r).toBe(4);
    expect(dot.props.fill).toBe('#3b82f6');
  });
});
