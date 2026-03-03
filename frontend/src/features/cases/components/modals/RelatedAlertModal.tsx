import React from 'react';

interface RelatedItem {
  id: string;
  type: 'case' | 'alert';
  title: string;
  description: string;
}

interface TypologyRule {
  id: string;
  title: string;
  riskScore: number;
  isExpanded?: boolean;
}

interface RelatedAlertData {
  alertId: string;
  dateTime: string;
  riskScore?: number;
  entity: string;
  relatedItems: RelatedItem[];
  typologyRules: TypologyRule[];
}

interface RelatedAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  alertData: RelatedAlertData | null;
  onRelatedItemClick?: (item: RelatedItem) => void;
}

const RelatedAlertModal: React.FC<RelatedAlertModalProps> = ({
  isOpen,
  onClose,
  alertData,
  onRelatedItemClick,
}) => {
  if (!isOpen || !alertData) return null;

  const getRiskScoreColor = (score: number): string => {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
        {}
        <div className="sticky top-0 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Alert Details
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Alert Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Alert ID</span>
                    <span className="text-sm font-mono text-gray-900">
                      {alertData.alertId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Date/Time</span>
                    <span className="text-sm text-gray-900">
                      {alertData.dateTime}
                    </span>
                  </div>
                  {alertData.riskScore && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Risk Score</span>
                      <span
                        className={`text-sm font-medium ${getRiskScoreColor(alertData.riskScore)}`}
                      >
                        {alertData.riskScore}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Entity</span>
                    <span className="text-sm text-gray-900">
                      {alertData.entity}
                    </span>
                  </div>
                </div>
              </div>

              {}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Related Items
                </h3>
                <div className="space-y-2">
                  {alertData.relatedItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onRelatedItemClick?.(item)}
                      className="flex w-full items-center justify-between rounded-md border border-gray-200 p-3 text-left hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-3">
                        <svg
                          className="h-4 w-4 text-indigo-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                        <div>
                          <div className="text-sm font-medium text-indigo-700">
                            {item.title}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Transaction Data
                </h3>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">
                    Transaction data and payload information would be displayed
                    here based on the alert context.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Action History
                </h3>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">
                    Alert action history and timeline would be displayed here.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Rules & Typologies
            </h3>
            <div className="space-y-3">
              {alertData.typologyRules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-md border border-gray-200 bg-white"
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {rule.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Risk Score: {rule.riskScore}
                      </div>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                  {rule.isExpanded && (
                    <div className="border-t border-gray-200 p-4">
                      <p className="text-sm text-gray-600">
                        Detailed rule information and matching criteria would be
                        displayed here.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelatedAlertModal;
