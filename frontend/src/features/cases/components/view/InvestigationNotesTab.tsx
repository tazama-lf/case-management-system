import React from 'react';

const InvestigationNotesTab: React.FC = () => {
  const [notes, setNotes] = React.useState('');

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-gray-700">Investigation Notes</div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add your investigation notes here..."
        rows={8}
        className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />

      <div className="flex items-center justify-end gap-3">
        <button className="rounded-md border bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50">Mark as Not Fraud</button>
        <button className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700">Mark as Fraud</button>
      </div>
    </div>
  );
};

export default InvestigationNotesTab;
