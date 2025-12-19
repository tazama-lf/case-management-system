import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CaseSummaryItem from '../CaseSummaryItem';
import type { CaseSummary } from '../../types/dashboard.types';

describe('CaseSummaryItem', () => {
  it('renders case summary with assigned status', () => {
    const caseItem: CaseSummary = {
      status: 'assigned',
      count: 5,
      description: 'Assigned to you',
    };

    render(<CaseSummaryItem case={caseItem} />);

    const labels = screen.getAllByText('Assigned to you');
    expect(labels.length).toBeGreaterThan(0);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders case summary with pending status', () => {
    const caseItem: CaseSummary = {
      status: 'pending',
      count: 10,
      description: 'Pending review',
    };

    render(<CaseSummaryItem case={caseItem} />);

    const labels = screen.getAllByText('Pending review');
    expect(labels.length).toBeGreaterThan(0);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders case summary with closed status', () => {
    const caseItem: CaseSummary = {
      status: 'closed',
      count: 3,
      description: 'Recently closed',
    };

    render(<CaseSummaryItem case={caseItem} />);

    const labels = screen.getAllByText('Recently closed');
    expect(labels.length).toBeGreaterThan(0);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders default label for unknown status', () => {
    const caseItem: CaseSummary = {
      status: 'unknown' as any,
      count: 1,
      description: 'Test',
    };

    render(<CaseSummaryItem case={caseItem} />);

    expect(screen.getByText('Cases')).toBeInTheDocument();
  });

  it('applies correct color classes for statuses', () => {
    const assignedCase: CaseSummary = {
      status: 'assigned',
      count: 1,
      description: 'Test',
    };

    const { rerender } = render(<CaseSummaryItem case={assignedCase} />);
    expect(screen.getByText('Assigned to you')).toHaveClass('text-blue-600');

    const pendingCase: CaseSummary = {
      status: 'pending',
      count: 1,
      description: 'Test',
    };
    rerender(<CaseSummaryItem case={pendingCase} />);
    expect(screen.getByText('Pending review')).toHaveClass('text-yellow-600');

    const closedCase: CaseSummary = {
      status: 'closed',
      count: 1,
      description: 'Test',
    };
    rerender(<CaseSummaryItem case={closedCase} />);
    expect(screen.getByText('Recently closed')).toHaveClass('text-green-600');
  });
});

