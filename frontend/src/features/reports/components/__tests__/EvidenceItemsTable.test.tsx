import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EvidenceItemsTable from '../EvidenceItemsTable';
import type { EvidenceItem } from '../../types/reports.types';

describe('EvidenceItemsTable', () => {
  const mockData: EvidenceItem[] = [
    {
      id: '1',
      type: 'Document',
      count: 50,
      percentage: 50,
      status: 'Confirmed',
    },
    {
      id: '2',
      type: 'Screenshot',
      count: 30,
      percentage: 30,
      status: 'Refuted',
    },
    {
      id: '3',
      type: 'Video',
      count: 20,
      percentage: 20,
      status: 'Inconclusive',
    },
  ];

  it('renders table with data', () => {
    render(<EvidenceItemsTable data={mockData} />);

    expect(screen.getByText('Evidence Type')).toBeInTheDocument();
    expect(screen.getByText('Count')).toBeInTheDocument();
    expect(screen.getByText('Percentage')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();

    expect(screen.getByText('Document')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<EvidenceItemsTable data={[]} isLoading={true} />);

    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('renders empty state when data is empty', () => {
    render(<EvidenceItemsTable data={[]} />);

    expect(screen.getByText('No evidence items found')).toBeInTheDocument();
  });

  it('displays correct status badges with correct colors', () => {
    render(<EvidenceItemsTable data={mockData} />);

    const confirmedBadge = screen.getByText('Confirmed');
    expect(confirmedBadge).toHaveClass('bg-green-50', 'text-green-700');

    const refutedBadge = screen.getByText('Refuted');
    expect(refutedBadge).toHaveClass('bg-red-50', 'text-red-700');

    const inconclusiveBadge = screen.getByText('Inconclusive');
    expect(inconclusiveBadge).toHaveClass('bg-yellow-50', 'text-yellow-700');
  });

  it('displays percentage with progress bar', () => {
    render(<EvidenceItemsTable data={mockData} />);

    const percentageTexts = screen.getAllByText(/50\.0%|30\.0%|20\.0%/);
    expect(percentageTexts.length).toBeGreaterThan(0);
  });

  it('renders all table rows', () => {
    render(<EvidenceItemsTable data={mockData} />);

    expect(screen.getByText('Document')).toBeInTheDocument();
    expect(screen.getByText('Screenshot')).toBeInTheDocument();
    expect(screen.getByText('Video')).toBeInTheDocument();
  });

  it('handles default isLoading prop', () => {
    render(<EvidenceItemsTable data={mockData} />);

    expect(screen.getByText('Document')).toBeInTheDocument();
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(0);
  });
});
