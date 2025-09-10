import React from 'react';
import { MagnifyingGlassIcon, ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import { PageContainer, Card } from '../../../shared/components/ui';
import { CasesTable, CreateCaseModal, ViewCaseModal, ReassignCaseModal } from '..';
import type { CaseRow } from '../components/CasesTable';

const CasesDashboard: React.FC = () => {
  const [search, setSearch] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'recent' | 'oldest'>('recent');
  const [caseIdFilter, setCaseIdFilter] = React.useState<'asc' | 'desc'>('desc');
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isViewOpen, setIsViewOpen] = React.useState(false);
  const [isReassignOpen, setIsReassignOpen] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<CaseRow | null>(null);

  const cases: CaseRow[] = [
    {
      id: 205,
      type: 'Fraud',
      typeColor: 'bg-red-50 text-red-700 ring-red-200',
      status: '10 - ASSIGNED',
      statusColor: 'bg-gray-100 text-gray-700',
      typologyId: 'TYP-001',
      score: 1450,
      createdOn: '01-03-2023',
      pickedOn: '-',
      action: 'View',
      reassignEnabled: true,
      assignee: 'John Smith',
    },
    {
      id: 202,
      type: 'AML',
      typeColor: 'bg-purple-50 text-purple-700 ring-purple-200',
      status: '20 - IN PROGRESS',
      statusColor: 'bg-blue-50 text-blue-700',
      typologyId: 'TYP-002',
      score: 1275,
      createdOn: '20-02-2023',
      pickedOn: '22-02-2023',
      action: 'View',
      reassignEnabled: true,
      assignee: 'Sarah Johnson',
    },
    {
      id: 102,
      type: 'Fraud',
      typeColor: 'bg-red-50 text-red-700 ring-red-200',
      status: '00 - DRAFT',
      statusColor: 'bg-gray-100 text-gray-700',
      typologyId: 'TYP-004',
      score: 1350,
      createdOn: '16-02-2023',
      pickedOn: '-',
      action: 'Complete',
      reassignEnabled: true,
      assignee: 'Michael Brown',
    },
    {
      id: 100,
      type: 'Fraud',
      typeColor: 'bg-red-50 text-red-700 ring-red-200',
      status: '31 - REOPENED',
      statusColor: 'bg-gray-100 text-gray-700',
      typologyId: 'TYP-006',
      score: 1320,
      createdOn: '14-02-2023',
      pickedOn: '15-02-2023',
      action: 'View',
      reassignEnabled: true,
      assignee: 'John Smith',
    },
  ];

  const filtered = cases
    .filter((c) =>
      [
        String(c.id),
        c.type,
        c.status,
        c.typologyId,
        String(c.score),
        c.createdOn,
        c.pickedOn,
      ]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortBy === 'recent') return b.id - a.id;
      return a.id - b.id;
    })
    .sort((a, b) => (caseIdFilter === 'desc' ? b.id - a.id : a.id - b.id));

  // Handlers
  const handleCreate = (payload: {
    caseId?: string;
    caseType: string;
    source: string;
    typologies: string[];
    description?: string;
    assignee?: string;
    attachments?: File[];
    comments?: string;
    linkToExistingCaseId?: string;
    draft?: boolean;
  }) => {
    console.log('Create case', payload);
    setIsCreateOpen(false);
  };

  const handleView = (row: CaseRow) => {
    setSelectedRow(row);
    setIsViewOpen(true);
  };

  const handleComplete = (row: CaseRow) => {
    console.log('Complete case', row);
  };

  const handleOpenReassign = (row: CaseRow) => {
    setSelectedRow(row);
    setIsReassignOpen(true);
  };

  const handleReassign = (row: CaseRow, assignee: string, justification?: string) => {
    console.log('Reassign case', row, 'to', assignee, 'justification:', justification);
    setIsReassignOpen(false);
  };

  return (
    <PageContainer
      title="Cases Dashboard"
      subtitle="Manage and track investigation cases"
      actions={
        <button onClick={() => setIsCreateOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <PlusIcon className="h-4 w-4" />
          Create Manually
        </button>
      }
    >
      <Card className="bg-indigo-50/40" padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col items-stretch gap-3 sm:flex-row">
            <div className="relative w-full sm:max-w-[160px]">
              <select
                aria-label="Case ID sort"
                value={caseIdFilter}
                onChange={(e) => setCaseIdFilter(e.target.value as 'asc' | 'desc')}
                className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="desc">Case ID </option>
                <option value="asc"> Status </option>
                <option value="asc"> typology ID </option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
                <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>

            <div className="relative w-full">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-md border border-gray-300 bg-white px-10 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>

            <div className="relative w-full sm:max-w-[160px]">
              <select
                aria-label="Sort by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'oldest')}
                className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="recent">Most Recent</option>
                <option value="oldest">Oldest</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
                <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <CasesTable
          rows={filtered}
          onView={handleView}
          onComplete={handleComplete}
          onReassign={handleOpenReassign}
        />
      </Card>

      {/* Modals */}
      <CreateCaseModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
      />
      <ViewCaseModal
        open={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        row={selectedRow}
      />
      <ReassignCaseModal
        open={isReassignOpen}
        onClose={() => setIsReassignOpen(false)}
        onReassign={handleReassign}
        row={selectedRow}
      />
    </PageContainer>
  );
};

export default CasesDashboard;
