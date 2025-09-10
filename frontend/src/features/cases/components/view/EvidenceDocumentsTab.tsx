import React from 'react';

const EvidenceDocumentsTab: React.FC = () => {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        <div className="text-3xl text-gray-400">⬆️</div>
        <button className="text-indigo-600 hover:text-indigo-700">Upload Documents</button>
        <div className="text-sm text-gray-500">Upload any supporting documents</div>
      </div>
    </div>
  );
};

export default EvidenceDocumentsTab;
