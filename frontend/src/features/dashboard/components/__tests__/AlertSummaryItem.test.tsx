import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AlertSummaryItem from '../AlertSummaryItem';
import type { AlertSummary } from '../../types/dashboard.types';

describe('AlertSummaryItem', () => {
  it('renders alert summary with high priority', () => {
    const alert: AlertSummary = {
      priority: 'high',
      count: 5,
      description: 'Requires immediate attention',
    };

    render(<AlertSummaryItem alert={alert} />);

    expect(screen.getByText('High priority alerts')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(
      screen.getByText('Requires immediate attention'),
    ).toBeInTheDocument();
  });

  it('renders alert summary with medium priority', () => {
    const alert: AlertSummary = {
      priority: 'medium',
      count: 10,
      description: 'Review needed',
    };

    render(<AlertSummaryItem alert={alert} />);

    expect(screen.getByText('Medium priority alerts')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders alert summary with low priority', () => {
    const alert: AlertSummary = {
      priority: 'low',
      count: 3,
      description: 'Low priority items',
    };

    render(<AlertSummaryItem alert={alert} />);

    expect(screen.getByText('Low priority alerts')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders default label for unknown priority', () => {
    const alert: AlertSummary = {
      priority: 'unknown' as any,
      count: 1,
      description: 'Test',
    };

    render(<AlertSummaryItem alert={alert} />);

    expect(screen.getByText('Alerts')).toBeInTheDocument();
  });

  it('applies correct color classes for priorities', () => {
    const highAlert: AlertSummary = {
      priority: 'high',
      count: 1,
      description: 'Test',
    };

    const { rerender } = render(<AlertSummaryItem alert={highAlert} />);
    expect(screen.getByText('High priority alerts')).toHaveClass(
      'text-red-600',
    );

    const mediumAlert: AlertSummary = {
      priority: 'medium',
      count: 1,
      description: 'Test',
    };
    rerender(<AlertSummaryItem alert={mediumAlert} />);
    expect(screen.getByText('Medium priority alerts')).toHaveClass(
      'text-yellow-600',
    );

    const lowAlert: AlertSummary = {
      priority: 'low',
      count: 1,
      description: 'Test',
    };
    rerender(<AlertSummaryItem alert={lowAlert} />);
    expect(screen.getByText('Low priority alerts')).toHaveClass(
      'text-blue-600',
    );
  });
});
