import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConfirmUploadEvidenceModal from '../ConfirmUploadEvidenceModal';

describe('ConfirmUploadEvidenceModal', () => {
  const sections = [
    {
      sectionTitle: 'Investigation',
      files: [new File(['a'], 'doc1.pdf', { type: 'application/pdf' })],
    },
    {
      sectionTitle: 'Supporting',
      files: [
        new File(['b'], 'img1.png', { type: 'image/png' }),
        new File(['c'], 'img2.png', { type: 'image/png' }),
      ],
    },
  ];

  const defaultProps = {
    isOpen: true,
    isUploading: false,
    sections,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
  };

  it('returns null when not open', () => {
    const { container } = render(
      <ConfirmUploadEvidenceModal {...defaultProps} isOpen={false} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders modal with section titles and file names', () => {
    render(<ConfirmUploadEvidenceModal {...defaultProps} />);
    expect(screen.getByText('Confirm Evidence Upload')).toBeInTheDocument();
    expect(screen.getByText('Investigation')).toBeInTheDocument();
    expect(screen.getByText('Supporting')).toBeInTheDocument();
    expect(screen.getByText('• doc1.pdf')).toBeInTheDocument();
    expect(screen.getByText('• img1.png')).toBeInTheDocument();
    expect(screen.getByText('• img2.png')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<ConfirmUploadEvidenceModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    render(<ConfirmUploadEvidenceModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Confirm Upload'));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it('disables buttons when uploading', () => {
    render(<ConfirmUploadEvidenceModal {...defaultProps} isUploading={true} />);
    expect(screen.getByText('Cancel')).toBeDisabled();
    expect(screen.getByText('Uploading…')).toBeDisabled();
  });
});
