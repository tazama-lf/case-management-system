import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ReferenceIdDashboard from '../ReferenceIdDashboard';

vi.mock('@/shared/components/ui', () => ({
  PageContainer: ({ title, children }: any) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock('../..', () => ({
  ReferenceDashboardContent: () => <div data-testid="reference-dashboard-content" />,
}));

describe('ReferenceIdDashboard', () => {
  it('renders with title', () => {
    render(<ReferenceIdDashboard />);
    expect(screen.getByText('Reference ID Dashboard')).toBeInTheDocument();
  });

  it('renders ReferenceDashboardContent', () => {
    render(<ReferenceIdDashboard />);
    expect(screen.getByTestId('reference-dashboard-content')).toBeInTheDocument();
  });
});
