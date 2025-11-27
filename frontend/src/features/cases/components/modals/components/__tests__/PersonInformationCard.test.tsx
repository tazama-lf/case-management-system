import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PersonInformationCard from '../PersonInformationCard';

const mockPersonInformation = {
  name: 'John Doe',
  accountId: 'ACC-123',
  fsp: 'FSP-1',
};

describe('PersonInformationCard', () => {
  it('renders person information with title', () => {
    render(
      <PersonInformationCard
        title="Debtor Information"
        personInformation={mockPersonInformation}
      />,
    );

    expect(screen.getByText('Debtor Information')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Account ID')).toBeInTheDocument();
    expect(screen.getByText('ACC-123')).toBeInTheDocument();
    expect(screen.getByText('FSP')).toBeInTheDocument();
    expect(screen.getByText('FSP-1')).toBeInTheDocument();
  });

  it('renders with different title', () => {
    render(
      <PersonInformationCard
        title="Creditor Information"
        personInformation={mockPersonInformation}
      />,
    );

    expect(screen.getByText('Creditor Information')).toBeInTheDocument();
  });

  it('displays all person information fields', () => {
    render(
      <PersonInformationCard
        title="Person Information"
        personInformation={mockPersonInformation}
      />,
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('ACC-123')).toBeInTheDocument();
    expect(screen.getByText('FSP-1')).toBeInTheDocument();
  });
});

