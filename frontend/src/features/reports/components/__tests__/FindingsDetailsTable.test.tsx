import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FindingsDetailsTable from '../FindingsDetailsTable';
import type { FindingDetail } from '../../types/reports.types';

// Mock window.URL methods
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  global.URL.createObjectURL = mockCreateObjectURL;
  global.URL.revokeObjectURL = mockRevokeObjectURL;
  window.alert = vi.fn();
  
  // Spy on createElement to track anchor element creation
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    const element = originalCreateElement(tagName);
    if (tagName === 'a') {
      // Spy on click method
      const clickSpy = vi.fn();
      Object.defineProperty(element, 'click', {
        value: clickSpy,
        writable: true,
      });
    }
    return element;
  });
});

describe('FindingsDetailsTable', () => {
  const mockData: FindingDetail[] = [
    {
      caseId: 'CASE-123',
      finding: 'Suspicious transaction pattern detected',
      conclusion: 'Confirmed',
      evidenceCount: 3,
      dateIdentified: '2024-01-15T10:00:00Z',
      supportingEvidence: [
        'transaction_log_1.pdf',
        'transaction_log_2.pdf',
        'transaction_log_3.pdf',
      ],
    },
    {
      caseId: 'CASE-456',
      finding: 'Unusual account activity',
      conclusion: 'Refuted',
      evidenceCount: 2,
      dateIdentified: '2024-01-16T11:00:00Z',
      supportingEvidence: ['account_log_1.pdf', 'account_log_2.pdf'],
    },
  ];

  it('renders table with data', () => {
    render(<FindingsDetailsTable data={mockData} />);

    expect(screen.getByText('Case ID')).toBeInTheDocument();
    expect(screen.getByText('Finding')).toBeInTheDocument();
    expect(screen.getByText('Conclusion')).toBeInTheDocument();
    expect(screen.getByText('Evidence')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();

    expect(screen.getByText('CASE-123')).toBeInTheDocument();
    expect(
      screen.getByText('Suspicious transaction pattern detected'),
    ).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<FindingsDetailsTable data={[]} isLoading={true} />);

    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('renders empty state when data is empty', () => {
    render(<FindingsDetailsTable data={[]} />);

    expect(screen.getByText('No findings found')).toBeInTheDocument();
  });

  it('expands and collapses rows on click', async () => {
    const user = userEvent.setup();
    render(<FindingsDetailsTable data={mockData} />);

    const firstRow = screen.getByText('CASE-123').closest('tr');
    expect(firstRow).toBeInTheDocument();

    // Click to expand
    await user.click(firstRow!);

    await waitFor(() => {
      expect(screen.getByText('Supporting Evidence')).toBeInTheDocument();
      expect(screen.getByText('Full Finding Description')).toBeInTheDocument();
    });

    // Click again to collapse
    await user.click(firstRow!);

    await waitFor(() => {
      expect(screen.queryByText('Supporting Evidence')).not.toBeInTheDocument();
    });
  });

  it('displays correct status badges', () => {
    render(<FindingsDetailsTable data={mockData} />);

    const confirmedBadge = screen.getByText('Confirmed');
    expect(confirmedBadge).toHaveClass('bg-green-50', 'text-green-700');

    const refutedBadge = screen.getByText('Refuted');
    expect(refutedBadge).toHaveClass('bg-red-50', 'text-red-700');
  });

  it('opens modal when view evidence button is clicked', async () => {
    const user = userEvent.setup();
    render(<FindingsDetailsTable data={mockData} />);

    // Expand the first row
    const firstRow = screen.getByText('CASE-123').closest('tr');
    await user.click(firstRow!);

    await waitFor(() => {
      expect(screen.getByText('Supporting Evidence')).toBeInTheDocument();
    });

    // Click view button
    const viewButtons = screen.getAllByTitle('View evidence');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      // Check for modal title (filename in modal header)
      const modalTitle = screen.getByRole('heading', { name: /transaction_log_1\.pdf/i });
      expect(modalTitle).toBeInTheDocument();
    });
    
    // Check for description in modal (there may be multiple instances)
    const descriptions = screen.getAllByText('Transaction logs showing duplicate payments');
    expect(descriptions.length).toBeGreaterThan(0);
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<FindingsDetailsTable data={mockData} />);

    // Expand and open modal
    const firstRow = screen.getByText('CASE-123').closest('tr');
    await user.click(firstRow!);

    await waitFor(() => {
      expect(screen.getByText('Supporting Evidence')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View evidence');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      const modalTitle = screen.getByRole('heading', { name: /transaction_log_1\.pdf/i });
      expect(modalTitle).toBeInTheDocument();
    });

    // Close modal
    const closeButton = screen.getByLabelText('Close modal');
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /transaction_log_1\.pdf/i })).not.toBeInTheDocument();
    });
  });

  it('closes modal when backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(<FindingsDetailsTable data={mockData} />);

    // Expand and open modal
    const firstRow = screen.getByText('CASE-123').closest('tr');
    await user.click(firstRow!);

    await waitFor(() => {
      expect(screen.getByText('Supporting Evidence')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View evidence');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      const modalTitle = screen.getByRole('heading', { name: /transaction_log_1\.pdf/i });
      expect(modalTitle).toBeInTheDocument();
    });

    // Click backdrop
    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
    if (backdrop) {
      await user.click(backdrop);
    }

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /transaction_log_1\.pdf/i })).not.toBeInTheDocument();
    });
  });

  it('handles download evidence', async () => {
    const user = userEvent.setup();
    render(<FindingsDetailsTable data={mockData} />);

    // Expand the first row
    const firstRow = screen.getByText('CASE-123').closest('tr');
    await user.click(firstRow!);

    await waitFor(() => {
      expect(screen.getByText('Supporting Evidence')).toBeInTheDocument();
    });

    // Click download button
    const downloadButtons = screen.getAllByTitle('Download evidence');
    await user.click(downloadButtons[0]);

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
    expect(mockRevokeObjectURL).toHaveBeenCalled();
  });

  it('handles download from modal', async () => {
    const user = userEvent.setup();
    render(<FindingsDetailsTable data={mockData} />);

    // Expand and open modal
    const firstRow = screen.getByText('CASE-123').closest('tr');
    await user.click(firstRow!);

    await waitFor(() => {
      expect(screen.getByText('Supporting Evidence')).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByTitle('View evidence');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      const modalTitle = screen.getByRole('heading', { name: /transaction_log_1\.pdf/i });
      expect(modalTitle).toBeInTheDocument();
    });

    // Click download button in modal (use getAllByRole and get the one in the modal footer)
    const downloadButtons = screen.getAllByRole('button', { name: /Download/i });
    // The modal footer button should be the last one
    const modalDownloadButton = downloadButtons[downloadButtons.length - 1];
    await user.click(modalDownloadButton);

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });

  it('applies custom className', () => {
    const { container } = render(
      <FindingsDetailsTable data={mockData} className="custom-class" />,
    );

    const tableContainer = container.querySelector('.custom-class');
    expect(tableContainer).toBeInTheDocument();
  });

  it('displays formatted dates', () => {
    render(<FindingsDetailsTable data={mockData} />);

    // The date should be formatted as DD/MM/YYYY
    const dateTexts = screen.getAllByText(/15\/01\/2024|16\/01\/2024/);
    expect(dateTexts.length).toBeGreaterThan(0);
  });

  it('handles error during download', async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock createObjectURL to throw an error
    const originalCreateObjectURL = global.URL.createObjectURL;
    global.URL.createObjectURL = vi.fn(() => {
      throw new Error('Download failed');
    });

    render(<FindingsDetailsTable data={mockData} />);

    // Expand the first row
    const firstRow = screen.getByText('CASE-123').closest('tr');
    await user.click(firstRow!);

    await waitFor(() => {
      expect(screen.getByText('Supporting Evidence')).toBeInTheDocument();
    });

    // Click download button
    const downloadButtons = screen.getAllByTitle('Download evidence');
    await user.click(downloadButtons[0]);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
    expect(window.alert).toHaveBeenCalledWith(
      'Failed to download document. Please try again.',
    );

    // Restore
    global.URL.createObjectURL = originalCreateObjectURL;
    consoleErrorSpy.mockRestore();
  });
});

