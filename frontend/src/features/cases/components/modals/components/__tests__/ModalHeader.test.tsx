import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ModalHeader from '../ModalHeader';

describe('ModalHeader', () => {
  it('renders header with title', () => {
    const mockOnClose = vi.fn();
    render(<ModalHeader onClose={mockOnClose} />);

    expect(screen.getByText('Case Details')).toBeInTheDocument();
    expect(screen.getByText('Collaborate')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();
    render(<ModalHeader onClose={mockOnClose} />);

    // Find the close button (the X icon button)
    const closeButton = screen
      .getAllByRole('button')
      .find(
        (btn) =>
          btn.className.includes('rounded-lg') &&
          btn.className.includes('text-gray-400'),
      );

    expect(closeButton).toBeInTheDocument();
    if (closeButton) {
      await user.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('renders collaborate button', () => {
    const mockOnClose = vi.fn();
    render(<ModalHeader onClose={mockOnClose} />);

    const collaborateButton = screen.getByText('Collaborate');
    expect(collaborateButton).toBeInTheDocument();
  });
});
