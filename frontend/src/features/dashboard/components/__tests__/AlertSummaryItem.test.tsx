import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AlertSummaryItem from '../AlertSummaryItem';
import type { AlertSummary } from '../../types/dashboard.types';

describe('AlertSummaryItem', () => {
  it('renders alert summary with high priority', () => {
    const alert: AlertSummary = {
      priority: 'High',
      count: 5,
      description: 'Requires immediate attention',
    };

    render(<AlertSummaryItem summary={alert} />);

    expect(screen.getByText('High priority cases')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(
      screen.getByText('Requires immediate attention'),
    ).toBeInTheDocument();
  });

  it('renders alert summary with medium priority', () => {
    const alert: AlertSummary = {
      priority: 'Medium',
      count: 10,
      description: 'Review needed',
    };

    render(<AlertSummaryItem summary={alert} />);

    expect(screen.getByText('Medium priority cases')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders alert summary with low priority', () => {
    const alert: AlertSummary = {
      priority: 'Low',
      count: 3,
      description: 'Low priority items',
    };

    render(<AlertSummaryItem summary={alert} />);

    expect(screen.getByText('Low priority cases')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders default label for unknown priority', () => {
    const alert: AlertSummary = {
      priority: 'unknown' as any,
      count: 1,
      description: 'Test',
    };

    render(<AlertSummaryItem summary={alert} />);

    expect(screen.getByText('Cases')).toBeInTheDocument();
  });

  it('applies correct color classes for priorities', () => {
    const highAlert: AlertSummary = {
      priority: 'High',
      count: 1,
      description: 'Test',
    };

    const { rerender } = render(<AlertSummaryItem summary={highAlert} />);
    expect(screen.getByText('High priority cases')).toHaveClass('text-red-600');

    const mediumAlert: AlertSummary = {
      priority: 'Medium',
      count: 1,
      description: 'Test',
    };
    rerender(<AlertSummaryItem summary={mediumAlert} />);
    expect(screen.getByText('Medium priority cases')).toHaveClass(
      'text-yellow-600',
    );

    const lowAlert: AlertSummary = {
      priority: 'Low',
      count: 1,
      description: 'Test',
    };
    rerender(<AlertSummaryItem summary={lowAlert} />);
    expect(screen.getByText('Low priority cases')).toHaveClass('text-blue-600');
  });
});
