import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConfirmUploadEvidenceModal from '../ConfirmUploadEvidenceModal';

/* ------------------------------------------------------------------ */
/*  Mock heroicons                                                     */
/* ------------------------------------------------------------------ */
vi.mock('@heroicons/react/24/outline', () => ({
  ArrowUpCircleIcon: (props: Record<string, unknown>) =>
    React.createElement('svg', { ...props, 'data-testid': 'upload-icon' }),
}));

/* ------------------------------------------------------------------ */
/*  Test data                                                          */
/* ------------------------------------------------------------------ */

const makeFile = (name: string, size = 1024) =>
  new File(['x'.repeat(size)], name, { type: 'application/pdf' });

const sections = [
  { sectionTitle: 'Sanctions Screening', files: [makeFile('sanctions.pdf'), makeFile('sanctions2.pdf')] },
  { sectionTitle: 'Adverse Media', files: [makeFile('media.pdf')] },
];

const defaultProps = {
  isOpen: true,
  isUploading: false,
  sections,
  onCancel: vi.fn(),
  onConfirm: vi.fn().mockResolvedValue(undefined),
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('ConfirmUploadEvidenceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* --- Visibility --- */

  it('does not render when isOpen is false', () => {
    render(<ConfirmUploadEvidenceModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Confirm Evidence Upload')).not.toBeInTheDocument();
  });

  it('renders modal when isOpen is true', () => {
    render(<ConfirmUploadEvidenceModal {...defaultProps} />);
    expect(screen.getByText('Confirm Evidence Upload')).toBeInTheDocument();
    expect(screen.getByTestId('upload-icon')).toBeInTheDocument();
  });

  /* --- Content --- */

  it('renders section titles and file names', () => {
    render(<ConfirmUploadEvidenceModal {...defaultProps} />);
    expect(screen.getByText('Sanctions Screening')).toBeInTheDocument();
    expect(screen.getByText('Adverse Media')).toBeInTheDocument();
    expect(screen.getByText(/sanctions\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/sanctions2\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/media\.pdf/)).toBeInTheDocument();
  });

  it('shows description text', () => {
    render(<ConfirmUploadEvidenceModal {...defaultProps} />);
    expect(screen.getByText(/following evidence files will be uploaded/i)).toBeInTheDocument();
  });

  /* --- Interactions --- */

  it('calls onCancel when cancel button clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmUploadEvidenceModal {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm button clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmUploadEvidenceModal {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /Confirm Upload/i }));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  /* --- Uploading state --- */

  it('shows Uploading text when isUploading is true', () => {
    render(<ConfirmUploadEvidenceModal {...defaultProps} isUploading={true} />);
    expect(screen.getByText('Uploading…')).toBeInTheDocument();
  });

  it('disables both buttons when uploading', () => {
    render(<ConfirmUploadEvidenceModal {...defaultProps} isUploading={true} />);
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Uploading/i })).toBeDisabled();
  });

  /* --- Edge cases --- */

  it('renders with empty sections', () => {
    render(<ConfirmUploadEvidenceModal {...defaultProps} sections={[]} />);
    expect(screen.getByText('Confirm Evidence Upload')).toBeInTheDocument();
  });
});
