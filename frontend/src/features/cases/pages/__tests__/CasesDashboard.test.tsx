import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CasesDashboard from '../CasesDashboard';

vi.mock('@/features/cases/components/CaseDashboardContainer', () => ({
  default: () => <div data-testid="case-dashboard-container" />,
}));

describe('CasesDashboard', () => {
  it('renders CaseDashboardContainer', () => {
    render(<CasesDashboard />);
    expect(screen.getByTestId('case-dashboard-container')).toBeInTheDocument();
  });
});
