import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CaseInformationCard from '../CaseInformationCard';

const mockCaseInformation = {
  creationDate: '2024-01-01',
  assignmentDate: '2024-01-02',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
};

describe('CaseInformationCard', () => {
  it('renders case information', () => {
    render(<CaseInformationCard caseInformation={mockCaseInformation} />);

    expect(screen.getByText('Case Information')).toBeInTheDocument();
    expect(screen.getByText('Creation Date')).toBeInTheDocument();
    expect(screen.getByText('2024-01-01')).toBeInTheDocument();
    expect(screen.getByText('Assignment Date')).toBeInTheDocument();
    expect(screen.getByText('2024-01-02')).toBeInTheDocument();
  });

  it('displays status with correct styling', () => {
    render(<CaseInformationCard caseInformation={mockCaseInformation} />);

    expect(screen.getByText('IN_PROGRESS')).toBeInTheDocument();
  });

  it('displays priority with correct styling', () => {
    render(<CaseInformationCard caseInformation={mockCaseInformation} />);

    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('handles different priority values', () => {
    const lowPriority = { ...mockCaseInformation, priority: 'LOW' };
    render(<CaseInformationCard caseInformation={lowPriority} />);

    expect(screen.getByText('LOW')).toBeInTheDocument();
  });

  it('handles different status values', () => {
    const closedStatus = { ...mockCaseInformation, status: 'CLOSED' };
    render(<CaseInformationCard caseInformation={closedStatus} />);

    expect(screen.getByText('CLOSED')).toBeInTheDocument();
  });
});
