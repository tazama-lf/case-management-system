import React from 'react';

interface CaseInformation {
  creationDate: string;
  assignmentDate: string;
  status: string;
  priority: string;
}

interface CaseInformationCardProps {
  caseInformation: CaseInformation;
}

const CaseInformationCard: React.FC<CaseInformationCardProps> = ({ caseInformation }) => {
  const getPriorityColor = (priority: string) => {
    const priorityColors = {
      high: 'text-red-600',
      medium: 'text-yellow-600', 
      low: 'text-green-600'
    };
    return priorityColors[priority.toLowerCase() as keyof typeof priorityColors] || 'text-gray-600';
  };

  const getStatusColor = (status: string) => {
    const statusColors = {
      investigation: 'bg-blue-100 text-blue-800',
      closed: 'bg-gray-100 text-gray-800',
      open: 'bg-green-100 text-green-800'
    };
    return statusColors[status.toLowerCase() as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  const informationItems = [
    { label: 'Creation Date', value: caseInformation.creationDate },
    { label: 'Assignment Date', value: caseInformation.assignmentDate },
    { 
      label: 'Status', 
      value: (
        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(caseInformation.status)}`}>
          {caseInformation.status}
        </span>
      )
    },
    { 
      label: 'Priority', 
      value: (
        <span className={`text-sm font-medium ${getPriorityColor(caseInformation.priority)}`}>
          {caseInformation.priority}
        </span>
      )
    }
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Case Information</h3>
      <div className="space-y-3">
        {informationItems.map((item) => (
          <div key={item.label} className="flex justify-between">
            <span className="text-sm text-gray-600">{item.label}</span>
            <span className="text-sm text-gray-900">
              {typeof item.value === 'string' ? item.value : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CaseInformationCard;