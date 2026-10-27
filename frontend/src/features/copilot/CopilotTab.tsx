import React from 'react';
import { ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';
import CheckedTextView from './CheckedTextView';
import AgentTracePanel from './AgentTracePanel';
import CaseChat from './CaseChat';
import FeedbackButtons from './FeedbackButtons';
import { GovernanceReportButton } from './GovernanceReportPanel';
import {
  copilotService,
  modelLabel,
  provenanceLabel,
  type CopilotModelInfo,
  type InvestigationRecord,
} from './copilotService';

interface Props {
  caseId: number;
}

const ModelStatus: React.FC<{ status: CopilotModelInfo | null }> = ({
  status,
}) => (
  <div className="text-xs text-gray-600">
    <span className="font-semibold text-gray-800">Investigation copilot</span> ·
    advisory only, the investigator decides ·{' '}
    {status ? modelLabel(status) : 'model status unknown'}
    {status && status.mode !== 'off' && status.reachable === false && (
      <span className="text-amber-700">
        {' '}
        (not reachable: answers will be written by code)
      </span>
    )}
  </div>
);

/** Investigation copilot (backlog P4-2): summary, red flags, next steps and questions, all cited to case facts. */
const CopilotTab: React.FC<Props> = ({ caseId }) => {
  const [status, setStatus] = React.useState<CopilotModelInfo | null>(null);
  const [record, setRecord] = React.useState<InvestigationRecord | null>(null);
  const [busy, setBusy] = React.useState<'load' | 'run' | null>('load');
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    Promise.all([
      copilotService.status().catch(() => null),
      copilotService.latest(caseId).catch(() => null),
    ])
      .then(([s, r]) => {
        if (!live) return;
        setStatus(s);
        setRecord(r);
      })
      .finally(() => {
        if (live) setBusy(null);
      });
    return () => {
      live = false;
    };
  }, [caseId]);

  const fail =
    (fallback: string) =>
    (e: unknown): void => {
      setErr(e instanceof Error ? e.message : fallback);
    };

  const run = (): void => {
    setBusy('run');
    setErr(null);
    copilotService
      .investigate(caseId)
      .then((r) => {
        setRecord(r);
      })
      .catch(fail('The copilot could not read this case.'))
      .finally(() => {
        setBusy(null);
      });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
        <ModelStatus status={status} />
        <div className="flex items-center gap-2">
          <GovernanceReportButton />
          <button
            type="button"
            onClick={run}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy === 'run' ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <SparklesIcon className="h-4 w-4" />
            )}
            {record ? 'Re-run on latest case data' : 'Run copilot on this case'}
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {err}
        </div>
      )}
      {busy === 'load' && <div className="text-xs text-gray-500">Loading…</div>}
      {busy === 'run' && (
        <div className="text-xs text-gray-500">
          Reading the case, computing facts and writing findings. A small
          bundled model on CPU can take a few minutes.
        </div>
      )}
      {!record && busy === null && (
        <div className="text-sm text-gray-600">
          The copilot has not been run on this case yet.
        </div>
      )}

      {record && (
        <>
          {record.notice && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {record.notice}
            </div>
          )}
          <section>
            <h4 className="mb-1 text-sm font-semibold text-gray-900">
              Summary
            </h4>
            <CheckedTextView text={record.summary} facts={record.facts} />
          </section>
          <section>
            <h4 className="mb-1 text-sm font-semibold text-gray-900">
              Red flags
            </h4>
            <CheckedTextView
              text={record.redFlags}
              facts={record.facts}
              asList
            />
          </section>
          <section>
            <h4 className="mb-1 text-sm font-semibold text-gray-900">
              Suggested next steps
            </h4>
            <CheckedTextView
              text={record.nextSteps}
              facts={record.facts}
              asList
            />
          </section>

          <div className="flex flex-wrap items-start justify-between gap-2">
            <FeedbackButtons caseId={caseId} recordId={record.id} />
            {record.provenance && (
              <span className="text-[11px] text-gray-400">
                Produced by {provenanceLabel(record.provenance)}
              </span>
            )}
          </div>

          {record.agent && <AgentTracePanel agent={record.agent} />}

          <CaseChat caseId={caseId} facts={record.facts} recordId={record.id} />

          <details className="rounded-md border border-gray-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-900">
              Case facts the copilot used ({record.facts.length}) · record{' '}
              {record.id}, {new Date(record.createdAt).toLocaleString()}
            </summary>
            <p className="mt-1 text-[11px] text-gray-500">
              Computed by code from CMS data and stored with their embeddings (
              {record.model.embeddings}). The SAR/STR draft is built from this
              record.
            </p>
            <ol className="mt-2 space-y-1 text-xs text-gray-700">
              {record.facts.map((f) => (
                <li key={f.id}>
                  <span className="font-semibold text-indigo-700">{f.id}</span>{' '}
                  <span className="text-gray-400">[{f.kind}]</span> {f.text}
                  <span className="text-gray-400"> · {f.source}</span>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </div>
  );
};

export default CopilotTab;
