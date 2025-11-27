import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WorkQueueTableSkeleton from '../WorkQueueTableSkeleton';

describe('WorkQueueTableSkeleton', () => {
  it('renders default number of skeleton rows', () => {
    const { container } = render(<WorkQueueTableSkeleton />);

    const bodyRows = container.querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(5);
  });

  it('renders the provided number of skeleton rows', () => {
    const { container } = render(<WorkQueueTableSkeleton rows={2} />);

    const bodyRows = container.querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(2);
  });

  it('shows all expected table headers', () => {
    render(<WorkQueueTableSkeleton rows={1} />);

    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText('Case')).toBeInTheDocument();
    expect(screen.getByText('Queue')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Assigned To')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });
});

