import React from 'react';
import {
  reviewService,
  type ReviewAction,
  type ReviewState,
  type ReviewStatus,
} from './copilotService';

interface Props {
  caseId: number;
  /** Changes when a new draft is made, which starts a new review. */
  draftId: number;
  onState: (s: ReviewState) => void;
}

const STATUS: Record<ReviewStatus, { label: string; tone: string }> = {
  DRAFT: { label: 'Draft, not submitted', tone: 'bg-gray-100 text-gray-700' },
  IN_REVIEW: {
    label: 'Waiting for supervisor approval',
    tone: 'bg-amber-100 text-amber-800',
  },
  RETURNED: {
    label: 'Returned for changes',
    tone: 'bg-red-100 text-red-800',
  },
  APPROVED: {
    label: 'Approved, ready to file',
    tone: 'bg-green-100 text-green-800',
  },
  FILED: { label: 'Filed with the FIU', tone: 'bg-blue-100 text-blue-800' },
};

const BUTTON: Record<ReviewAction, { label: string; primary: boolean }> = {
  SUBMIT: { label: 'Submit for approval', primary: true },
  APPROVE: { label: 'Approve', primary: true },
  RETURN: { label: 'Return for changes', primary: false },
  WITHDRAW: { label: 'Withdraw', primary: false },
  FILE: { label: 'Record as filed', primary: true },
};

/** Maker-checker review of a SAR/STR draft (CIMS Part 2, 2.4.1): nothing is filed until a supervisor approves. */
const SarReviewPanel: React.FC<Props> = ({ caseId, draftId, onState }) => {
  const [state, setState] = React.useState<ReviewState | null>(null);
  const [comment, setComment] = React.useState('');
  const [reference, setReference] = React.useState('');
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const apply = React.useCallback(
    (s: ReviewState) => {
      setState(s);
      onState(s);
    },
    [onState],
  );

  React.useEffect(() => {
    setComment('');
    setReference('');
    reviewService
      .state(caseId)
      .then(apply)
      .catch(() => {
        setState(null);
      });
  }, [caseId, draftId, apply]);

  if (!state) return null;
  const mine = state.allowed.filter((a) => a.role === state.yourRole);
  const waitingOnOther = !mine.length && state.status !== 'FILED';

  const act = (action: ReviewAction): void => {
    setBusy(true);
    setErr(null);
    reviewService
      .act(caseId, action, comment, reference)
      .then((s) => {
        apply(s);
        setComment('');
        setReference('');
      })
      .catch((e: unknown) => {
        setErr(e instanceof Error ? e.message : 'That step could not be taken.');
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <section className="rounded-md bg-white p-2.5">
      <div className="mb-1 flex items-center justify-between">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
          Review and approval
        </h5>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS[state.status].tone}`}
        >
          {STATUS[state.status].label}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-gray-500">
        The investigator reviews the draft and submits it. A different person,
        the supervisor, approves it or returns it with a reason. Only an
        approved draft can be filed.
      </p>

      {Boolean(state.events.length) && (
        <ol className="mb-2 space-y-1 border-l-2 border-gray-200 pl-3 text-xs">
          {state.events.map((e) => (
            <li key={e.id}>
              <span className="font-medium">{BUTTON[e.action].label}</span> by{' '}
              {e.actorName}{' '}
              <span className="text-gray-500">
                {new Date(e.at).toLocaleString()}
              </span>
              {e.comment && <div className="text-gray-700">{e.comment}</div>}
              {e.reference && (
                <div className="text-gray-700">FIU reference: {e.reference}</div>
              )}
            </li>
          ))}
        </ol>
      )}

      {Boolean(mine.length) && (
        <div className="space-y-2">
          {mine.some((a) => a.action === 'FILE') && (
            <input
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
              }}
              placeholder="FIU acknowledgement or reference number"
              aria-label="FIU reference"
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
          )}
          <textarea
            value={comment}
            rows={2}
            maxLength={2000}
            onChange={(e) => {
              setComment(e.target.value);
            }}
            placeholder={
              mine.some((a) => a.action === 'RETURN')
                ? 'Comment (required when returning for changes)'
                : 'Comment (optional)'
            }
            aria-label="Review comment"
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
          />
          <div className="flex flex-wrap gap-2">
            {mine.map((a) => (
              <button
                key={a.action}
                type="button"
                disabled={busy}
                onClick={() => {
                  act(a.action);
                }}
                className={
                  BUTTON[a.action].primary
                    ? 'rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50'
                    : 'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs disabled:opacity-50'
                }
              >
                {BUTTON[a.action].label}
              </button>
            ))}
          </div>
        </div>
      )}
      {waitingOnOther && (
        <p className="text-xs text-gray-600">
          {state.status === 'IN_REVIEW' || state.status === 'RETURNED'
            ? 'Waiting for the other role to act. '
            : ''}
          {state.status === 'APPROVED' && 'Waiting for the filing to be recorded.'}
        </p>
      )}
      {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
    </section>
  );
};

export default SarReviewPanel;
