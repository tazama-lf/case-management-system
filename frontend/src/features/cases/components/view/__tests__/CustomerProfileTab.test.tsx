import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CustomerProfileTab from '../CustomerProfileTab';

describe('CustomerProfileTab', () => {
  it('renders customer information', () => {
    render(<CustomerProfileTab />);

    expect(screen.getByText('Customer Information')).toBeInTheDocument();
    expect(screen.getByText('Personal Details')).toBeInTheDocument();
    expect(screen.getByText('Account Details')).toBeInTheDocument();
  });

  it('displays personal details', () => {
    render(<CustomerProfileTab />);

    expect(screen.getByText('Customer ID')).toBeInTheDocument();
    expect(screen.getByText('CUST-7613')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
  });

  it('displays account details', () => {
    render(<CustomerProfileTab />);

    expect(screen.getByText('Account Number')).toBeInTheDocument();
    expect(screen.getByText('XXXX-XXXX-2939')).toBeInTheDocument();
    expect(screen.getByText('Account Type')).toBeInTheDocument();
    expect(screen.getByText('Checking')).toBeInTheDocument();
  });
});
