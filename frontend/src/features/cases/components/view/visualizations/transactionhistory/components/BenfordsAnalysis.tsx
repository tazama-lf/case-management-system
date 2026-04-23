import React from 'react';

interface BenfordsAnalysisProps {
  digits: Array<{
    digit: number;
    expected: number;
    actual: number;
  }>;
}

export const BenfordsAnalysis: React.FC<BenfordsAnalysisProps> = ({
  digits,
}) => (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h4 className="text-sm font-semibold text-gray-900 mb-4">
        Benford's Law Analysis
      </h4>
      <div className="space-y-2">
        {digits.map((item) => (
          <div key={item.digit} className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900">
              Digit {item.digit}
            </span>
            <div className="flex items-center gap-4">
              <div className="w-48 bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: `${item.expected}%` }}
                />
              </div>
              <span className="text-xs text-gray-600 w-12">
                Expected: {item.expected}%
              </span>
              <span className="text-xs text-gray-600 w-12">
                Actual: {item.actual}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
