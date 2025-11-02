import React, { useState, Suspense, lazy } from 'react';
import { LoadingState } from '@/shared/components/ui';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const RelatedCaseModal = lazy(() => import('@/features/cases/components/modals/RelatedCaseModal'));
const RelatedAlertModal = lazy(() => import('@/features/cases/components/modals/RelatedAlertModal'));
const TransactionMessagesModal = lazy(() => import('@/features/cases/components/modals/TransactionMessagesModal'));
const MessagePayloadModal = lazy(() => import('@/features/alerts').then(module => ({ default: module.MessagePayloadModal })));

const getRiskThresholdLabel = (score: number): string => {
  return score > 80 ? 'High' : score > 60 ? 'Medium' : 'Low';
};


const createModalHandlers = <T,>(setter: React.Dispatch<React.SetStateAction<T | null>>) => ({
  open: (value: T) => setter(value),
  close: () => setter(null),
});

const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="text-center py-8">
    <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
    <h3 className="text-sm font-medium text-gray-900 mb-2">{title}</h3>
    <p className="text-sm text-gray-500">{description}</p>
  </div>
);

const ErrorBoundaryFallback: React.FC<{ error: string; onRetry?: () => void }> = ({ error, onRetry }) => (
  <div className="text-center py-8 border border-red-200 rounded-lg bg-red-50">
    <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
    <h3 className="text-sm font-medium text-red-900 mb-2">Something went wrong</h3>
    <p className="text-sm text-red-700 mb-4">{error}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
      >
        Try again
      </button>
    )}
  </div>
);

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
          <div className="text-xs text-gray-500">• Risk threshold: {getRiskThresholdLabel(score)}</div>
          <div className="text-xs text-gray-500">• Last triggered: 2024-01-15 09:30:00</div>
        </div>
      </div>
    )}
  </div>
);

// Broken down focused components
const RelatedCasesSection: React.FC<{
  cases: Array<{ id: string; title: string }>;
  onCaseClick: (id: string) => void;
}> = ({ cases, onCaseClick }) => (
  <div className="space-y-2">
    <div className="text-sm font-medium text-gray-600">Related Cases</div>
    {cases.length === 0 ? (
      <EmptyState title="No Related Cases" description="No related cases found for this item." />
    ) : (
      cases.map((caseItem) => (
        <LinkItem key={caseItem.id} onClick={() => onCaseClick(caseItem.id)}>
          {caseItem.title}
        </LinkItem>
      ))
    )}
  </div>
);

const RelatedAlertsSection: React.FC<{
  alerts: Array<{ id: string; title: string; status: string }>;
  onAlertClick: (id: string) => void;
}> = ({ alerts, onAlertClick }) => (
  <div className="space-y-2">
    <div className="text-sm font-medium text-gray-600">Related Alerts</div>
    {alerts.length === 0 ? (
      <EmptyState title="No Related Alerts" description="No related alerts found for this item." />
    ) : (
      alerts.map((alert) => (
        <LinkItem key={alert.id} onClick={() => onAlertClick(alert.id)}>
          {alert.title}<Pill>{alert.status}</Pill>
        </LinkItem>
      ))
    )}
  </div>
);

const RelatedTransactionsSection: React.FC<{
  transactions: Array<{ id: string; title: string }>;
  messagePayloads: Array<{ id: string; type: string }>;
  onTransactionClick: (id: string) => void;
  onMessagePayloadClick: (message: any) => void;
}> = ({ transactions, messagePayloads, onTransactionClick, onMessagePayloadClick }) => (
  <div className="space-y-2">
    <div className="text-sm font-medium text-gray-600">Related Transactions</div>
    {transactions.length === 0 ? (
      <EmptyState title="No Related Transactions" description="No related transactions found for this item." />
    ) : (
      <>
        {transactions.map((transaction) => (
          <LinkItem key={transaction.id} onClick={() => onTransactionClick(transaction.id)}>
            {transaction.title}
          </LinkItem>
        ))}
        <div className="mt-2 space-y-1">
          <div className="text-xs text-gray-500">Message Payloads:</div>
          {messagePayloads.map((message) => (
            <LinkItem key={message.id} onClick={() => onMessagePayloadClick(message)}>
              View {message.type} Payload
            </LinkItem>
          ))}
        </div>
      </>
    )}
  </div>
);

