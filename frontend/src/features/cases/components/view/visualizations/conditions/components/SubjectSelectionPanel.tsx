import React from 'react';

type SubjectSide = 'DEBTOR' | 'CREDITOR';
type SubjectLevel = 'ENTITY' | 'ACCOUNT';

interface SubjectSelectionPanelProps {
  subjectSide: SubjectSide;
  onChangeSide: (side: SubjectSide) => void;
  subjectLevel: SubjectLevel;
  onChangeLevel: (level: SubjectLevel) => void;
  accountsAvailable: number;
}

export const SubjectSelectionPanel: React.FC<SubjectSelectionPanelProps> = ({
  subjectSide,
  onChangeSide,
  subjectLevel,
  onChangeLevel,
  accountsAvailable,
}) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs font-semibold text-gray-500">SUBJECT SELECTION</div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChangeSide('DEBTOR')}
          className={`rounded-md border px-3 py-2 text-sm font-medium ${
            subjectSide === 'DEBTOR'
              ? 'border-blue-600 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Debtor
        </button>
        <button
          type="button"
          onClick={() => onChangeSide('CREDITOR')}
          className={`rounded-md border px-3 py-2 text-sm font-medium ${
            subjectSide === 'CREDITOR'
              ? 'border-blue-600 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Creditor
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={() => onChangeLevel('ENTITY')}
          className={`w-full rounded-md border px-3 py-3 text-left ${
            subjectLevel === 'ENTITY'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <div className="text-sm font-semibold text-gray-900">Entity Level</div>
          <div className="text-xs text-gray-500">Legal Entity Conditions</div>
        </button>
        <button
          type="button"
          onClick={() => onChangeLevel('ACCOUNT')}
          className={`w-full rounded-md border px-3 py-3 text-left ${
            subjectLevel === 'ACCOUNT'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <div className="text-sm font-semibold text-gray-900">Account Level</div>
          <div className="text-xs text-gray-500">{accountsAvailable} accounts available</div>
        </button>
      </div>
    </div>
  );
};
