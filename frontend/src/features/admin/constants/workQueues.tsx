import type { WorkQueue } from '../types/admindashboard.types';

export const INITIAL_WORK_QUEUES: WorkQueue[] = [
  {
    id: '1',
    name: 'Unassigned Cases Queue',
    description: 'For cases that have not been assigned to an analyst',
    roles: ['Supervisor', 'Manager'],
    taskTypes: ['New Case', 'Reopened Case'],
    caseStatuses: [],
    caseTypes: [],
    status: 'Active',
  },
  {
    id: '2',
    name: 'Investigations Work Queue',
    description: 'For active investigations in progress',
    roles: ['Fraud Analyst', 'Investigator', 'AML Specialist'],
    taskTypes: ['Fraud Alert', 'AML Alert', 'Customer Complaint'],
    caseStatuses: [],
    caseTypes: [],
    status: 'Active',
  },
  {
    id: '3',
    name: 'Supervisor Work Queue',
    description: 'For cases requiring supervisor approval',
    roles: ['Supervisor', 'Manager'],
    taskTypes: ['Case Approval', 'Reopening Request'],
    caseStatuses: [],
    caseTypes: [],
    status: 'Active',
  },
  {
    id: '4',
    name: 'Completed Work Queue',
    description: 'For closed and completed cases',
    roles: ['Fraud Analyst', 'Investigator', 'Supervisor'],
    taskTypes: ['Closed Case', 'Archived Case'],
    caseStatuses: [],
    caseTypes: [],
    status: 'Active',
  },
];

// Provide a convenient mock export used by tests
export const mockWorkQueue: WorkQueue = INITIAL_WORK_QUEUES[0];
