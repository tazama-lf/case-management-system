import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TransactionHistoryCharts } from '../transactionhistory/components/TransactionHistoryCharts';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Line: () => <div />,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

describe('TransactionHistoryCharts', () => {
  const data = [
    { date: '2024-01', amount: 1000, count: 5, alert: false },
    { date: '2024-02', amount: 2500, count: 8, alert: true },
  ];

  it('renders amount chart', () => {
    render(<TransactionHistoryCharts data={data} />);
    expect(screen.getByText('Transaction Amount Trend')).toBeInTheDocument();
  });

  it('renders count chart', () => {
    render(<TransactionHistoryCharts data={data} />);
    expect(screen.getByText('Transaction Count')).toBeInTheDocument();
  });

  it('renders both chart types', () => {
    render(<TransactionHistoryCharts data={data} />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });
});
