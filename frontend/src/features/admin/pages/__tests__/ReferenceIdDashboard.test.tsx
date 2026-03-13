import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AdminDashboard from '../ReferenceIdDashboard';

vi.mock('../../../../shared/components/ui', () => ({
  PageContainer: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid="page-container" data-title={title}>
      {children}
    </div>
  ),
}));

vi.mock('../..', () => ({
  ReferenceDashboardContent: () => (
    <div data-testid="reference-dashboard-content">ReferenceDashboardContent</div>
  ),
}));

describe('ReferenceIdDashboard', () => {
  it('renders PageContainer with correct title', () => {
    render(<AdminDashboard />);
    const container = screen.getByTestId('page-container');
    expect(container).toHaveAttribute('data-title', 'Reference ID Dashboard');
  });

  it('renders ReferenceDashboardContent inside PageContainer', () => {
    render(<AdminDashboard />);
    expect(screen.getByTestId('reference-dashboard-content')).toBeInTheDocument();
  });
});