const TypologiesSection: React.FC<{
  typologies: Array<{ id: string; title: string; score: number }>;
  expandedTypologies: Set<string>;
  onToggleTypology: (id: string) => void;
}> = ({ typologies, expandedTypologies, onToggleTypology }) => (
  <Section title="Typologies Triggered">
    <div className="space-y-2">
      {typologies.length === 0 ? (
        <EmptyState title="No Typologies Triggered" description="No typology rules have been triggered for this item." />
      ) : (
        typologies.map((typology) => (
          <TypologyItem
            key={typology.id}
            id={typology.id}
            title={typology.title}
            score={typology.score}
            isExpanded={expandedTypologies.has(typology.id)}
            onToggle={() => onToggleTypology(typology.id)}
          />
        ))
      )}
    </div>
  </Section>
);

const ModalManager: React.FC<{
  selectedCaseModal: string | null;
  selectedAlertModal: string | null;
  selectedTransactionModal: string | null;
  selectedMessagePayload: any;
  caseModalHandlers: { close: () => void };
  alertModalHandlers: { close: () => void };
  transactionModalHandlers: { close: () => void };
  messagePayloadHandlers: { close: () => void };
  mockCaseData: any;
  mockAlertData: any;
  mockTransactionMessages: any[];
}> = ({
  selectedCaseModal,
  selectedAlertModal,
  selectedTransactionModal,
  selectedMessagePayload,
  caseModalHandlers,
  alertModalHandlers,
  transactionModalHandlers,
  messagePayloadHandlers,
  mockCaseData,
  mockAlertData,
  mockTransactionMessages,
}) => (
  <>
    <Suspense fallback={<div>Loading modal...</div>}>
      <RelatedCaseModal
        isOpen={selectedCaseModal !== null}
        onClose={caseModalHandlers.close}
        caseData={selectedCaseModal ? mockCaseData : null}
      />
    </Suspense>

    <Suspense fallback={<div>Loading modal...</div>}>
      <RelatedAlertModal
        isOpen={selectedAlertModal !== null}
        onClose={alertModalHandlers.close}
        alertData={selectedAlertModal ? mockAlertData : null}
      />
    </Suspense>

    <Suspense fallback={<div>Loading modal...</div>}>
      <TransactionMessagesModal
        isOpen={selectedTransactionModal !== null}
        onClose={transactionModalHandlers.close}
        transactionId={selectedTransactionModal || ''}
        messages={selectedTransactionModal ? mockTransactionMessages : []}
      />
    </Suspense>

    <Suspense fallback={<div>Loading modal...</div>}>
      <MessagePayloadModal
        isOpen={selectedMessagePayload !== null}
        onClose={messagePayloadHandlers.close}
        message={selectedMessagePayload}
      />
    </Suspense>
  </>
);

