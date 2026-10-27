import React from 'react';
import { ArrowUpIcon } from '@heroicons/react/24/solid';
import AgentTracePanel from './AgentTracePanel';
import CheckedTextView from './CheckedTextView';
import {
  copilotService,
  type AskResult,
  type CopilotFact,
} from './copilotService';

interface Props {
  caseId: number;
  facts: CopilotFact[];
  /** Changes when the copilot is re-run, which starts a new conversation. */
  recordId: number;
}

interface Turn {
  id: number;
  q: string;
  a?: AskResult;
  error?: string;
}

const MAX_QUESTION = 500;
const MAX_SUGGESTIONS = 4;
const SUGGESTIONS = [
  'Where did the money go after it arrived?',
  'How old is the account?',
  'What did screening find?',
  'Which counterparties are new?',
  'What should I check next?',
];

/** Questions about the case, answered from the facts closest to each question in the stored record. */
const CaseChat: React.FC<Props> = ({ caseId, facts, recordId }) => {
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setTurns([]);
  }, [recordId]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [turns, busy]);

  const ask = (text: string): void => {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput('');
    const id = Date.now();
    setTurns((prev) => [...prev, { id, q }]);
    copilotService
      .ask(caseId, q)
      .then((a) => {
        setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, a } : t)));
      })
      .catch((e: unknown) => {
        const error =
          e instanceof Error
            ? e.message
            : 'The question could not be answered.';
        setTurns((prev) =>
          prev.map((t) => (t.id === id ? { ...t, error } : t)),
        );
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const asked = new Set(turns.map((t) => t.q));
  const suggestions = SUGGESTIONS.filter((s) => !asked.has(s)).filter(
    (_, i) => i < MAX_SUGGESTIONS,
  );

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <h4 className="text-sm font-semibold text-gray-900">
          Ask about this case
        </h4>
        <span className="text-[11px] text-gray-500">
          Answers come only from this case&apos;s facts and cite them
        </span>
      </div>

      <div className="max-h-[28rem] space-y-3 overflow-y-auto px-3 py-3">
        {!turns.length && (
          <p className="text-xs text-gray-500">
            Ask anything about this case, or start with a suggestion below.
          </p>
        )}
        {turns.map((t) => (
          <div key={t.id} className="space-y-2">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-3 py-2 text-sm text-white">
                {t.q}
              </div>
            </div>
            <div className="flex gap-2">
              <div className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-md bg-indigo-100 text-[11px] font-bold text-indigo-700">
                AI
              </div>
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-gray-50 px-3 py-2">
                {t.a && (
                  <>
                    {t.a.notice && (
                      <div className="mb-1 text-[11px] text-amber-700">
                        {t.a.notice}
                      </div>
                    )}
                    <CheckedTextView text={t.a.answer} facts={facts} />
                    {t.a.agent && (
                      <div className="mt-2">
                        <AgentTracePanel agent={t.a.agent} />
                      </div>
                    )}
                  </>
                )}
                {t.error && (
                  <div className="text-xs text-red-700">{t.error}</div>
                )}
                {!t.a && !t.error && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
                    Finding the facts that answer this…
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t border-gray-100 px-3 py-2">
        {Boolean(suggestions.length) && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => {
                  ask(s);
                }}
                className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-gray-700 hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex items-end gap-2 rounded-xl border border-gray-300 px-2 py-1.5 focus-within:border-indigo-500"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <textarea
            value={input}
            rows={1}
            maxLength={MAX_QUESTION}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder="Ask a question about this case…"
            className="max-h-32 flex-1 resize-none border-0 bg-transparent py-1 text-sm outline-none focus:ring-0"
            aria-label="Question about this case"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Ask"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-indigo-600 text-white disabled:opacity-40"
          >
            <ArrowUpIcon className="h-4 w-4" />
          </button>
        </form>
      </div>
    </section>
  );
};

export default CaseChat;
