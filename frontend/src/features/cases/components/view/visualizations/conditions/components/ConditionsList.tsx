import React from 'react';

interface ConditionListItem {
  id: number;
  title: string;
  type: string;
  startDate: string;
  endDate: string | null;
  status: string;
  severity: 'high' | 'medium' | 'low';
}

interface ConditionsListProps {
  conditions: ConditionListItem[];
}

export const ConditionsList: React.FC<ConditionsListProps> = ({ conditions }) => {
  const getSeverityColor = (severity: string): string => {
    switch (severity.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-3">
      {conditions.map((condition) => (
        <div
          key={condition.id}
          className="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-medium text-gray-900">{condition.title}</h4>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(condition.severity)}`}>
              {condition.severity}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">{condition.type}</span>
            <span>{condition.startDate} {condition.endDate && `- ${condition.endDate}`}</span>
            <span className="text-xs font-medium text-blue-600">{condition.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
