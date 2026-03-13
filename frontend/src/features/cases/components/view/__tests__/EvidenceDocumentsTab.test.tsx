import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EvidenceDocumentsTab from '../EvidenceDocumentsTab';

describe('EvidenceDocumentsTab', () => {
  it('renders the upload documents button', () => {
    render(<EvidenceDocumentsTab />);
    expect(screen.getByText('Upload Documents')).toBeInTheDocument();
  });

  it('renders the supporting documents message', () => {
    render(<EvidenceDocumentsTab />);
    expect(
      screen.getByText('Upload any supporting documents'),
    ).toBeInTheDocument();
  });

  it('renders the upload icon', () => {
    const { container } = render(<EvidenceDocumentsTab />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders with dashed border container', () => {
    const { container } = render(<EvidenceDocumentsTab />);
    const borderedDiv = container.querySelector('.border-dashed');
    expect(borderedDiv).toBeInTheDocument();
  });

  it('renders centered content', () => {
    const { container } = render(<EvidenceDocumentsTab />);
    const centeredDiv = container.querySelector('.text-center');
    expect(centeredDiv).toBeInTheDocument();
  });

  it('renders upload button with correct styling', () => {
    render(<EvidenceDocumentsTab />);
    const button = screen.getByText('Upload Documents');
    expect(button.tagName).toBe('BUTTON');
    expect(button.className).toContain('text-indigo-600');
  });
});
