import React, { useMemo, useState } from 'react';
import {
  UserMinusIcon,
  NoSymbolIcon,
  LockOpenIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { useInvestigatorSupervisorList } from '@/features/cases/hooks/useInvestigatorSupervisorList';
import {
  useCaseInvestigators,
  useCaseBlacklist,
  useRevokeInvestigator,
  useBlacklistInvestigator,
  useUnblockInvestigator,
} from '@/features/cases/hooks/useCaseInvestigators';
import type {
  CaseInvestigator,
  CaseInvestigatorMembership,
} from '@/features/cases/types/investigator.types';
import { formatDate } from '@/shared/utils/dateUtils';
import { LoadingSpinner, EmptyState, ErrorState } from '@/shared/components/ui';
import ReasonRequiredModal from '../modals/ReasonRequiredModal';

// Supervisor+ only, The whitelist has no manual-add
// path at all (it's populated exclusively by task assignment and case
// ownership), so there is nothing here for an investigator, on-case
// or not, to see or do.

interface AccessControlTabProps {
  caseId: number;
}

type PendingAction =
  | { type: 'revoke'; userId: string }
  | { type: 'blacklist'; userId: string }
  | { type: 'unblock'; userId: string }
  | null;

const membershipBadgeClass = (
  membership: CaseInvestigatorMembership,
): string =>
  membership === 'LEAD'
    ? 'bg-indigo-100 text-indigo-800'
    : 'bg-gray-100 text-gray-700';

const AccessControlTab: React.FC<AccessControlTabProps> = ({ caseId }) => {
  const { getAssigneeFullName } = useInvestigatorSupervisorList();

  const {
    data: whitelist = [],
    isLoading: whitelistLoading,
    isError: whitelistError,
    refetch: refetchWhitelist,
  } = useCaseInvestigators(caseId);

  const {
    data: blacklist = [],
    isLoading: blacklistLoading,
    isError: blacklistError,
    refetch: refetchBlacklist,
  } = useCaseBlacklist(caseId);

  const revokeInvestigator = useRevokeInvestigator(caseId);
  const blacklistInvestigator = useBlacklistInvestigator(caseId);
  const unblockInvestigator = useUnblockInvestigator(caseId);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  // Live rows only — defensive filter in case the endpoint ever returns
  // history alongside live rows; plan §6 says the tab starts with live
  // rows only, matching what the GET endpoints are specified to return.
  const liveWhitelist = useMemo(
    () => whitelist.filter((row) => !row.revoked_at),
    [whitelist],
  );
  const liveBlacklist = useMemo(
    () => blacklist.filter((row) => !row.unblocked_at),
    [blacklist],
  );

  const resolveName = (userId: string): string => {
    const name = getAssigneeFullName(userId);
    return name === 'N/A' ? userId : name;
  };

  const closePendingAction = (): void => {
    setPendingAction(null);
  };

  const handleConfirmPendingAction = async (reason: string): Promise<void> => {
    if (!pendingAction) return;

    if (pendingAction.type === 'revoke') {
      await revokeInvestigator.mutateAsync({
        userId: pendingAction.userId,
        reason,
      });
    } else if (pendingAction.type === 'blacklist') {
      await blacklistInvestigator.mutateAsync({
        userId: pendingAction.userId,
        reason,
      });
    } else {
      await unblockInvestigator.mutateAsync({
        userId: pendingAction.userId,
        reason,
      });
    }
  };

  const renderWhitelistRow = (row: CaseInvestigator): React.ReactNode => (
    <tr key={row.id} className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-4 text-sm text-gray-900">
        {resolveName(row.user_id)}
      </td>
      <td className="py-2 pr-4">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${membershipBadgeClass(row.membership)}`}
        >
          {row.membership}
        </span>
      </td>
      <td className="py-2 pr-4 text-sm text-gray-500">
        {resolveName(row.granted_by)}
      </td>
      <td className="py-2 pr-4 text-sm text-gray-500">
        {formatDate(row.granted_at)}
      </td>
      <td className="py-2 text-right">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setPendingAction({ type: 'revoke', userId: row.user_id });
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-50"
          >
            <UserMinusIcon className="h-4 w-4" />
            Revoke
          </button>
          <button
            type="button"
            onClick={() => {
              setPendingAction({ type: 'blacklist', userId: row.user_id });
            }}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            <NoSymbolIcon className="h-4 w-4" />
            Blacklist
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-8">
      {/* Whitelist — read-only; populated only by task assignment / case
          ownership (plan §3), there is no add action anywhere on this tab. */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">
            Case Investigators
          </h3>
        </div>

        {whitelistLoading && (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        )}

        {whitelistError && (
          <ErrorState
            title="Failed to load investigators"
            message="Could not load this case's access list."
            onRetry={() => {
              void refetchWhitelist();
            }}
          />
        )}

        {!whitelistLoading && !whitelistError && liveWhitelist.length === 0 && (
          <EmptyState
            icon="folder"
            title="No investigators on this case yet"
            description="Nobody currently has case-level access — assigning a task or setting a case owner will grant it."
          />
        )}

        {!whitelistLoading && !whitelistError && liveWhitelist.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4">Investigator</th>
                  <th className="py-2 pr-4">Tier</th>
                  <th className="py-2 pr-4">Granted By</th>
                  <th className="py-2 pr-4">Granted At</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>{liveWhitelist.map(renderWhitelistRow)}</tbody>
            </table>
          </div>
        )}
      </section>

      {/* Blacklist */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ShieldExclamationIcon className="h-5 w-5 text-red-600" />
          <h3 className="text-base font-semibold text-gray-900">Blacklist</h3>
        </div>

        {blacklistLoading && (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        )}

        {blacklistError && (
          <ErrorState
            title="Failed to load blacklist"
            message="Could not load this case's blacklist."
            onRetry={() => {
              void refetchBlacklist();
            }}
          />
        )}

        {!blacklistLoading && !blacklistError && liveBlacklist.length === 0 && (
          <EmptyState
            icon="exclamation"
            title="Nobody is blacklisted on this case"
          />
        )}

        {!blacklistLoading && !blacklistError && liveBlacklist.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Blocked By</th>
                  <th className="py-2 pr-4">Blocked At</th>
                  <th className="py-2 pr-4">Reason</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {liveBlacklist.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="py-2 pr-4 text-sm text-gray-900">
                      {resolveName(row.user_id)}
                    </td>
                    <td className="py-2 pr-4 text-sm text-gray-500">
                      {resolveName(row.blocked_by)}
                    </td>
                    <td className="py-2 pr-4 text-sm text-gray-500">
                      {formatDate(row.blocked_at)}
                    </td>
                    <td className="py-2 pr-4 text-sm text-gray-700">
                      {row.block_reason}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setPendingAction({
                            type: 'unblock',
                            userId: row.user_id,
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                      >
                        <LockOpenIcon className="h-4 w-4" />
                        Unblock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ReasonRequiredModal
        open={pendingAction?.type === 'revoke'}
        onClose={closePendingAction}
        onConfirm={handleConfirmPendingAction}
        title="Revoke Access"
        subtitle={pendingAction ? resolveName(pendingAction.userId) : undefined}
        description="This removes the investigator's access to this case. They can only regain it through a new task assignment or case ownership change — not by being re-added here."
        icon={<UserMinusIcon className="h-5 w-5 text-orange-600" />}
        iconWrapperClassName="bg-orange-100"
        reasonLabel="Reason for revocation"
        placeholder="Explain why this investigator's access is being revoked."
        confirmLabel="Revoke Access"
        confirmingLabel="Revoking…"
        confirmButtonClassName="bg-orange-600 hover:bg-orange-700 focus:ring-orange-500"
      />

      <ReasonRequiredModal
        open={pendingAction?.type === 'blacklist'}
        onClose={closePendingAction}
        onConfirm={handleConfirmPendingAction}
        title="Blacklist Investigator"
        subtitle={pendingAction ? resolveName(pendingAction.userId) : undefined}
        description="This revokes any current access and refuses future task assignments or case ownership changes for this person on this case, until a supervisor unblocks them."
        icon={<NoSymbolIcon className="h-5 w-5 text-red-600" />}
        iconWrapperClassName="bg-red-100"
        reasonLabel="Reason for blacklisting"
        placeholder="e.g. conflict of interest, under investigation, HR flag, legal exclusion."
        confirmLabel="Blacklist"
        confirmingLabel="Blacklisting…"
        confirmButtonClassName="bg-red-600 hover:bg-red-700 focus:ring-red-500"
      />

      <ReasonRequiredModal
        open={pendingAction?.type === 'unblock'}
        onClose={closePendingAction}
        onConfirm={handleConfirmPendingAction}
        title="Unblock Investigator"
        subtitle={pendingAction ? resolveName(pendingAction.userId) : undefined}
        description="This does not grant access back — a new task assignment or case ownership change is still required for this person to reappear on the whitelist."
        icon={<LockOpenIcon className="h-5 w-5 text-emerald-600" />}
        iconWrapperClassName="bg-emerald-100"
        reasonLabel="Reason for unblocking"
        placeholder="Explain why this person is being unblocked."
        confirmLabel="Unblock"
        confirmingLabel="Unblocking…"
        confirmButtonClassName="bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500"
      />
    </div>
  );
};

export default AccessControlTab;
