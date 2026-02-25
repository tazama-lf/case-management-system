import React from 'react';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';

const EvidenceDocumentsTab: React.FC = () => (
  <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center">
    <div className="mx-auto flex max-w-md flex-col items-center gap-3">
      <ArrowUpTrayIcon className="h-12 w-12 text-gray-400" />
      <button className="text-indigo-600 hover:text-indigo-700">
        Upload Documents
      </button>
      <div className="text-sm text-gray-500">
        Upload any supporting documents
      </div>
    </div>
  </div>
);

export default EvidenceDocumentsTab;
