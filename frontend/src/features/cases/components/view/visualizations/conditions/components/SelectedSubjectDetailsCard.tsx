import React from 'react';

type SubjectLevel = 'ENTITY' | 'ACCOUNT';

interface SubjectDetails {
  entityName?: string;
  entityId?: string;
  accountId?: string;
  accountType?: string;
  accountNumber?: string;
}

interface SelectedSubjectDetailsCardProps {
  subjectDetails: SubjectDetails | null;
  subjectLevel: SubjectLevel;
  activeBlocksCount: number;
}

export const SelectedSubjectDetailsCard: React.FC<SelectedSubjectDetailsCardProps> = ({
  subjectDetails,
  subjectLevel,
  activeBlocksCount,
}) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs font-semibold text-gray-500">SELECTED SUBJECT DETAILS</div>
      <div className="mt-3 space-y-3">
        <div>
          <div className="text-xs text-gray-500">Entity Name</div>
          <div className="text-sm font-medium text-gray-900">{subjectDetails?.entityName || '-'}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Entity ID</div>
          <div className="inline-flex rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
            {subjectDetails?.entityId || '-'}
          </div>
        </div>
        {subjectLevel === 'ACCOUNT' && (
          <>
            <div>
              <div className="text-xs text-gray-500">Account Type</div>
              <div className="text-sm font-medium text-gray-900">{subjectDetails?.accountType || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Account ID</div>
              <div className="inline-flex rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                {subjectDetails?.accountId || '-'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Account Number</div>
              <div className="text-sm font-medium text-gray-900">{subjectDetails?.accountNumber || '-'}</div>
            </div>
          </>
        )}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-500">Active Blocks</div>
          <div className="text-sm font-semibold text-red-600">{activeBlocksCount}</div>
        </div>
        <div className="mt-2 h-1.5 w-full rounded bg-gray-200">
          <div
            className="h-1.5 rounded bg-red-500"
            style={{ width: `${Math.min(activeBlocksCount * 20, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
