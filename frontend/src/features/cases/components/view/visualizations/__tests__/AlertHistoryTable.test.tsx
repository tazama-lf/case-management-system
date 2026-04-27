import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AlertHistoryTable } from '../alerthistory/components/AlertHistoryTable';

describe('AlertHistoryTable', () => {
  const data = [
    {
      id: 'ALT-001',
      date: '2024-01-01',
      type: 'Fraud',
      severity: 'High' as const,
      status: 'Investigated',
      caseId: 'CASE-001',
      outcome: 'Confirmed',
      actions: 'View',
    },
    {
      id: 'ALT-002',
      date: '2024-01-02',
      type: 'AML',
      severity: 'Low' as const,
      status: 'Closed',
      caseId: 'CASE-002',
      outcome: 'Refuted',
      actions: 'View',
    },
  ];

  it('renders table headers', () => {
    render(<AlertHistoryTable data={data} />);
    expect(screen.getByText('Alert ID')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Severity')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    render(<AlertHistoryTable data={data} />);
    expect(screen.getByText('ALT-001')).toBeInTheDocument();
    expect(screen.getByText('Fraud')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('ALT-002')).toBeInTheDocument();
  });

  it('applies correct severity colors', () => {
    render(<AlertHistoryTable data={data} />);
    const highBadge = screen.getByText('High');
    expect(highBadge.className).toContain('bg-red-100');
    const lowBadge = screen.getByText('Low');
    expect(lowBadge.className).toContain('bg-green-100');
  });
});
