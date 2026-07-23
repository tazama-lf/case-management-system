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

describe('ReferenceIdDashboard', () => {
  it('renders with title', () => {
    render(<ReferenceIdDashboard />);
    expect(screen.getByText('Reference ID Dashboard')).toBeInTheDocument();
  });

  it('renders dashboard content', () => {
    render(<ReferenceIdDashboard />);
    expect(
      screen.getByText('Reference ID Dashboard content'),
    ).toBeInTheDocument();
  });
});
