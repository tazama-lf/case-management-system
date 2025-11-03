import React from 'react';
import {
  CaseInformationCard,
  PersonInformationCard,
  BlockAllowListStatus,
  RecentActivitySection,
  ModalHeader
} from './components';

interface CaseInformation {
  creationDate: string;
  assignmentDate: string;
  status: string;
  priority: string;
}

interface PersonInformation {
  name: string;
  accountId: string;
  fsp: string;
}

interface ActivityItem {
  id: string;
  description: string;
  timestamp: string;
  user: string;
}

interface RelatedCaseData {
  caseId: string;
  caseInformation: CaseInformation;
  debtorInformation: PersonInformation;
  creditorInformation: PersonInformation;
  blockAllowListStatus: string;
  recentActivity: ActivityItem[];
}

interface RelatedCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: RelatedCaseData | null;
}

const RelatedCaseModal: React.FC<RelatedCaseModalProps> = ({
  isOpen,
  onClose,
  caseData
}) => {
  if (!isOpen || !caseData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        <ModalHeader onClose={onClose} />

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <CaseInformationCard caseInformation={caseData.caseInformation} />
              <PersonInformationCard 
                title="Debtor Information" 
                personInformation={caseData.debtorInformation} 
              />
            </div>

            <div className="space-y-6">
              <PersonInformationCard 
                title="Creditor Information" 
                personInformation={caseData.creditorInformation} 
              />
              <BlockAllowListStatus status={caseData.blockAllowListStatus} />
            </div>
          </div>

          <RecentActivitySection activities={caseData.recentActivity} />
        </div>
      </div>
    </div>
  );
};

export default RelatedCaseModal;
