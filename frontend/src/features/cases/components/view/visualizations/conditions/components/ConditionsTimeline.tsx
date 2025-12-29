import React from 'react';

interface TimelineEvent {
  id: number;
  label: string;
  color: string;
}

interface ConditionsTimelineProps {
  events: TimelineEvent[];
}

export const ConditionsTimeline: React.FC<ConditionsTimelineProps> = ({ events }) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h4 className="text-sm font-semibold text-gray-900 mb-4">Timeline</h4>
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {events.map((event) => (
          <div
            key={event.id}
            className={`${event.color} px-3 py-2 rounded-lg border text-xs font-medium text-gray-900 whitespace-nowrap`}
          >
            {event.label}
          </div>
        ))}
      </div>
    </div>
  );
};
