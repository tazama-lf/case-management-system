import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import DashboardHeader from '../DashboardHeader';

describe('DashboardHeader', () => {
  it('renders title and subtitle', () => {
    const mockOnCreateClick = vi.fn();
    render(<DashboardHeader onCreateClick={mockOnCreateClick} />);

    expect(screen.getByText('Cases Dashboard')).toBeInTheDocument();
    expect(
      screen.getByText('Manage and track investigation cases'),
    ).toBeInTheDocument();
  });

  it('renders create button', () => {
    const mockOnCreateClick = vi.fn();
    render(<DashboardHeader onCreateClick={mockOnCreateClick} />);

    const createButton = screen.getByRole('button', {
      name: /Create Manually/i,
    });
    expect(createButton).toBeInTheDocument();
  });

  it('calls onCreateClick when create button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnCreateClick = vi.fn();
    render(<DashboardHeader onCreateClick={mockOnCreateClick} />);

    const createButton = screen.getByRole('button', {
      name: /Create Manually/i,
    });
    await user.click(createButton);

    expect(mockOnCreateClick).toHaveBeenCalled();
  });
});
