import React from 'react';

interface MetricsProps {
  typologiesCount: number;
  rulesCount: number;
  averageScore: number;
}

export const Metrics: React.FC<MetricsProps> = ({
  typologiesCount,
  rulesCount,
  averageScore,
}) => {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-xs font-medium text-gray-500 uppercase mb-1">
          Typologies Triggered
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-900">{typologiesCount}</span>
          {typologiesCount > 0 && (
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
          )}
        </div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-xs font-medium text-gray-500 uppercase mb-1">
          Rules Extracted
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-900">{rulesCount}</span>
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
          <span className="text-2xl font-bold text-gray-900">{averageScore}</span>
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
  );
};
