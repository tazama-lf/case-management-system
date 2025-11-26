import React from 'react';
import { render, screen } from '@testing-library/react';
import CaseClosureDecisionModal from '../CaseClosureDecisionModal';
import { vi, describe, it, expect } from 'vitest';

describe('CaseClosureDecisionModal component', () => {
  it('renders without crashing', () => {
    const onClose = vi.fn();
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(
      <CaseClosureDecisionModal
        open={true}
        onClose={onClose}
        onApprove={onApprove}
        onReject={onReject}
        caseId="CASE-123"
      />,
    );
    expect(screen.getByText(/case closure review/i)).toBeInTheDocument();
  });
});
