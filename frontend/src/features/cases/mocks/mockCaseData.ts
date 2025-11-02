export interface MockCaseData {
  caseId: string;
  caseInformation: {
    creationDate: string;
    assignmentDate: string;
    status: string;
    priority: string;
  };
  debtorInformation: {
    name: string;
    accountId: string;
    fsp: string;
  };
  creditorInformation: {
    name: string;
    accountId: string;
    fsp: string;
  };
  blockAllowListStatus: string;
  recentActivity: Array<{
    id: string;
    description: string;
    timestamp: string;
    user: string;
  }>;
}

export const mockCaseData: MockCaseData = {
  caseId: 'A-10023',
  caseInformation: {
    creationDate: '2024-01-15',
    assignmentDate: '2024-01-16',
    status: 'Investigation',
    priority: 'High'
  },
  debtorInformation: {
    name: 'John Doe',
    accountId: 'ACC-12345',
    fsp: 'Bank ABC'
  },
  creditorInformation: {
    name: 'Jane Smith',
    accountId: 'ACC-67890',
    fsp: 'Bank XYZ'
  },
  blockAllowListStatus: 'Not Listed',
  recentActivity: [
    {
      id: '1',
      description: 'Case assigned to investigator',
      timestamp: '2024-01-16 09:00:00',
      user: 'System'
    },
    {
      id: '2',
      description: 'Investigation started',
      timestamp: '2024-01-16 10:30:00',
      user: 'John Investigator'
    }
  ]
};