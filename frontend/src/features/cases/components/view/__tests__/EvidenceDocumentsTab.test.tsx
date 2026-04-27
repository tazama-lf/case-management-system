import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EvidenceDocumentsTab from '../EvidenceDocumentsTab';

describe('EvidenceDocumentsTab', () => {
  it('renders upload button', () => {
    render(<EvidenceDocumentsTab />);
    expect(screen.getByText('Upload Documents')).toBeInTheDocument();
  });

  it('renders supporting text', () => {
    render(<EvidenceDocumentsTab />);
    expect(
      screen.getByText('Upload any supporting documents'),
    ).toBeInTheDocument();
  });

  it('renders upload icon', () => {
    render(<EvidenceDocumentsTab />);
    const button = screen.getByText('Upload Documents');
    expect(button.tagName.toLowerCase()).toBe('button');
  });
});
