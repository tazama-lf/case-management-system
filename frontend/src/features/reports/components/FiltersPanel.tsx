import React from 'react';

interface FiltersPanelProps {
  caseType: string;
  priority: string;
  investigator: string;
  onChange: (key: 'caseType' | 'priority' | 'investigator', value: string) => void;
  onApply: () => void;
  onReset: () => void;
}

const FiltersPanel: React.FC<FiltersPanelProps> = ({
  caseType,
  priority,
  investigator,
  onChange,
  onApply,
  onReset
}) => {
  return (
    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="text-sm font-medium text-gray-700 mb-3">Additional Filters</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Case Type</label>
          <select
            value={caseType}
            onChange={(e) => onChange('caseType', e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Types</option>
            <option value="FRAUD">Fraud</option>
            <option value="AML">AML</option>
            <option value="FRAUD_AND_AML">Fraud and AML</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => onChange('priority', e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Investigator</label>
          <select
            value={investigator}
            onChange={(e) => onChange('investigator', e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Investigators</option>
            <option value="name">Gerald Limbando</option>
            <option value="name">Jay Smith</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onReset}
          className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        >
          Reset Filters
        </button>
        <button
          onClick={onApply}
          className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
};

export default FiltersPanel;


