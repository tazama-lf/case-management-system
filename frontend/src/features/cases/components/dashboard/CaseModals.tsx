import React, { lazy, Suspense } from 'react';
import type { CaseRow } from '../casesTable.utils';
import type { Priority, AlertType } from '../CreateCaseModal';
import type {
  CloseCaseDto,
  ApproveCaseClosureDto,
  ReturnCaseForReviewDto,
  RejectCaseCreationDto,
} from '../../services/caseService';

const CloseCaseModal = lazy(() => import('../CloseCaseModal'));
const ApproveCaseReopenModal = lazy(() => import('../ApproveCaseReopenModal'));
const RejectCaseReopenModal = lazy(() => import('../RejectCaseReopenModal'));
const ReopenCaseModal = lazy(() => import('../ReopenCaseModal'));
const AbandonCaseModal = lazy(() => import('../AbandonCaseModal'));
const SuspendCaseModal = lazy(() => import('../SuspendCaseModal'));
const ResumeCaseModal = lazy(() => import('../ResumeCaseModal'));
// const RejectCaseModal = lazy(() => import('../RejectCaseModal'));
// const ApproveCaseModal = lazy(() => import('../ApproveCaseModal'));
const ApproveCaseCreationModal = lazy(
  () => import('../ApproveCaseCreationModal'),
);
const RejectCaseCreationModal = lazy(
  () => import('../RejectCaseCreationModal'),
);
// const ReturnCaseForReviewModal = lazy(() => import('../ReturnCaseForReviewModal'));

interface CaseModalsProps {
  isCloseCaseOpen: boolean;
  isReopenOpen: boolean;
  isAbandonOpen: boolean;
  isSuspendOpen: boolean;
  isResumeOpen: boolean;
  isRejectOpen: boolean;
  isApproveOpen: boolean;
  isApproveCreationOpen: boolean;
  isRejectCreationOpen: boolean;
  isReturnForReviewOpen: boolean;
  isApproveReopenOpen: boolean;
  isRejectReopenOpen: boolean;

  setIsCloseCaseOpen: (open: boolean) => void;
  setIsReopenOpen: (open: boolean) => void;
  setIsAbandonOpen: (open: boolean) => void;
  setIsSuspendOpen: (open: boolean) => void;
  setIsResumeOpen: (open: boolean) => void;
  setIsRejectOpen: (open: boolean) => void;
  setIsApproveOpen: (open: boolean) => void;
  setIsApproveCreationOpen: (open: boolean) => void;
  setIsRejectCreationOpen: (open: boolean) => void;
  setIsReturnForReviewOpen: (open: boolean) => void;
  setIsApproveReopenOpen: (open: boolean) => void;
  setIsRejectReopenOpen: (open: boolean) => void;

  selectedRow: CaseRow | null;

  handleCreate: (payload: {
    alertId?: string;
    priority: Priority;
    priorityScore: number;
    alertType: AlertType;
    assignee?: string;
    draft?: boolean;
  }) => Promise<void>;
  handleUpdate: (
    caseId: string,
    payload: {
      priority: Priority;
      priorityScore: number;
      alertType: AlertType;
      assignee?: string;
    },
  ) => Promise<void>;
  handleCloseCaseSubmit: (data: CloseCaseDto) => Promise<void>;
  handleReopenSubmit: (caseId: string, reason: string) => Promise<void>;
  handleAbandonSubmit: (caseId: string, reason: string) => Promise<void>;
  handleSuspendSubmit: (caseId: string, reason: string) => Promise<void>;
  handleResumeSubmit: (caseId: string, reason: string) => Promise<void>;
  handleRejectSubmit: (rejectionReason: string) => Promise<void>;
  handleApproveSubmit: (data: ApproveCaseClosureDto) => Promise<void>;
  handleApproveCreationSubmit: (caseId: string) => Promise<void>;
  handleRejectCreationSubmit: (
    caseId: string,
    data: RejectCaseCreationDto,
  ) => Promise<void>;
  handleReturnForReviewSubmit: (
    caseId: string,
    data: ReturnCaseForReviewDto,
  ) => Promise<void>;
  handleApproveReopenSubmit: (caseId: string) => Promise<void>;
  handleRejectReopenSubmit: (caseId: string, reason: string) => Promise<void>;
}

