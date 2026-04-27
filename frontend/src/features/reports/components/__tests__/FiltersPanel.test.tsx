import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FiltersPanel from '../FiltersPanel';
import { useFilters } from '../../hooks/useFilters';

vi.mock('../../hooks/useFilters');

// Setup MSW handler for filters endpoint
const mockFiltersData = {
  caseTypes: [
    { value: 'FRAUD', label: 'Fraud' },
    { value: 'MONEY_LAUNDERING', label: 'Money Laundering' },
  ],
  priorities: [
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
  ],
  investigators: [
    { value: 'user-1', label: 'John Doe' },
    { value: 'user-2', label: 'Jane Smith' },
  ],
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('FiltersPanel', () => {
  const mockOnChange = vi.fn();
  const mockOnApply = vi.fn();
  const mockOnReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useFilters as vi.Mock).mockReturnValue({
      data: mockFiltersData,
      isLoading: false,
      error: null,
    });
  });

  it('renders filters panel', async () => {
    render(
      <FiltersPanel
        caseType=""
        priority=""
        investigator=""
        onChange={mockOnChange}
        onApply={mockOnApply}
        onReset={mockOnReset}
      />,
      { wrapper: createWrapper() },
    );

    await waitFor(
      () => {
        expect(screen.getByText('Case Type')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Investigator')).toBeInTheDocument();
  });

  it('renders loading state', async () => {
    (useFilters as vi.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(
      <FiltersPanel
        caseType=""
        priority=""
        investigator=""
        onChange={mockOnChange}
        onApply={mockOnApply}
        onReset={mockOnReset}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Additional Filters')).toBeInTheDocument();
    // Loading state should be visible initially
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('calls onChange when case type is selected', async () => {
    const user = userEvent.setup();
    render(
      <FiltersPanel
        caseType=""
        priority=""
        investigator=""
        onChange={mockOnChange}
        onApply={mockOnApply}
        onReset={mockOnReset}
      />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText('Case Type')).toBeInTheDocument();
    });

    const caseTypeSelect = screen
      .getByText('Case Type')
      .parentElement?.querySelector('select');
    expect(caseTypeSelect).toBeInTheDocument();
    await user.selectOptions(caseTypeSelect!, 'FRAUD');

    expect(mockOnChange).toHaveBeenCalledWith('caseType', 'FRAUD');
  });

  it('calls onChange when priority is selected', async () => {
    const user = userEvent.setup();
    render(
      <FiltersPanel
        caseType=""
        priority=""
        investigator=""
        onChange={mockOnChange}
        onApply={mockOnApply}
        onReset={mockOnReset}
      />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText('Priority')).toBeInTheDocument();
    });

    const prioritySelect = screen
      .getByText('Priority')
      .parentElement?.querySelector('select');
    expect(prioritySelect).toBeInTheDocument();
    await user.selectOptions(prioritySelect!, 'HIGH');

    expect(mockOnChange).toHaveBeenCalledWith('priority', 'HIGH');
  });

  it('calls onChange when investigator is selected', async () => {
    const user = userEvent.setup();
    render(
      <FiltersPanel
        caseType=""
        priority=""
        investigator=""
        onChange={mockOnChange}
        onApply={mockOnApply}
        onReset={mockOnReset}
      />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText('Investigator')).toBeInTheDocument();
    });

    const investigatorSelect = screen
      .getByText('Investigator')
      .parentElement?.querySelector('select');
    expect(investigatorSelect).toBeInTheDocument();
    await user.selectOptions(investigatorSelect!, 'user-1');

    expect(mockOnChange).toHaveBeenCalledWith('investigator', 'user-1');
  });

  it('calls onApply when apply button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <FiltersPanel
        caseType="FRAUD"
        priority="HIGH"
        investigator="user-1"
        onChange={mockOnChange}
        onApply={mockOnApply}
        onReset={mockOnReset}
      />,
      { wrapper: createWrapper() },
    );

    await waitFor(
      () => {
        expect(
          screen.getByRole('button', { name: /Apply Filters/i }),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    const applyButton = screen.getByRole('button', { name: /Apply Filters/i });
    await user.click(applyButton);

    expect(mockOnApply).toHaveBeenCalledTimes(1);
  });

  it('calls onReset when reset button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <FiltersPanel
        caseType="FRAUD"
        priority="HIGH"
        investigator="user-1"
        onChange={mockOnChange}
        onApply={mockOnApply}
        onReset={mockOnReset}
      />,
      { wrapper: createWrapper() },
    );

    await waitFor(
      () => {
        expect(
          screen.getByRole('button', { name: /Reset Filters/i }),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    const resetButton = screen.getByRole('button', { name: /Reset Filters/i });
    await user.click(resetButton);

    expect(mockOnReset).toHaveBeenCalledTimes(1);
  });

  it('displays current filter values', async () => {
    render(
      <FiltersPanel
        caseType="FRAUD"
        priority="HIGH"
        investigator="user-1"
        onChange={mockOnChange}
        onApply={mockOnApply}
        onReset={mockOnReset}
      />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText('Case Type')).toBeInTheDocument();
    });

    const caseTypeSelect = screen
      .getByText('Case Type')
      .parentElement?.querySelector('select') as HTMLSelectElement;
    expect(caseTypeSelect?.value).toBe('FRAUD');

    const prioritySelect = screen
      .getByText('Priority')
      .parentElement?.querySelector('select') as HTMLSelectElement;
    expect(prioritySelect?.value).toBe('HIGH');

    const investigatorSelect = screen
      .getByText('Investigator')
      .parentElement?.querySelector('select') as HTMLSelectElement;
    expect(investigatorSelect?.value).toBe('user-1');
  });

  it('renders filter options from useFilters', async () => {
    render(
      <FiltersPanel
        caseType=""
        priority=""
        investigator=""
        onChange={mockOnChange}
        onApply={mockOnApply}
        onReset={mockOnReset}
      />,
      { wrapper: createWrapper() },
    );

    await waitFor(
      () => {
        expect(screen.getByText('Fraud')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    expect(screen.getByText('Money Laundering')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });
});
