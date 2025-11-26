import React from 'react';
import { render, screen } from '@testing-library/react';
import AbandonCaseModal from '../AbandonCaseModal';
import { vi, describe, it, expect } from 'vitest';
import type { CaseRow } from '../casesTable.utils';

const mockCaseRow: CaseRow = {
  id: 'CASE-123',
  type: 'FRAUD',
  typeColor: 'bg-red-50',
  status: 'STATUS_10_ASSIGNED',
  statusColor: 'bg-blue-50',
  typologyId: 'TYP-001',
  score: 90,
  createdOn: '01/01/2023',
  pickedOn: '02/01/2023',
  action: 'View',
  assignee: 'John Doe',
  priority: 'HIGH',
  userRole: 'owner',
  totalTasks: 1,
};

describe('AbandonCaseModal component', () => {
  const renderModal = () => {
    const onClose = vi.fn();
    const onAbandon = vi.fn();

    render(
      <AbandonCaseModal
        open={true}
        onClose={onClose}
        onAbandon={onAbandon}
        caseData={mockCaseRow}
      />,
    );

    return { onClose, onAbandon };
  };

  it('shows the case heading and the disabled submit action initially', () => {
    renderModal();

    expect(
      screen.getByRole('heading', { name: /abandon case/i }),
    ).toBeInTheDocument();
    const submitButton = screen.getByRole('button', {
      name: /abandon case/i,
    });
    expect(submitButton).toBeDisabled();
  });

  it('renders the case id to provide context to the reviewer', () => {
    renderModal();

    expect(screen.getByText(/case id:/i)).toHaveTextContent('CASE-123');
  });
});
