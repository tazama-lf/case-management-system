import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RelatedAlertModal from '../RelatedAlertModal';

const mockAlertData = {
  alertId: 'ALERT-123',
  dateTime: '2024-01-01T00:00:00Z',
  riskScore: 85,
  entity: 'Entity-123',
  relatedItems: [
    {
      id: 'ITEM-1',
      type: 'case' as const,
      title: 'Related Case',
      description: 'Case description',
    },
  ],
  typologyRules: [
    {
      id: 'RULE-1',
      title: 'Fraud Rule',
      riskScore: 80,
    },
  ],
};

describe('RelatedAlertModal', () => {
  const mockOnClose = vi.fn();
  const mockOnRelatedItemClick = vi.fn();

  it('does not render when isOpen is false', () => {
    render(
      <RelatedAlertModal
        isOpen={false}
        onClose={mockOnClose}
        alertData={mockAlertData}
        onRelatedItemClick={mockOnRelatedItemClick}
      />,
    );
    expect(screen.queryByText('Alert Details')).not.toBeInTheDocument();
  });

  it('does not render when alertData is null', () => {
    render(
      <RelatedAlertModal
        isOpen={true}
        onClose={mockOnClose}
        alertData={null}
        onRelatedItemClick={mockOnRelatedItemClick}
      />,
    );
    expect(screen.queryByText('Alert Details')).not.toBeInTheDocument();
  });

  it('renders modal with alert data when open', () => {
    render(
      <RelatedAlertModal
        isOpen={true}
        onClose={mockOnClose}
        alertData={mockAlertData}
        onRelatedItemClick={mockOnRelatedItemClick}
      />,
    );

    expect(screen.getByText('Alert Details')).toBeInTheDocument();
    expect(screen.getByText('ALERT-123')).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RelatedAlertModal
        isOpen={true}
        onClose={mockOnClose}
        alertData={mockAlertData}
        onRelatedItemClick={mockOnRelatedItemClick}
      />,
    );

    // Close button is an icon button without aria-label, find it by its position
    const closeButton = screen.getAllByRole('button').find(
      (btn) => btn.className.includes('rounded-lg') && btn.className.includes('text-gray-400')
    ) || screen.getAllByRole('button')[0];
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});

