import React from 'react';
import { EyeIcon, CheckIcon, UserPlusIcon, XCircleIcon } from '@heroicons/react/24/outline';
import type { CaseForSupervisor } from '../services/supervisorService';

interface SupervisorCasesTableProps {
  cases: CaseForSupervisor[];
  onReview: (caseData: CaseForSupervisor) => void;
  onApprove: (caseData: CaseForSupervisor) => void;
  onAssign: (caseData: CaseForSupervisor) => void;
  onCloseCase?: (caseData: CaseForSupervisor) => void;
}

const SupervisorCasesTable: React.FC<SupervisorCasesTableProps> = ({
  cases,
  onReview,
  onApprove,
  onAssign,
  onCloseCase
}) => {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Case ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Investigator
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {cases.map((caseData) => (
              <tr key={caseData.case_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {caseData.case_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {caseData.case_type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    caseData.status.includes('CLOSED') 
                      ? 'bg-gray-100 text-gray-800'
                      : caseData.status.includes('PENDING')
                      ? 'bg-yellow-100 text-yellow-800'
                      : caseData.status.includes('PROGRESS')
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {caseData.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    caseData.priority === 'URGENT' || caseData.priority === 'CRITICAL' 
                      ? 'bg-red-100 text-red-800'
                      : caseData.priority === 'NEW'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {caseData.priority}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {caseData.investigator_name || caseData.owner_name || 'Unassigned'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(caseData.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onReview(caseData)}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500"
                    >
                      <EyeIcon className="h-4 w-4 mr-1" />
                      Review
                    </button>
                    
                    {/* Assign button - show for all cases except closed ones */}
                    {!caseData.status.includes('CLOSED') && (
                      <button
                        onClick={() => onAssign(caseData)}
                        className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
                      >
                        <UserPlusIcon className="h-4 w-4 mr-1" />
                        Assign
                      </button>
                    )}
                    
                    {/* Close Case button - show for cases in progress */}
                    {onCloseCase && (caseData.status === 'STATUS_10_ASSIGNED' || caseData.status === 'STATUS_20_IN_PROGRESS') && (
                      <button
                        onClick={() => onCloseCase(caseData)}
                        className="inline-flex items-center px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 focus:ring-2 focus:ring-red-500"
                      >
                        <XCircleIcon className="h-4 w-4 mr-1" />
                        Close
                      </button>
                    )}
                    
                    {/* Approve button - show for cases pending approval */}
                    {caseData.status === 'STATUS_22_PENDING_FINAL_APPROVAL' && caseData.approval_task_id && (
                      <button
                        onClick={() => onApprove(caseData)}
                        className="inline-flex items-center px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 focus:ring-2 focus:ring-green-500"
                      >
                        <CheckIcon className="h-4 w-4 mr-1" />
                        Approve
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {cases.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">No cases found</p>
        </div>
      )}
    </div>
  );
};

export default SupervisorCasesTable;
