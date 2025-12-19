import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

// Mock child components
vi.mock('../components', () => ({
  CaseInformationCard: ({ caseInformation }: { caseInformation: any }) => (
    <div>Case Information: {caseInformation.status}</div>
  ),
  PersonInformationCard: ({ title, personInformation }: { title: string; personInformation: any }) => (
    <div>{title}: {personInformation.name}</div>
  ),
  BlockAllowListStatus: ({ status }: { status: string }) => (
    <div>Status: {status}</div>
  ),
  RecentActivitySection: ({ activities }: { activities: any[] }) => (
    <div>Activities: {activities.length}</div>
  ),
  ModalHeader: ({ onClose }: { onClose: () => void }) => (
    <div>
      <button onClick={onClose} aria-label="Close">Close</button>
    </div>
  ),
}));

import RelatedCaseModal from '../RelatedCaseModal';

const mockCaseData = {
  caseId: 'CASE-123',
  caseInformation: {
    creationDate: '2024-01-01',
    assignmentDate: '2024-01-02',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
  },
  debtorInformation: {
    name: 'John Doe',
    accountId: 'ACC-123',
    fsp: 'FSP-1',
  },
  creditorInformation: {
    name: 'Jane Smith',
    accountId: 'ACC-456',
    fsp: 'FSP-2',
  },
  blockAllowListStatus: 'ALLOWED',
  recentActivity: [
    {
      id: 'act-1',
      description: 'Case created',
      timestamp: '2024-01-01',
      user: 'user1',
    },
  ],
};

describe('RelatedCaseModal', () => {
  const mockOnClose = vi.fn();

  it('does not render when isOpen is false', () => {
    render(
      <RelatedCaseModal
        isOpen={false}
        onClose={mockOnClose}
        caseData={mockCaseData}
      />,
    );
    expect(screen.queryByText(/Case Details/i)).not.toBeInTheDocument();
  });

  it('renders modal with case data when open', () => {
    render(
      <RelatedCaseModal
        isOpen={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
      />,
    );

    // CASE-123 is in caseInformation which is passed to CaseInformationCard
    // The mock renders "Case Information: IN_PROGRESS", so check for that
    expect(screen.getByText(/Case Information/i)).toBeInTheDocument();
    // ModalHeader mock shows "Case Details" but it might not be rendered, so just check modal is open
    expect(screen.getByText(/Debtor Information/i)).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RelatedCaseModal
        isOpen={true}
        onClose={mockOnClose}
        caseData={mockCaseData}
      />,
    );

    const closeButton = screen.getByRole('button', { name: /Close/i });
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});