const CaseModals: React.FC<CaseModalsProps> = ({
  isCloseCaseOpen,
  isReopenOpen,
  isAbandonOpen,
  isSuspendOpen,
  isResumeOpen,
  // isRejectOpen,
  // isApproveOpen,
  isApproveCreationOpen,
  isRejectCreationOpen,
  // isReturnForReviewOpen,
  isApproveReopenOpen,
  isRejectReopenOpen,

  setIsCloseCaseOpen,
  setIsReopenOpen,
  setIsAbandonOpen,
  setIsSuspendOpen,
  setIsResumeOpen,
  // setIsRejectOpen,
  // setIsApproveOpen,
  setIsApproveCreationOpen,
  setIsRejectCreationOpen,
  // setIsReturnForReviewOpen,
  setIsApproveReopenOpen,
  setIsRejectReopenOpen,

  selectedRow,

  handleCloseCaseSubmit,
  handleReopenSubmit,
  handleAbandonSubmit,
  handleSuspendSubmit,
  handleResumeSubmit,
  // handleRejectSubmit,
  // handleApproveSubmit,
  handleApproveCreationSubmit,
  handleRejectCreationSubmit,
  // handleReturnForReviewSubmit,
  handleApproveReopenSubmit,
  handleRejectReopenSubmit,
}) => {
  const ModalLoadingFallback = () => (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isCloseCaseOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <CloseCaseModal
            open={isCloseCaseOpen}
            onClose={() => setIsCloseCaseOpen(false)}
            caseId={selectedRow?.id || ''}
            caseName={selectedRow ? `${selectedRow.type} Case` : ''}
            onSubmit={handleCloseCaseSubmit}
          />
        </Suspense>
      )}

      {isReopenOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <ReopenCaseModal
            open={isReopenOpen}
            onClose={() => setIsReopenOpen(false)}
            onReopen={handleReopenSubmit}
            caseData={selectedRow}
          />
        </Suspense>
      )}

      {isAbandonOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <AbandonCaseModal
            open={isAbandonOpen}
            onClose={() => setIsAbandonOpen(false)}
            onAbandon={handleAbandonSubmit}
            caseData={selectedRow}
          />
        </Suspense>
      )}

      {isSuspendOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <SuspendCaseModal
            open={isSuspendOpen}
            onClose={() => setIsSuspendOpen(false)}
            onSuspend={handleSuspendSubmit}
            caseData={selectedRow}
          />
        </Suspense>
      )}

      {isResumeOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <ResumeCaseModal
            open={isResumeOpen}
            onClose={() => setIsResumeOpen(false)}
            onResume={handleResumeSubmit}
            caseData={selectedRow}
          />
        </Suspense>
      )}

      {/* {isRejectOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <RejectCaseModal
            open={isRejectOpen}
            onClose={() => setIsRejectOpen(false)}
            caseId={selectedRow?.id || ''}
            caseName={selectedRow ? `${selectedRow.type} Case` : ''}
            onSubmit={handleRejectSubmit}
          />
        </Suspense>
      )} */}

      {/* {isApproveOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <ApproveCaseModal
            open={isApproveOpen}
            onClose={() => setIsApproveOpen(false)}
            caseId={selectedRow?.id || ''}
            caseName={selectedRow ? `${selectedRow.type} Case` : ''}
            recommendedOutcome={selectedRow?.status || ''}
            onSubmit={handleApproveSubmit}
          />
        </Suspense>
      )} */}

      {isApproveCreationOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <ApproveCaseCreationModal
            open={isApproveCreationOpen}
            onClose={() => setIsApproveCreationOpen(false)}
            caseData={selectedRow}
            onSubmit={(caseId) => handleApproveCreationSubmit(caseId)}
          />
        </Suspense>
      )}

      {isRejectCreationOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <RejectCaseCreationModal
            open={isRejectCreationOpen}
            onClose={() => setIsRejectCreationOpen(false)}
            caseData={selectedRow}
            onSubmit={(caseId, data) =>
              handleRejectCreationSubmit(caseId, data)
            }
          />
        </Suspense>
      )}

      {/* {isReturnForReviewOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <ReturnCaseForReviewModal
            open={isReturnForReviewOpen}
            onClose={() => setIsReturnForReviewOpen(false)}
            caseData={selectedRow}
            onSubmit={(caseId: string, data: ReturnCaseForReviewDto) => handleReturnForReviewSubmit(caseId, data)}
          />
        </Suspense>
      )} */}

      {isApproveReopenOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <ApproveCaseReopenModal
            open={isApproveReopenOpen}
            onClose={() => setIsApproveReopenOpen(false)}
            caseId={selectedRow?.id || ''}
            requesterRole={undefined}
            onApprove={handleApproveReopenSubmit}
          />
        </Suspense>
      )}

      {isRejectReopenOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <RejectCaseReopenModal
            open={isRejectReopenOpen}
            onClose={() => setIsRejectReopenOpen(false)}
            caseId={selectedRow?.id || ''}
            onReject={handleRejectReopenSubmit}
          />
        </Suspense>
      )}
    </>
  );
};

export default CaseModals;
