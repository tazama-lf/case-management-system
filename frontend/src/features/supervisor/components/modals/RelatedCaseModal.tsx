import React from 'react';

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

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'investigation':
        return 'bg-blue-100 text-blue-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      case 'open':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold text-gray-900">Case Details</h2>
              <button className="flex items-center space-x-2 rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Collaborate</span>
              </button>
              <button className="rounded-md border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Case Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Case Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Creation Date</span>
                    <span className="text-sm text-gray-900">{caseData.caseInformation.creationDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Assignment Date</span>
                    <span className="text-sm text-gray-900">{caseData.caseInformation.assignmentDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(caseData.caseInformation.status)}`}>
                      {caseData.caseInformation.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Priority</span>
                    <span className={`text-sm font-medium ${getPriorityColor(caseData.caseInformation.priority)}`}>
                      {caseData.caseInformation.priority}
                    </span>
                  </div>
                </div>
              </div>

              {/* Debtor Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Debtor Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Name</span>
                    <span className="text-sm text-gray-900">{caseData.debtorInformation.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Account ID</span>
                    <span className="text-sm text-gray-900">{caseData.debtorInformation.accountId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">FSP</span>
                    <span className="text-sm text-gray-900">{caseData.debtorInformation.fsp}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Creditor Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Creditor Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Name</span>
                    <span className="text-sm text-gray-900">{caseData.creditorInformation.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Account ID</span>
                    <span className="text-sm text-gray-900">{caseData.creditorInformation.accountId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">FSP</span>
                    <span className="text-sm text-gray-900">{caseData.creditorInformation.fsp}</span>
                  </div>
                </div>
              </div>

              {/* Block/Allow List Status */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Block/Allow List Status</h3>
                <select 
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  defaultValue={caseData.blockAllowListStatus}
                >
                  <option value="Not Listed">Not Listed</option>
                  <option value="Blocked">Blocked</option>
                  <option value="Allowed">Allowed</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Pending Investigation">Pending Investigation</option>
                </select>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {caseData.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-gray-300"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500">{activity.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelatedCaseModal;
