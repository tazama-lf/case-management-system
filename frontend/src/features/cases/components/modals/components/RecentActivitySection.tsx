import React from 'react';

interface ActivityItem {
  id: string;
  description: string;
  timestamp: string;
  user: string;
}

interface RecentActivitySectionProps {
  activities: ActivityItem[];
}

const RecentActivitySection: React.FC<RecentActivitySectionProps> = ({ activities }) => {
  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {activities.map((activity) => (
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
  );
};

export default RecentActivitySection;