import React from 'react';
import NewDiscussionThreadModal from './NewDiscussionThreadModal';
import type { Collaborator, NewDiscussionThreadPayload } from './NewDiscussionThreadModal';

const Card: React.FC<{ title?: string; children: React.ReactNode; right?: React.ReactNode }>= ({ title, right, children }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    {(title || right) && (
      <div className="mb-3 flex items-center justify-between">
        {title ? <div className="text-sm font-semibold text-gray-800">{title}</div> : <div />}
        {right ? <div>{right}</div> : null}
      </div>
    )}
    <div className="text-sm text-gray-800">{children}</div>
  </div>
);

const ProgressBar: React.FC<{ value: number }>= ({ value }) => (
  <div className="h-2 w-full rounded bg-gray-100">
    <div className="h-2 rounded bg-indigo-600" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
  </div>
);

const Pill: React.FC<{ color?: 'green' | 'yellow' | 'red' | 'gray'; children: React.ReactNode }>= ({ color = 'gray', children }) => {
  const map = {
    green: 'bg-green-50 text-green-700 ring-green-200',
    yellow: 'bg-yellow-50 text-yellow-800 ring-yellow-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    gray: 'bg-gray-100 text-gray-700 ring-gray-200',
  } as const;
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${map[color]}`}>{children}</span>;
};

interface CollaboratePanelProps {
  collaborators?: Collaborator[];
  onCreateThread?: (payload: NewDiscussionThreadPayload) => void;
}

const defaultCollaborators: Collaborator[] = [
  { id: 'c1', name: 'Sarah Johnson', role: 'Fraud Analyst' },
  { id: 'c2', name: 'Michael Brown', role: 'Senior Investigator' },
  { id: 'c3', name: 'Emily Davis', role: 'Compliance Officer' },
  { id: 'c4', name: 'David Wilson', role: 'Risk Manager' },
];

const CollaboratePanel: React.FC<CollaboratePanelProps> = ({ collaborators = defaultCollaborators, onCreateThread }) => {
  const [openCreate, setOpenCreate] = React.useState(false);

  const handleCreate = (payload: NewDiscussionThreadPayload) => {
    if (onCreateThread) onCreateThread(payload);
    else console.log('New thread created', payload);
    setOpenCreate(false);
  };

  return (
    <div className="flex gap-6">
      {}
      <div className="w-full max-w-sm space-y-4">
        <Card title="Alert Stage" right={<Pill color="green">Complete</Pill>}>
          <div className="mb-2 text-xs text-gray-500">Started · Not started</div>
          <div className="mb-2 flex items-center justify-between text-xs text-gray-600">
            <span>Progress</span>
            <span>100%</span>
          </div>
          <ProgressBar value={100} />
          <div className="mt-3 space-y-1 text-xs text-gray-600">
            <div>System Task created</div>
            <div>9/5/2025, 9:06:56 AM</div>
            <div className="text-gray-500">Unassigned</div>
          </div>
        </Card>

        <Card title="Investigate" right={<Pill color="yellow">In-Progress</Pill>}>
          <div className="mb-2 text-xs text-gray-500">Started 4/9/25, 10:28:48 AM</div>
          <div className="mb-2 flex items-center justify-between text-xs text-gray-600">
            <span>Progress</span>
            <span>45%</span>
          </div>
          <ProgressBar value={45} />
          <div className="mt-3 space-y-1 text-xs text-gray-600">
            <div>System Task created</div>
            <div>9/5/2025, 9:06:56 AM</div>
            <div>Assigned to John Smith</div>
          </div>
        </Card>

        <Card title="Flagged Transaction">
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="text-gray-500">Transaction ID</div>
            <div className="text-indigo-700">TXN123456</div>
            <div className="text-gray-500">Amount</div>
            <div className="text-gray-900">$15,000</div>
            <div className="text-gray-500">Type</div>
            <div className="text-gray-900">Wire Transfer</div>
            <div className="text-gray-500">Date</div>
            <div className="text-gray-900">2024-01-15</div>
          </div>
        </Card>

        <Card title="Typologies Triggered">
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-sm">Account Muling</div>
              <Pill color="gray">Score 85</Pill>
            </div>
            <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-sm">Transaction Structuring</div>
              <Pill color="gray">Score 75</Pill>
            </div>
          </div>
        </Card>

        <Card title="Linked Alerts">
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div>
                <div className="text-sm font-medium">A-30023</div>
                <div className="text-xs text-gray-500">Large Transaction</div>
              </div>
              <Pill color="green">Active</Pill>
            </div>
            <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div>
                <div className="text-sm font-medium">A-30024</div>
                <div className="text-xs text-gray-500">Unusual Patterns</div>
              </div>
              <Pill color="gray">Closed</Pill>
            </div>
          </div>
        </Card>

        <Card title="Collaborators & Task Assignments" right={<div className="text-xs text-gray-500">3 people</div>}>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div>
                <div className="text-sm">John Smith</div>
                <div className="text-xs text-gray-500">Lead Investigator</div>
              </div>
              <div className="text-xs text-green-600">Viewed</div>
            </div>
            <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div>
                <div className="text-sm">Sarah Johnson</div>
                <div className="text-xs text-gray-500">Risk Analyst</div>
              </div>
              <div className="text-xs text-gray-400">Not viewed</div>
            </div>
            <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div>
                <div className="text-sm">Michael Brown</div>
                <div className="text-xs text-gray-500">Compliance Officer</div>
              </div>
              <div className="text-xs text-green-600">Viewed</div>
            </div>
          </div>
        </Card>
      </div>

      {}
      <div className="flex-1 space-y-4">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <input className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Search discussions..." />
            <button onClick={() => setOpenCreate(true)} className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">+ New Thread</button>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-900">Transaction Pattern Analysis</div>
            <div className="text-xs text-gray-500">1 comments</div>
          </div>
          <div className="mt-1 text-xs text-gray-500">3 collaborators · Last activity 2024-01-15 14:02:03</div>
        </Card>
      </div>

      {}
      <NewDiscussionThreadModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        collaborators={collaborators}
        onCreate={handleCreate}
      />
    </div>
  );
};

export default CollaboratePanel;
