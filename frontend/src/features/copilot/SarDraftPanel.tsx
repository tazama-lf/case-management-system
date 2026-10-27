import React from 'react';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import SarReviewPanel from './SarReviewPanel';
import CheckedTextView from './CheckedTextView';
import FeedbackButtons from './FeedbackButtons';
import { GovernanceReportButton } from './GovernanceReportPanel';
import {
  copilotService,
  download,
  modelLabel,
  provenanceLabel,
  sarNarrative,
  type ReviewState,
  type SarDraft,
} from './copilotService';

interface Props {
  caseId: number;
}

/** SAR/STR drafting agent (backlog P3-2): narrative and goAML XML from the copilot's stored investigation record. */
const SarDraftPanel: React.FC<Props> = ({ caseId }) => {
  const [draft, setDraft] = React.useState<SarDraft | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [showXml, setShowXml] = React.useState(false);
  const [approved, setApproved] = React.useState(false);
  const onReview = React.useCallback((r: ReviewState) => {
    setApproved(r.status === 'APPROVED' || r.status === 'FILED');
  }, []);

  React.useEffect(() => {
    if (!caseId) return;
    copilotService
      .latestSar(caseId)
      .then(setDraft)
      .catch(() => {
        setDraft(null);
      });
  }, [caseId]);

  const run = (refresh: boolean): void => {
    setBusy(true);
    setErr(null);
    copilotService
      .draftSar(caseId, refresh)
      .then((d) => {
        setDraft(d);
      })
      .catch((e: unknown) => {
        setErr(
          e instanceof Error ? e.message : 'The draft could not be created.',
        );
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">
            Draft the SAR/STR with the copilot
          </h4>
          <p className="text-[11px] text-gray-600">
            Built from the case's investigation record
            {draft?.facts
              ? ` (record ${draft.investigationRecordId}, ${draft.facts.length} facts)`
              : ''}
            . Review and edit before filing; the FIU portal remains the filing
            channel.
          </p>
        </div>
        <div className="flex gap-2">
          <GovernanceReportButton />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              run(false);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <SparklesIcon className="h-4 w-4" />
            )}
            {draft ? 'Draft again' : 'Draft SAR/STR'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              run(true);
            }}
            title="Re-run the copilot on the latest case data first"
            className="rounded-md border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 disabled:opacity-50"
          >
            Refresh facts and draft
          </button>
        </div>
      </div>

      {err && (
        <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {err}
        </div>
      )}
      {busy && (
        <div className="mt-2 text-xs text-gray-600">
          Retrieving facts for each section, drafting and checking. A small
          bundled model on CPU can take a few minutes.
        </div>
      )}

      {draft && (
        <div className="mt-3 space-y-3">
          <div className="text-[11px] text-gray-600">
            {modelLabel(draft.model)}
            {draft.provenance && (
              <div className="text-gray-400">
                Produced by {provenanceLabel(draft.provenance)}
              </div>
            )}
          </div>
          {draft.notice && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {draft.notice}
            </div>
          )}
          {draft.sections.map((s) => (
            <section key={s.key} className="rounded-md bg-white p-2.5">
              <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
                {s.title}
              </h5>
              <CheckedTextView text={s.text} facts={draft.facts ?? []} />
            </section>
          ))}
          <section className="rounded-md bg-white p-2.5">
            <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
              Indicators
            </h5>
            <ul className="list-disc pl-5 text-xs text-gray-700">
              {draft.indicators.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-md bg-white p-2.5">
            <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
              Checks before filing
            </h5>
            <ul className="space-y-0.5 text-xs">
              {draft.checks.map((c) => (
                <li key={c.name} className="flex items-start gap-1">
                  {c.ok ? (
                    <CheckCircleIcon className="mt-px h-4 w-4 text-green-600" />
                  ) : (
                    <ExclamationTriangleIcon className="mt-px h-4 w-4 text-amber-600" />
                  )}
                  <span>
                    <span className="font-medium">{c.name}</span>: {c.detail}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <FeedbackButtons caseId={caseId} recordId={draft.id} />
          <SarReviewPanel caseId={caseId} draftId={draft.id} onState={onReview} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                download(
                  `STR-case-${draft.caseId}.txt`,
                  sarNarrative(draft),
                  'text/plain',
                );
              }}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs"
            >
              <ArrowDownTrayIcon className="h-4 w-4" /> Narrative (.txt)
            </button>
            <button
              type="button"
              disabled={!approved}
              title={approved ? undefined : 'Available once a supervisor approves the draft'}
              onClick={() => {
                download(
                  `goAML-STR-case-${draft.caseId}.xml`,
                  draft.goamlXml,
                  'application/xml',
                );
              }}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs disabled:opacity-40"
            >
              <ArrowDownTrayIcon className="h-4 w-4" /> goAML XML
            </button>
            <button
              type="button"
              onClick={() => {
                setShowXml((v) => !v);
              }}
              className="rounded-md px-2 py-1.5 text-xs text-indigo-700 underline"
            >
              {showXml ? 'Hide XML' : 'Show XML'}
            </button>
          </div>
          {showXml && (
            <pre className="max-h-72 overflow-auto rounded-md bg-gray-900 p-2 text-[10px] text-gray-100">
              {draft.goamlXml}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export default SarDraftPanel;
