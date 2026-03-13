import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CustomerProfileTab from '../CustomerProfileTab';
import { dwhService } from '../../../services/dwhService';

vi.mock('../../../services/dwhService');

describe('CustomerProfileTab', () => {
  const mockProfile = {
    customerDetails: [
      {
        customerId: 'CUST-7613',
        name: 'John Smith',
        dateOfBirth: '1990-01-15T00:00:00Z',
        email: 'john.smith@example.com',
        phone: '+1234567890',
      },
    ],
    address: [
      {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'US',
      },
    ],
    accountDetails: {
      sender: [
        {
          id: 'ACC-001',
          accountType: 'checking',
          openedDate: '2020-01-01T00:00:00Z',
          balance: 5000.50,
          currency: 'USD',
          riskRating: 'low',
        },
      ],
      receiver: [
        {
          id: 'ACC-002',
          accountType: 'savings',
          openedDate: '2021-06-15T00:00:00Z',
          balance: 15000.0,
          currency: 'USD',
          riskRating: 'medium',
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── No transactionId ──

  it('displays no transaction ID message when not provided', () => {
    render(<CustomerProfileTab />);
    expect(screen.getByText('No transaction ID available')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter transaction ID/)).toBeInTheDocument();
  });

  it('disables search button when manual input is empty', () => {
    render(<CustomerProfileTab />);
    expect(screen.getByText('Search')).toBeDisabled();
  });

  // ── Loading ──

  it('displays loading state when fetching profile', () => {
    (dwhService.getCustomerProfile as vi.Mock).mockImplementation(() => new Promise(() => {}));
    render(<CustomerProfileTab transactionId="TXN-001" />);
    expect(screen.getByText('Loading customer profile...')).toBeInTheDocument();
  });

  // ── Successful load ──

  it('displays customer personal details after loading', async () => {
    (dwhService.getCustomerProfile as vi.Mock).mockResolvedValue(mockProfile);
    render(<CustomerProfileTab transactionId="TXN-001" />);

    await waitFor(() => {
      expect(screen.getByText('Customer Information')).toBeInTheDocument();
      expect(screen.getByText('Personal Details')).toBeInTheDocument();
      expect(screen.getByText('CUST-7613')).toBeInTheDocument();
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('john.smith@example.com')).toBeInTheDocument();
      expect(screen.getByText('+1234567890')).toBeInTheDocument();
    });
  });

  it('displays sender and receiver account details', async () => {
    (dwhService.getCustomerProfile as vi.Mock).mockResolvedValue(mockProfile);
    render(<CustomerProfileTab transactionId="TXN-001" />);

    await waitFor(() => {
      expect(screen.getByText('Sender Account')).toBeInTheDocument();
      expect(screen.getByText('Receiver Account')).toBeInTheDocument();
      expect(screen.getByText('ACC-001')).toBeInTheDocument();
      expect(screen.getByText('ACC-002')).toBeInTheDocument();
    });
  });

  it('displays balance with currency formatting', async () => {
    (dwhService.getCustomerProfile as vi.Mock).mockResolvedValue(mockProfile);
    render(<CustomerProfileTab transactionId="TXN-001" />);

    await waitFor(() => {
      expect(screen.getByText('USD 5000.50')).toBeInTheDocument();
      expect(screen.getByText('USD 15000.00')).toBeInTheDocument();
    });
  });

  it('displays risk ratings capitalized', async () => {
    (dwhService.getCustomerProfile as vi.Mock).mockResolvedValue(mockProfile);
    render(<CustomerProfileTab transactionId="TXN-001" />);

    await waitFor(() => {
      expect(screen.getByText('low')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
    });
  });

  it('displays address information', async () => {
    (dwhService.getCustomerProfile as vi.Mock).mockResolvedValue(mockProfile);
    render(<CustomerProfileTab transactionId="TXN-001" />);

    await waitFor(() => {
      expect(screen.getByText('Address')).toBeInTheDocument();
      expect(screen.getByText('123 Main St')).toBeInTheDocument();
      expect(screen.getByText('New York')).toBeInTheDocument();
      expect(screen.getByText('NY')).toBeInTheDocument();
      expect(screen.getByText('10001')).toBeInTheDocument();
      expect(screen.getByText('US')).toBeInTheDocument();
    });
  });

  it('displays transaction ID in header', async () => {
    (dwhService.getCustomerProfile as vi.Mock).mockResolvedValue(mockProfile);
    render(<CustomerProfileTab transactionId="TXN-001" />);

    await waitFor(() => {
      expect(screen.getByText(/DWH Transaction ID: TXN-001/)).toBeInTheDocument();
    });
  });

  // ── Missing data fallbacks ──

  it('shows dash for missing customer details fields', async () => {
    (dwhService.getCustomerProfile as vi.Mock).mockResolvedValue({
      customerDetails: [{}],
      address: [],
      accountDetails: { sender: [], receiver: [] },
    });
    render(<CustomerProfileTab transactionId="TXN-001" />);

    await waitFor(() => {
      expect(screen.getByText('Personal Details')).toBeInTheDocument();
    });
    // Multiple '—' dash placeholders for missing fields
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('shows dash when balance is undefined', async () => {
    (dwhService.getCustomerProfile as vi.Mock).mockResolvedValue({
      customerDetails: [{ customerId: 'C1' }],
      address: [],
      accountDetails: {
        sender: [{ id: 'S1', accountType: 'checking' }],
        receiver: [],
      },
    });
    render(<CustomerProfileTab transactionId="TXN-001" />);

    await waitFor(() => {
      expect(screen.getByText('S1')).toBeInTheDocument();
    });
  });

  // ── Error state ──

  it('displays error state when API fails', async () => {
    (dwhService.getCustomerProfile as vi.Mock).mockRejectedValue(new Error('Server error'));
    render(<CustomerProfileTab transactionId="TXN-001" />);

    await waitFor(() => {
      const errorMessages = screen.getAllByText('Failed to load customer profile');
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  it('displays error message from API response', async () => {
    (dwhService.getCustomerProfile as vi.Mock).mockRejectedValue({
      response: { data: { message: 'Transaction not found' } },
    });
    render(<CustomerProfileTab transactionId="TXN-001" />);

    await waitFor(() => {
      expect(screen.getByText('Transaction not found')).toBeInTheDocument();
    });
  });

  it('shows transaction ID in error state', async () => {
    (dwhService.getCustomerProfile as vi.Mock).mockRejectedValue(new Error('fail'));
    render(<CustomerProfileTab transactionId="TXN-001" />);

    await waitFor(() => {
      expect(screen.getByText(/Transaction ID: TXN-001/)).toBeInTheDocument();
    });
  });

  it('shows search form in error state', async () => {
    (dwhService.getCustomerProfile as vi.Mock).mockRejectedValue(new Error('fail'));
    render(<CustomerProfileTab transactionId="TXN-001" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Try a different transaction ID/)).toBeInTheDocument();
    });
  });

  // ── Manual search ──

  it('enables search button when manual input has value', () => {
    render(<CustomerProfileTab />);
    const input = screen.getByPlaceholderText(/Enter transaction ID/);
    fireEvent.change(input, { target: { value: 'TXN-002' } });
    expect(screen.getByText('Search')).not.toBeDisabled();
  });

  it('triggers manual search on button click', async () => {
    (dwhService.getCustomerProfile as vi.Mock).mockResolvedValue(mockProfile);
    render(<CustomerProfileTab />);

    const input = screen.getByPlaceholderText(/Enter transaction ID/);
    fireEvent.change(input, { target: { value: 'TXN-002' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(dwhService.getCustomerProfile).toHaveBeenCalledWith('TXN-002');
    });
  });

  it('triggers manual search on Enter key press', async () => {
    (dwhService.getCustomerProfile as vi.Mock).mockResolvedValue(mockProfile);
    render(<CustomerProfileTab />);

    const input = screen.getByPlaceholderText(/Enter transaction ID/);
    fireEvent.change(input, { target: { value: 'TXN-003' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(dwhService.getCustomerProfile).toHaveBeenCalledWith('TXN-003');
    });
  });

  it('does not search when manual input is empty and Enter is pressed', () => {
    render(<CustomerProfileTab />);
    const input = screen.getByPlaceholderText(/Enter transaction ID/);
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(dwhService.getCustomerProfile).not.toHaveBeenCalled();
  });

  it('triggers search from error state', async () => {
    (dwhService.getCustomerProfile as vi.Mock)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(mockProfile);

    render(<CustomerProfileTab transactionId="TXN-BAD" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Try a different transaction ID/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Try a different transaction ID/);
    fireEvent.change(input, { target: { value: 'TXN-GOOD' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(dwhService.getCustomerProfile).toHaveBeenCalledWith('TXN-GOOD');
    });
  });

  it('handles manual search error', async () => {
    (dwhService.getCustomerProfile as vi.Mock).mockRejectedValue(new Error('Search failed'));
    render(<CustomerProfileTab />);

    const input = screen.getByPlaceholderText(/Enter transaction ID/);
    fireEvent.change(input, { target: { value: 'TXN-FAIL' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      const errors = screen.getAllByText('Failed to load customer profile');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('fetches profile with correct transaction ID on mount', async () => {
    (dwhService.getCustomerProfile as vi.Mock).mockResolvedValue(mockProfile);
    render(<CustomerProfileTab transactionId="TXN-001" />);

    await waitFor(() => {
      expect(dwhService.getCustomerProfile).toHaveBeenCalledWith('TXN-001');
    });
  });
});
