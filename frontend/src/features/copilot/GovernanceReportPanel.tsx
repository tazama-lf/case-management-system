import React from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import authService from '@/features/auth/services/authService';
import { copilotService, type GovernanceReport } from './copilotService';

const WEEK = 7;
const MONTH = 30;
const QUARTER = 90;
const PERIODS = [WEEK, MONTH, QUARTER];
const PERCENT = 100;

const KIND_LABELS: Record<string, string> = {
  INVESTIGATION: 'Investigation runs',
  ASK: 'Chat answers',
  SAR_DRAFT: 'SAR/STR drafts',
  SAR_REVIEW: 'Review steps',
  FEEDBACK: 'Feedback',
};

const REVIEW_LABELS: Record<string, string> = {
  SUBMIT: 'Submitted',
  RETURN: 'Returned',
  APPROVE: 'Approved',
  WITHDRAW: 'Withdrawn',
  FILE: 'Filed',
};

/** Supervisors and compliance officers oversee the copilot, so the report is theirs. */
export const canSeeGovernance = (): boolean =>
  authService.hasAnyRole(['CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER']);

const day = (iso: string): string => new Date(iso).toLocaleDateString();

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section className="rounded-md border border-gray-200 p-3">
    <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-700">
      {title}
    </h5>
    {children}
  </section>
);

const ChainStatus: React.FC<{ chain: GovernanceReport['chain'] }> = ({
  chain,
}) => {
  const older = chain.unchained
    ? ` ${chain.unchained} older records were written before the chain existed and have no hash.`
    : '';
  return chain.ok ? (
    <div className="flex items-start gap-1.5 rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">
      <CheckCircleIcon className="mt-px h-4 w-4 flex-none" />
      <span>
        Record chain intact: {chain.checked} records checked
        {chain.head && (
          <>
            , newest hash{' '}
            <code
              title={chain.head}
              className="inline-block max-w-28 truncate align-bottom"
            >
              {chain.head}
            </code>
          </>
        )}
        .{older}
      </span>
    </div>
  ) : (
    <div className="flex items-start gap-1.5 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
      <ExclamationTriangleIcon className="mt-px h-4 w-4 flex-none" />
      <span>
        Record chain broken at record {chain.brokenAt ?? 'unknown'}:{' '}
        {chain.reason ?? 'no reason given'}. {chain.checked} records before it
        checked.{older}
      </span>
    </div>
  );
};

