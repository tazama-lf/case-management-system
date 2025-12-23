import React from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface AlertNavigatorTabProps {
  caseId?: string;
  transactionId?: string;
}

interface TypologyRule {
  description: string;
  details: string;
}

interface Typology {
  name: string;
  score: number;
  rules: TypologyRule[];
  expanded?: boolean;
}

const AlertNavigatorTab: React.FC<AlertNavigatorTabProps> = ({
  caseId: _caseId,
  transactionId: _transactionId,
}) => {
  const [typologies, setTypologies] = React.useState<Typology[]>([
    {
      name: 'Structuring / Smurfing',
      score: 85,
      expanded: true,
      rules: [
        {
          description: 'Multiple transactions below reporting threshold',
          details: 'Weight: 35% | Value: 6 transactions | Threshold: 8 threshold',
        },
        {
          description: 'Transaction amounts just below threshold',
          details: 'Weight: 35% | Value: $9,800 Ave | Threshold: > $2,500',
        },
        {
          description: 'Short time window',
          details: 'Weight: 30% | Value: 45 hours | Threshold: < 72 hours',
        },
      ],
    },
    {
      name: 'Rapid Movement of Funds',
      score: 72,
      expanded: false,
      rules: [
        {
          description: 'Rapid successive transfers',
          details: 'Weight: 40% | Value: 4 transfers | Threshold: > 3',
        },
      ],
    },
    {
      name: 'Unusual Geographic Pattern',
      score: 58,
      expanded: false,
      rules: [
        {
          description: 'High-risk jurisdiction',
          details: 'Weight: 60% | Value: Yes | Threshold: Flagged',
        },
      ],
    },
  ]);

  const toggleTypology = (index: number) => {
    setTypologies((prev) =>
      prev.map((typ, i) =>
        i === index ? { ...typ, expanded: !typ.expanded } : typ
      )
    );
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'bg-red-500';
    if (score >= 60) return 'bg-orange-500';
    return 'bg-yellow-500';
  };

  const getScoreTextColor = (score: number): string => {
    if (score >= 80) return 'text-red-700';
    if (score >= 60) return 'text-orange-700';
    return 'text-yellow-700';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Alert Navigator</h3>
        <span className="inline-flex items-center rounded-md px-3 py-1 text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-200">
          Blocked
        </span>
      </div>

      <p className="text-sm text-gray-600">
        Investigate alert details, typologies, and related information
      </p>

      {/* Alert Metadata */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Alert Metadata</h4>
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">
              Alert ID
            </div>
            <div className="text-sm font-medium text-gray-900">
              ALT-2027-88234
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">
              Timestamp
            </div>
            <div className="text-sm font-medium text-gray-900">
              2024-01-15 14:23:01 UTC
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">
              Transaction Type
            </div>
            <div className="text-sm font-medium text-gray-900">
              Wire Transfer
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">
              Entity
            </div>
            <div className="text-sm font-medium text-blue-600">
              Binance
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">
              Transaction ID
            </div>
            <div className="text-sm font-medium text-gray-900">
              TXN-30308112-788510
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">
              Reason
            </div>
            <div className="text-sm text-gray-900">
              Multiple high-value transactions to high-risk jurisdiction
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-xs font-medium text-gray-500 uppercase mb-1">
              Block Reason
            </div>
            <div className="text-sm text-gray-900">
              Automatic block - Sanctions screening match detected
            </div>
          </div>
        </div>
      </div>

      {/* Triggered Typologies & Rules */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">
          Triggered Typologies & Rules
        </h4>
        <div className="space-y-3">
          {typologies.map((typology, index) => (
            <div
              key={index}
              className="rounded-lg border border-gray-200 bg-gray-50"
            >
              <button
                onClick={() => toggleTypology(index)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  {typology.expanded ? (
                    <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                  )}
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        typology.score >= 80
                          ? 'bg-red-500'
                          : typology.score >= 60
                          ? 'bg-orange-500'
                          : 'bg-yellow-500'
                      }`}
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {typology.name}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold ${getScoreTextColor(
                      typology.score
                    )}`}
                  >
                    Score: {typology.score}
                  </span>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getScoreColor(
                        typology.score
                      )}`}
                      style={{ width: `${typology.score}%` }}
                    />
                  </div>
                </div>
              </button>
              {typology.expanded && (
                <div className="px-4 pb-4 space-y-2 border-t border-gray-200 pt-3 bg-white">
                  {typology.rules.map((rule, ruleIndex) => (
                    <div key={ruleIndex} className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                      </div>
                      <div>
                        <div className="text-sm text-gray-900">
                          {rule.description}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {rule.details}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">
            Typologies Triggered
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">2</span>
            <svg
              className="h-4 w-4 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">
            Rules Passed
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">6</span>
            <svg
              className="h-5 w-5 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">
            Avg Score
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">72</span>
            <svg
              className="h-5 w-5 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertNavigatorTab;
