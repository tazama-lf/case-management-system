import React, { useState } from 'react';
import RelatedCaseModal from '../modals/RelatedCaseModal';
import RelatedAlertModal from '../modals/RelatedAlertModal';
import TransactionMessagesModal from '../modals/TransactionMessagesModal';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-2">
    <div className="text-sm font-semibold text-gray-700">{title}</div>
    <div className="pl-1">{children}</div>
  </div>
);

const LinkItem: React.FC<{ onClick?: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button onClick={onClick} className="block text-indigo-700 hover:underline text-left">
    {children}
  </button>
);

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{children}</span>
);

const TypologyItem: React.FC<{ id: string; title: string; score: number; isExpanded: boolean; onToggle: () => void }> = ({ title, score, isExpanded, onToggle }) => (
  <div className="rounded-md border border-gray-200 bg-white">
    <button 
      onClick={onToggle}
      className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
    >
      <div className="flex items-center justify-between flex-1">
        <div>{title}</div>
        <div className="text-xs text-gray-500">Risk Score: {score}</div>
      </div>
      <svg 
        className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {isExpanded && (
      <div className="border-t border-gray-200 px-3 py-2 text-sm text-gray-600">
        <p>Detailed information about this typology rule and its matching criteria would be displayed here.</p>
        <div className="mt-2 space-y-1">
          <div className="text-xs text-gray-500">• Transaction pattern analysis</div>
          <div className="text-xs text-gray-500">• Risk threshold: {score > 80 ? 'High' : score > 60 ? 'Medium' : 'Low'}</div>
          <div className="text-xs text-gray-500">• Last triggered: 2024-01-15 09:30:00</div>
        </div>
      </div>
    )}
  </div>
);

const LinkedItemsTab: React.FC = () => {
  const [selectedCaseModal, setSelectedCaseModal] = useState<string | null>(null);
  const [selectedAlertModal, setSelectedAlertModal] = useState<string | null>(null);
  const [selectedTransactionModal, setSelectedTransactionModal] = useState<string | null>(null);
  const [expandedTypologies, setExpandedTypologies] = useState<Set<string>>(new Set());

  const toggleTypology = (id: string) => {
    const newExpanded = new Set(expandedTypologies);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedTypologies(newExpanded);
  };

  // Mock data for modals
  const mockCaseData = {
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

  const mockAlertData = {
    alertId: 'A-001',
    dateTime: '2024-01-15 08:30:00',
    riskScore: 85,
    entity: 'John Doe',
    relatedItems: [
      {
        id: '1',
        type: 'case' as const,
        title: 'Case A-10023',
        description: 'Related investigation case'
      }
    ],
    typologyRules: [
      {
        id: '1',
        title: 'Suspicious Transaction Pattern',
        riskScore: 85,
        isExpanded: false
      }
    ]
  };

  const mockTransactionMessages = [
    {
      id: 'ADPSPKR28392',
      type: 'pacs.008',
      description: 'Increased Debtor Activity',
      isHighlighted: true
    },
    {
      id: 'ADPSPKR28393',
      type: 'pacs.002',
      description: 'Multiple Same-Amount Transfers',
      isHighlighted: false
    },
    {
      id: 'ADPSPKR28394',
      type: 'camt.056',
      description: 'Unusual Geographic Pattern',
      isHighlighted: true
    }
  ];

  return (
    <div className="space-y-6">
      <Section title="Related Items">
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-600">Related Cases</div>
            <LinkItem onClick={() => setSelectedCaseModal('A-10023')}>Case A-10023 – Investigation</LinkItem>
            <LinkItem onClick={() => setSelectedCaseModal('B-10024')}>Case B-10024 – Under Investigation</LinkItem>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-600">Related Alerts</div>
            <LinkItem onClick={() => setSelectedAlertModal('A-001')}>
              A-001 – Alert Type 1<Pill>Active</Pill>
            </LinkItem>
            <LinkItem onClick={() => setSelectedAlertModal('A-002')}>
              A-002 – Alert Type 2<Pill>Closed</Pill>
            </LinkItem>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-600">Related Transactions</div>
            <LinkItem onClick={() => setSelectedTransactionModal('ADPSPKR28392')}>ADPSPKR28392 – Increased Debtor Activity</LinkItem>
            <LinkItem onClick={() => setSelectedTransactionModal('ADPSPKR28393')}>ADPSPKR28393 – Multiple Same-Amount Transfers</LinkItem>
            <LinkItem onClick={() => setSelectedTransactionModal('ADPSPKR28394')}>ADPSPKR28394 – Unusual Geographic Pattern</LinkItem>
          </div>
        </div>
      </Section>

      <Section title="Typologies Triggered">
        <div className="space-y-2">
          <TypologyItem 
            id="typology-1"
            title="False promotions, phishing, or social engineering scams" 
            score={85} 
            isExpanded={expandedTypologies.has('typology-1')}
            onToggle={() => toggleTypology('typology-1')}
          />
          <TypologyItem 
            id="typology-2"
            title="Duplication of payments from a single account" 
            score={75} 
            isExpanded={expandedTypologies.has('typology-2')}
            onToggle={() => toggleTypology('typology-2')}
          />
        </div>
      </Section>

      {/* Modals */}
      <RelatedCaseModal
        isOpen={selectedCaseModal !== null}
        onClose={() => setSelectedCaseModal(null)}
        caseData={selectedCaseModal ? mockCaseData : null}
      />

      <RelatedAlertModal
        isOpen={selectedAlertModal !== null}
        onClose={() => setSelectedAlertModal(null)}
        alertData={selectedAlertModal ? mockAlertData : null}
      />

      <TransactionMessagesModal
        isOpen={selectedTransactionModal !== null}
        onClose={() => setSelectedTransactionModal(null)}
        transactionId={selectedTransactionModal || ''}
        messages={selectedTransactionModal ? mockTransactionMessages : []}
      />
    </div>
  );
};

export default LinkedItemsTab;
