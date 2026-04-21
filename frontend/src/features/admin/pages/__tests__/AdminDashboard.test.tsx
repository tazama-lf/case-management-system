import React from 'react';
import { render, screen } from '@testing-library/react';
import AdminDashboard from '../AdminDashboard';
import { describe, it, expect, vi } from 'vitest';

// Mock child components
vi.mock('../../../admin', () => ({
  WorkQueueManagement: () => <div data-testid="work-queue-management">Work Queue Management</div>,
}));

vi.mock('../../../../shared/components/ui', () => ({
  PageContainer: ({ children, title }: any) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

describe('AdminDashboard', () => {
  it('renders dashboard', () => {
    render(<AdminDashboard />);
    expect(screen.getByText(/Admin Dashboard/i)).toBeInTheDocument();
  });
});