const useLinkedItemsState = () => {
  const [selectedCaseModal, setSelectedCaseModal] = useState<string | null>(null);
  const [selectedAlertModal, setSelectedAlertModal] = useState<string | null>(null);
  const [selectedTransactionModal, setSelectedTransactionModal] = useState<string | null>(null);
  const [selectedMessagePayload, setSelectedMessagePayload] = useState<any | null>(null);
  const [expandedTypologies, setExpandedTypologies] = useState<Set<string>>(new Set());
  const [isLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const caseModalHandlers = createModalHandlers(setSelectedCaseModal);
  const alertModalHandlers = createModalHandlers(setSelectedAlertModal);
  const transactionModalHandlers = createModalHandlers(setSelectedTransactionModal);
  const messagePayloadHandlers = createModalHandlers(setSelectedMessagePayload);

  const handleToggleTypology = (id: string) => {
    const newExpanded = new Set(expandedTypologies);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedTypologies(newExpanded);
  };

  return {
    selectedCaseModal,
    selectedAlertModal,
    selectedTransactionModal,
    selectedMessagePayload,
    expandedTypologies,
    isLoading,
    error,
    setError,
    caseModalHandlers,
    alertModalHandlers,
    transactionModalHandlers,
    messagePayloadHandlers,
    handleToggleTypology,
  };
};

const useMockData = () => {
  const relatedCases = [
    { id: 'A-10023', title: 'Case A-10023 – Investigation' },
    { id: 'B-10024', title: 'Case B-10024 – Under Investigation' }
  ];

  const relatedAlerts = [
    { id: 'A-001', title: 'A-001 – Alert Type 1', status: 'Active' },
    { id: 'A-002', title: 'A-002 – Alert Type 2', status: 'Closed' }
  ];

  const relatedTransactions = [
    { id: 'ADPSPKR28392', title: 'ADPSPKR28392 – Increased Debtor Activity' },
    { id: 'ADPSPKR28393', title: 'ADPSPKR28393 – Multiple Same-Amount Transfers' },
    { id: 'ADPSPKR28394', title: 'ADPSPKR28394 – Unusual Geographic Pattern' }
  ];

  const typologies = [
    { id: 'typology-1', title: 'False promotions, phishing, or social engineering scams', score: 85 },
    { id: 'typology-2', title: 'Duplication of payments from a single account', score: 75 }
  ];

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

  return {
    relatedCases,
    relatedAlerts,
    relatedTransactions,
    typologies,
    mockCaseData,
    mockAlertData,
    mockTransactionMessages,
  };
};

const LinkedItemsTab: React.FC = () => {
  const {
    selectedCaseModal,
    selectedAlertModal,
    selectedTransactionModal,
    selectedMessagePayload,
    expandedTypologies,
    isLoading,
    error,
    setError,
    caseModalHandlers,
    alertModalHandlers,
    transactionModalHandlers,
    messagePayloadHandlers,
    handleToggleTypology,
  } = useLinkedItemsState();

  const {
    relatedCases,
    relatedAlerts,
    relatedTransactions,
    typologies,
    mockCaseData,
    mockAlertData,
    mockTransactionMessages,
  } = useMockData();

  return (
    <LoadingState loading={isLoading} error={error} empty={!relatedCases.length && !relatedAlerts.length && !relatedTransactions.length}>
      {error ? (
        <ErrorBoundaryFallback error={error} onRetry={() => setError(null)} />
      ) : (
        <div className="space-y-6">
          <Section title="Related Items">
            <div className="space-y-6">
              <RelatedCasesSection 
                cases={relatedCases} 
                onCaseClick={caseModalHandlers.open} 
              />
              
              <RelatedAlertsSection 
                alerts={relatedAlerts} 
                onAlertClick={alertModalHandlers.open} 
              />
              
              <RelatedTransactionsSection 
                transactions={relatedTransactions}
                messagePayloads={mockTransactionMessages}
                onTransactionClick={transactionModalHandlers.open}
                onMessagePayloadClick={messagePayloadHandlers.open}
              />
            </div>
          </Section>

          <TypologiesSection 
            typologies={typologies}
            expandedTypologies={expandedTypologies}
            onToggleTypology={handleToggleTypology}
          />

          <ModalManager
            selectedCaseModal={selectedCaseModal}
            selectedAlertModal={selectedAlertModal}
            selectedTransactionModal={selectedTransactionModal}
            selectedMessagePayload={selectedMessagePayload}
            caseModalHandlers={caseModalHandlers}
            alertModalHandlers={alertModalHandlers}
            transactionModalHandlers={transactionModalHandlers}
            messagePayloadHandlers={messagePayloadHandlers}
            mockCaseData={mockCaseData}
            mockAlertData={mockAlertData}
            mockTransactionMessages={mockTransactionMessages}
          />
        </div>
      )}
    </LoadingState>
  );
};

export default LinkedItemsTab;
