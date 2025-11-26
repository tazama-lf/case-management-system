import React from 'react';
import { render, screen } from '@testing-library/react';
import ApproveCaseCreationModal from '../ApproveCaseCreationModal';
import { vi, describe, it, expect } from 'vitest';
import type { CaseRow } from '../casesTable.utils';

const mockCaseRow: CaseRow = {
  id: 'CASE-123',
  type: 'FRAUD',
  typeColor: 'bg-red-50',
  status: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL',
  statusColor: 'bg-blue-50',
  typologyId: 'TYP-001',
  score: 90,
  createdOn: '01/01/2023',
  pickedOn: '-',
  action: 'View',
  assignee: 'Unassigned',
  priority: 'HIGH',
  userRole: 'none',
  totalTasks: 0,
};

describe('ApproveCaseCreationModal component', () => {
  it('renders the case details and exposes actionable buttons', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    render(
      <ApproveCaseCreationModal
        open={true}
        onClose={onClose}
        onSubmit={onSubmit}
        caseData={mockCaseRow}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /approve case creation/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/case id: case-123/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /approve case creation/i }),
    ).toBeEnabled();
  });
});
