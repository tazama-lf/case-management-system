<<<<<<< HEAD
import React, { useState } from 'react';
import { PageContainer } from '../../../shared/components/ui';
import SupervisorCasesTable from '../components/SupervisorCasesTable';
import CreateCaseModal from '../components/CreateCaseModal';
import ViewCaseModal from '../components/ViewCaseModal';
import AssignCaseModal from '../components/AssignCaseModal';

const SupervisorDashboard: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Mock case data for modals - matching CaseRow type
  const mockCaseData = {
    id: parseInt(selectedCaseId?.replace('C-', '') || '0'),
    type: 'Fraud',
    typeColor: 'bg-red-100 text-red-800 ring-red-600/20',
    status: 'Pending Approval',
    statusColor: 'bg-yellow-100 text-yellow-800 ring-yellow-600/20',
    typologyId: 'TYP-001',
    score: 130,
    createdOn: '2024-01-15',
    pickedOn: '2024-01-16',
    action: 'View' as const,
    reassignEnabled: true,
    assignee: 'John Smith'
  };

  const handleCreateCase = () => {
    setShowCreateModal(true);
  };

  const handleReview = (caseId: string) => {
    setSelectedCaseId(caseId);
    setShowReviewModal(true);
  };

  const handleAssign = (caseId: string) => {
    setSelectedCaseId(caseId);
    setShowAssignModal(true);
  };

  const handleCreateCaseSubmit = (payload: any) => {
    console.log('Creating case:', payload);
    // TODO: Implement actual case creation API call
    setShowCreateModal(false);
  };

  const handleAssignSubmit = (row: any, assignee: string, justification?: string) => {
    console.log('Assigning case:', row.id, 'to:', assignee, 'reason:', justification);
    // TODO: Implement actual assignment API call
    setShowAssignModal(false);
  };

  return (
    <PageContainer
      title="Supervisor Dashboard"
      subtitle="Review and manage cases requiring supervisor approval"
    >
      <SupervisorCasesTable 
        onReview={handleReview}
        onAssign={handleAssign}
        onCreateCase={handleCreateCase}
      />

      {/* Modals */}
      <CreateCaseModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateCaseSubmit}
      />

      <ViewCaseModal
        open={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        row={selectedCaseId ? mockCaseData : null}
      />

      <AssignCaseModal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onAssign={handleAssignSubmit}
        row={selectedCaseId ? mockCaseData : null}
      />
=======
import React from 'react';
import { PageContainer, Card } from '../../../shared/components/ui';

const SupervisorDashboard: React.FC = () => {
  return (
    <PageContainer
      title="Supervisor Dashboard"
      subtitle="Oversee team performance and case assignments"
    >
      <Card>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Team Management
        </h2>
        <p className="text-gray-600">
          Supervisor dashboard functionality coming soon. This will include:
        </p>
        <ul className="mt-4 space-y-2 text-gray-600">
          <li>• Team performance metrics</li>
          <li>• Case assignment management</li>
          <li>• Workload distribution</li>
          <li>• Team productivity reports</li>
          <li>• Escalation management</li>
        </ul>
      </Card>
>>>>>>> b610ca14c62be40a6b4464adec8d2995e9c999d7
    </PageContainer>
  );
};

export default SupervisorDashboard;
