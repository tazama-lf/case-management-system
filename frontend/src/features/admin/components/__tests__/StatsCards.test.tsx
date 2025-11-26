import React from 'react';
import { render, screen } from '@testing-library/react';
import StatsCards from '../StatsCards';

const stats = {
  activeWorkQueues: 4,
  userAccounts: 20,
  systemRoles: 6,
  pendingApprovals: 3,
};

describe('StatsCards', () => {
  it('renders all four stat cards with the correct values', () => {
    render(<StatsCards stats={stats} />);

    expect(screen.getByText('Active Work Queues')).toHaveTextContent('Active Work Queues');
    expect(screen.getByText('4')).toBeInTheDocument();

    expect(screen.getByText('User Accounts')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();

    expect(screen.getByText('System Roles')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();

    expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

