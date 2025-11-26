import React from 'react';
import { render, screen } from '@testing-library/react';
import ApproveCaseReopenModal from '../ApproveCaseReopenModal';
import { vi, describe, it, expect } from 'vitest';

describe('ApproveCaseReopenModal component', () => {
  it('renders without crashing', () => {
    const onClose = vi.fn();
    const onApprove = vi.fn();
    render(
      <ApproveCaseReopenModal
        open={true}
        onClose={onClose}
        onApprove={onApprove}
        caseId="CASE-123"
      />,
    );
    expect(screen.getByText(/approve case reopen/i)).toBeInTheDocument();
  });
});
