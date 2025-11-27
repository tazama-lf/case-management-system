import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RecentActivitySection from '../RecentActivitySection';

const mockActivities = [
  {
    id: 'act-1',
    description: 'Case created',
    timestamp: '2024-01-01 10:00:00',
    user: 'user1',
  },
  {
    id: 'act-2',
    description: 'Case assigned',
    timestamp: '2024-01-01 11:00:00',
    user: 'user2',
  },
];

describe('RecentActivitySection', () => {
  it('renders recent activity section', () => {
    render(<RecentActivitySection activities={mockActivities} />);

    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('displays all activities', () => {
    render(<RecentActivitySection activities={mockActivities} />);

    expect(screen.getByText('Case created')).toBeInTheDocument();
    expect(screen.getByText('2024-01-01 10:00:00')).toBeInTheDocument();
    expect(screen.getByText('Case assigned')).toBeInTheDocument();
    expect(screen.getByText('2024-01-01 11:00:00')).toBeInTheDocument();
  });

  it('handles empty activities array', () => {
    render(<RecentActivitySection activities={[]} />);

    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.queryByText('Case created')).not.toBeInTheDocument();
  });

  it('renders multiple activities', () => {
    const manyActivities = Array.from({ length: 5 }, (_, i) => ({
      id: `act-${i}`,
      description: `Activity ${i}`,
      timestamp: `2024-01-0${i + 1} 10:00:00`,
      user: `user${i}`,
    }));

    render(<RecentActivitySection activities={manyActivities} />);

    expect(screen.getByText('Activity 0')).toBeInTheDocument();
    expect(screen.getByText('Activity 4')).toBeInTheDocument();
  });
});

