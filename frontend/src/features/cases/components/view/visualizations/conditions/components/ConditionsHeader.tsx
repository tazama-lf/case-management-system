import React from 'react';

interface ConditionsHeaderProps {
  activeCount: number;
  timeRange: string;
  timeRangeOptions: string[];
  onChangeTimeRange: (value: string) => void;
  showInactive: boolean;
  onToggleShowInactive: () => void;
}

export const ConditionsHeader: React.FC<ConditionsHeaderProps> = ({
  activeCount,
  timeRange,
  timeRangeOptions,
  onChangeTimeRange,
  showInactive,
  onToggleShowInactive,
}) => {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="flex items-baseline gap-2">
          <div className="text-lg font-semibold text-gray-900">Conditions</div>
          <div className="text-xs text-gray-500">({activeCount} active)</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={timeRange}
          onChange={(e) => onChangeTimeRange(e.target.value)}
          className="h-10 px-3 border border-gray-200 rounded-lg bg-white text-sm font-medium text-gray-900 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {timeRangeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onToggleShowInactive}
          className="inline-flex h-10 items-center gap-2 text-sm font-medium text-gray-700"
        >
          <span>Show Inactive</span>
          <span
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              showInactive ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                showInactive ? 'translate-x-4' : 'translate-x-1'
              }`}
            />
          </span>
        </button>
      </div>
    </div>
  );
};
