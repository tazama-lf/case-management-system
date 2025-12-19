import React from 'react';
import {DocumentTextIcon,} from '@heroicons/react/24/outline';

const InvestigationsSummaryTab: React.FC = () => {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-blue-200 bg-blue-100 p-4">
        <h3 className="mb-3 text-sm font-bold text-blue-900">Recomended Outcome</h3>
        <div className="grid grid-cols-2 gap-4">
            <label className="block text-xs font-medium text-blue-800">Confirmed Fraud</label>
        </div>
      </section>

      <div className="text-sm font-semibold text-gray-900">Investigation Notes</div>

      <section className="rounded-lg border border-gray-200 bg-gray-100 p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500">Investigation Notes</label>
          </div>
        </div>
      </section>
      <div className="text-sm font-semibold text-gray-900">Evidence Summary</div>

<section className="rounded-lg border border-gray-200 bg-gray-100 p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <DocumentTextIcon className="h-12 w-12 text-blue-300 mx-auto mb-3" />
            <label className="block text-xs font-medium text-gray-500">Evidence Summary</label>
          </div>
        </div>
      </section>
    </div>
  );
};

export default InvestigationsSummaryTab;
