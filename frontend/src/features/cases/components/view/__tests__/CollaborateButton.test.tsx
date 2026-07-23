import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import CollaborateButton from '../CollaborateButton';

describe('CollaborateButton', () => {
  it('renders collaborate button', () => {
    render(<CollaborateButton />);

    expect(screen.getByText('Collaborate')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const mockOnClick = vi.fn();
    render(<CollaborateButton onClick={mockOnClick} />);

    const button = screen.getByText('Collaborate');
    await user.click(button);

    expect(mockOnClick).toHaveBeenCalled();
  });

  it('renders with correct styling', () => {
    render(<CollaborateButton />);

    const button = screen.getByText('Collaborate');
    expect(button.className).toContain('bg-green-600');
  });
});
