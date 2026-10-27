import React from 'react';
import { HandThumbDownIcon, HandThumbUpIcon } from '@heroicons/react/24/outline';
import { copilotService, type FeedbackRating } from './copilotService';

interface Props {
  caseId: number;
  /** The investigation record, chat answer (askId) or SAR draft being rated. */
  recordId: number;
}

const MAX_COMMENT = 1000;

/** Thumbs up or down on a copilot output, with an optional comment on a thumbs down. Stored for the governance report. */
const FeedbackButtons: React.FC<Props> = ({ caseId, recordId }) => {
  const [commenting, setCommenting] = React.useState(false);
  const [comment, setComment] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCommenting(false);
    setComment('');
    setSent(false);
    setErr(null);
  }, [recordId]);

  const send = (rating: FeedbackRating, text?: string): void => {
    const note = text?.trim() ?? '';
    setSending(true);
    setErr(null);
    copilotService
      .feedback(caseId, recordId, rating, note === '' ? undefined : note)
      .then(() => {
        setSent(true);
      })
      .catch((e: unknown) => {
        setErr(
          e instanceof Error ? e.message : 'The feedback could not be saved.',
        );
      })
      .finally(() => {
        setSending(false);
      });
  };

  if (sent) {
    return <span className="text-[11px] text-gray-500">Thanks, recorded.</span>;
  }

  return (
    <div className="text-[11px] text-gray-600">
      <div className="flex items-center gap-1">
        <span>Was this useful?</span>
        <button
          type="button"
          aria-label="Useful"
          title="Useful"
          disabled={sending}
          onClick={() => {
            send('up');
          }}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-green-700 disabled:opacity-50"
        >
          <HandThumbUpIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Not useful"
          title="Not useful"
          disabled={sending}
          onClick={() => {
            setCommenting(true);
          }}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-red-700 disabled:opacity-50"
        >
          <HandThumbDownIcon className="h-4 w-4" />
        </button>
      </div>
      {commenting && (
        <div className="mt-1 flex items-start gap-2">
          <textarea
            aria-label="What was wrong?"
            placeholder="What was wrong? (optional)"
            value={comment}
            maxLength={MAX_COMMENT}
            rows={2}
            onChange={(e) => {
              setComment(e.target.value);
            }}
            className="w-64 rounded-md border border-gray-300 px-2 py-1 text-xs"
          />
          <button
            type="button"
            disabled={sending}
            onClick={() => {
              send('down', comment);
            }}
            className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Send
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => {
              setCommenting(false);
              setComment('');
            }}
            className="px-1 py-1 text-xs text-gray-500"
          >
            Cancel
          </button>
        </div>
      )}
      {err && <div className="mt-1 text-red-700">{err}</div>}
    </div>
  );
};

export default FeedbackButtons;