/** The report itself, without loading or the modal around it. */
export const GovernanceReportView: React.FC<{ report: GovernanceReport }> = ({
  report,
}) => {
  const w = report.writing;
  const judged = w.sentencesKept + w.sentencesRemoved;
  const kinds = Object.entries(report.records);
  const reviews = Object.entries(report.review);
  return (
    <div className="space-y-3 text-xs text-gray-700">
      <p className="text-gray-500">
        Tenant {report.tenantId}, {day(report.from)} to {day(report.to)}
      </p>
      <ChainStatus chain={report.chain} />

      <Section title="Records">
        {kinds.length ? (
          <div className="flex flex-wrap gap-2">
            {kinds.map(([kind, n]) => (
              <div key={kind} className="rounded-md bg-gray-50 px-2.5 py-1.5">
                <div className="text-base font-semibold text-gray-900">{n}</div>
                <div className="text-[11px] text-gray-500">
                  {KIND_LABELS[kind] ?? kind}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No copilot records in this period.</p>
        )}
      </Section>

      <Section title="Models and prompts">
        {report.models.length ? (
          <table className="w-full text-left">
            <thead className="text-[11px] text-gray-500">
              <tr>
                <th className="pb-1 font-medium">Mode</th>
                <th className="pb-1 font-medium">Model served</th>
                <th className="pb-1 font-medium">Build</th>
                <th className="pb-1 font-medium">Prompts</th>
                <th className="pb-1 font-medium">Strategy</th>
                <th className="pb-1 text-right font-medium">Records</th>
              </tr>
            </thead>
            <tbody>
              {report.models.map((m) => (
                <tr
                  key={`${m.provider}-${m.file ?? m.model ?? ''}-${m.build ?? ''}-${m.promptVersion}-${m.strategy}`}
                  className="border-t border-gray-100"
                >
                  <td className="py-1">{m.provider}</td>
                  <td className="py-1">{m.file ?? m.model ?? 'none'}</td>
                  <td className="py-1">{m.build ?? ''}</td>
                  <td className="py-1 font-mono">{m.promptVersion}</td>
                  <td className="py-1">{m.strategy}</td>
                  <td className="py-1 text-right">{m.records}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500">No model use recorded.</p>
        )}
      </Section>

      <Section title="Writing and checks">
        <p>
          {w.modelParts} parts written by the model, {w.codeParts} by code.{' '}
          {judged
            ? `${w.sentencesKept} model sentences kept and ${w.sentencesRemoved} removed by the checks (${Math.round((w.sentencesKept / judged) * PERCENT)}% kept).`
            : 'No model sentences were checked.'}
        </p>
        {w.removalReasons.length ? (
          <ul className="mt-1.5 space-y-0.5">
            {w.removalReasons.map((r) => (
              <li key={r.reason}>
                <span className="font-semibold">{r.count}</span> {r.reason}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-1.5 text-gray-500">
          Agent runs: {report.agent.runs}, of which {report.agent.fellBack} fell
          back to the standard pipeline.
        </p>
      </Section>

      <Section title="Feedback from users">
        <p>
          {report.feedback.up} useful, {report.feedback.down} not useful.
        </p>
        {report.feedback.recent.length ? (
          <ul className="mt-1.5 space-y-1">
            {report.feedback.recent.map((f) => (
              <li key={`${f.recordId}-${f.at}`}>
                <span
                  className={
                    f.rating === 'up' ? 'text-green-700' : 'text-red-700'
                  }
                >
                  {f.rating === 'up' ? 'Useful' : 'Not useful'}
                </span>{' '}
                · record {f.recordId}, {day(f.at)}
                {f.comment && (
                  <span className="text-gray-600">: “{f.comment}”</span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title="SAR/STR review">
        {reviews.length ? (
          <p>
            {reviews
              .map(([action, n]) => `${REVIEW_LABELS[action] ?? action} ${n}`)
              .join(' · ')}
          </p>
        ) : (
          <p className="text-gray-500">No review steps in this period.</p>
        )}
      </Section>
    </div>
  );
};

/** The governance report in a dialog over the task, with a choice of period. */
const GovernanceReportPanel: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const [days, setDays] = React.useState(MONTH);
  const [report, setReport] = React.useState<GovernanceReport | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    setReport(null);
    setErr(null);
    copilotService
      .governance(days)
      .then((r) => {
        if (live) setReport(r);
      })
      .catch((e: unknown) => {
        if (live) {
          setErr(
            e instanceof Error ? e.message : 'The report could not be loaded.',
          );
        }
      });
    return () => {
      live = false;
    };
  }, [days]);

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center overflow-y-auto bg-black/30 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Copilot governance report"
        className="w-full max-w-3xl rounded-lg bg-white p-4 shadow-xl"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <ShieldCheckIcon className="h-5 w-5 text-indigo-600" />
            Copilot governance report
          </h4>
          <div className="flex items-center gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setDays(p);
                }}
                className={`rounded-md px-2 py-1 text-xs ${p === days ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                {p} days
              </button>
            ))}
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="ml-2 rounded p-1 text-gray-500 hover:bg-gray-100"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        {err && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {err}
          </div>
        )}
        {!report && !err && (
          <div className="text-xs text-gray-500">Loading the report…</div>
        )}
        {report && <GovernanceReportView report={report} />}
      </div>
    </div>
  );
};

/** Opens the governance report; shown only to supervisors and compliance officers. */
export const GovernanceReportButton: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  if (!canSeeGovernance()) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
      >
        <ShieldCheckIcon className="h-4 w-4" /> Governance report
      </button>
      {open && (
        <GovernanceReportPanel
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
};

export default GovernanceReportPanel;
