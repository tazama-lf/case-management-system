import React, { lazy, Suspense } from 'react';
import type { CaseRow } from '../casesTable.utils';
import type { Priority, AlertType } from '../CreateCaseModal';
import type {
  CloseCaseDto,
  ApproveCaseClosureDto,
  ReturnCaseForReviewDto,
  RejectCaseCreationDto,
} from '../../services/caseService';

const CloseCaseModal = lazy(async () => await import('../CloseCaseModal'));
const ApproveCaseReopenModal = lazy(
  async () => await import('../ApproveCaseReopenModal'),
);
const RejectCaseReopenModal = lazy(
  async () => await import('../RejectCaseReopenModal'),
);
const ReopenCaseModal = lazy(async () => await import('../ReopenCaseModal'));
const AbandonCaseModal = lazy(async () => await import('../AbandonCaseModal'));
const SuspendCaseModal = lazy(async () => await import('../SuspendCaseModal'));
const ResumeCaseModal = lazy(async () => await import('../ResumeCaseModal'));
const ApproveCaseCreationModal = lazy(
  async () => await import('../ApproveCaseCreationModal'),
);
const RejectCaseCreationModal = lazy(
  async () => await import('../RejectCaseCreationModal'),
);


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
    alertId?: number;
    priority: Priority;
    priorityScore: number;
    alertType: AlertType;
    assignee?: string;
    draft?: boolean;
  }) => Promise<void>;
  handleUpdate: (
    caseId: number,
    payload: {
      priority: Priority;
      priorityScore: number;
      alertType: AlertType;
      assignee?: string;
    },
  ) => Promise<void>;
  handleCloseCaseSubmit: (data: CloseCaseDto) => Promise<void>;
  handleReopenSubmit: (caseId: number, reason: string) => Promise<void>;
  handleAbandonSubmit: (caseId: number, reason: string) => Promise<void>;
  handleSuspendSubmit: (caseId: number, reason: string) => Promise<void>;
  handleResumeSubmit: (caseId: number, reason: string) => Promise<void>;
  handleRejectSubmit: (rejectionReason: string) => Promise<void>;
  handleApproveSubmit: (data: ApproveCaseClosureDto) => Promise<void>;
  handleApproveCreationSubmit: (caseId: number) => Promise<void>;
  handleRejectCreationSubmit: (
    caseId: number,
    data: RejectCaseCreationDto,
  ) => Promise<void>;
  handleReturnForReviewSubmit: (
    caseId: number,
    data: ReturnCaseForReviewDto,
  ) => Promise<void>;
  handleApproveReopenSubmit: (caseId: number) => Promise<void>;
  handleRejectReopenSubmit: (caseId: number, reason: string) => Promise<void>;
}

const CaseModals: React.FC<CaseModalsProps> = ({
  isCloseCaseOpen,
  isReopenOpen,
  isAbandonOpen,
  isSuspendOpen,
  isResumeOpen,
  isApproveCreationOpen,
  isRejectCreationOpen,
  isApproveReopenOpen,
  isRejectReopenOpen,

  setIsCloseCaseOpen,
  setIsReopenOpen,
  setIsAbandonOpen,
  setIsSuspendOpen,
  setIsResumeOpen,
  setIsApproveCreationOpen,
  setIsRejectCreationOpen,
  setIsApproveReopenOpen,
  setIsRejectReopenOpen,

  selectedRow,

  handleCloseCaseSubmit,
  handleReopenSubmit,
  handleAbandonSubmit,
  handleSuspendSubmit,
  handleResumeSubmit,
  handleApproveCreationSubmit,
  handleRejectCreationSubmit,
  handleApproveReopenSubmit,
  handleRejectReopenSubmit,
}) => {
  const ModalLoadingFallback = (): JSX.Element => (
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
            onClose={() => {
              setIsCloseCaseOpen(false);
            }}
            caseId={selectedRow?.id == null ? '' : selectedRow.id.toString()}
            caseName={selectedRow ? `${selectedRow.type} Case` : ''}
            onSubmit={handleCloseCaseSubmit}
          />
        </Suspense>
      )}

      {isReopenOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <ReopenCaseModal
            open={isReopenOpen}
            onClose={() => {
              setIsReopenOpen(false);
            }}
            onReopen={(...args) => { void handleReopenSubmit(...args); }}
            caseData={selectedRow}
          />
        </Suspense>
      )}

      {isAbandonOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <AbandonCaseModal
            open={isAbandonOpen}
            onClose={() => {
              setIsAbandonOpen(false);
            }}
            onAbandon={(...args) => { void handleAbandonSubmit(...args); }}
            caseData={selectedRow}
          />
        </Suspense>
      )}

      {isSuspendOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <SuspendCaseModal
            open={isSuspendOpen}
            onClose={() => {
              setIsSuspendOpen(false);
            }}
            onSuspend={(...args) => { void handleSuspendSubmit(...args); }}
            caseData={selectedRow}
          />
        </Suspense>
      )}

      {isResumeOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <ResumeCaseModal
            open={isResumeOpen}
            onClose={() => {
              setIsResumeOpen(false);
            }}
            onResume={(...args) => { void handleResumeSubmit(...args); }}
            caseData={selectedRow}
          />
        </Suspense>
      )}

      {isApproveCreationOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <ApproveCaseCreationModal
            open={isApproveCreationOpen}
            onClose={() => {
              setIsApproveCreationOpen(false);
            }}
            caseData={selectedRow}
            onSubmit={async (caseId) => {
              await handleApproveCreationSubmit(caseId);
            }}
          />
        </Suspense>
      )}

      {isRejectCreationOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <RejectCaseCreationModal
            open={isRejectCreationOpen}
            onClose={() => {
              setIsRejectCreationOpen(false);
            }}
            caseData={selectedRow}
            onSubmit={async (caseId, data) => {
              await handleRejectCreationSubmit(caseId, data);
            }}
          />
        </Suspense>
      )}

      {isApproveReopenOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <ApproveCaseReopenModal
            open={isApproveReopenOpen}
            onClose={() => {
              setIsApproveReopenOpen(false);
            }}
            caseId={selectedRow?.id ?? null}
            requesterRole={undefined}
            onApprove={handleApproveReopenSubmit}
          />
        </Suspense>
      )}

      {isRejectReopenOpen && (
        <Suspense fallback={<ModalLoadingFallback />}>
          <RejectCaseReopenModal
            open={isRejectReopenOpen}
            onClose={() => {
              setIsRejectReopenOpen(false);
            }}
            caseId={selectedRow?.id ?? null}
            onReject={handleRejectReopenSubmit}
          />
        </Suspense>
      )}
    </>
  );
};

export default CaseModals;
