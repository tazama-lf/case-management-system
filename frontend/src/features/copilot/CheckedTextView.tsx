import React from 'react';
import type { CheckedText, CopilotFact } from './copilotService';

interface Props {
  text: CheckedText;
  facts: CopilotFact[];
  asList?: boolean;
}

/** Sentences with their fact citations (hover a chip to see the fact), and what the checks removed. */
const CheckedTextView: React.FC<Props> = ({ text, facts, asList = false }) => {
  const byId = React.useMemo(
    () => new Map(facts.map((f) => [f.id, f])),
    [facts],
  );
  const chips = (cites: string[]): React.ReactNode =>
    cites.map((c) => (
      <span
        key={c}
        title={
          byId.get(c)
            ? `${c}: ${byId.get(c)!.text}\n\nSource: ${byId.get(c)!.source}`
            : c
        }
        className="ml-1 inline-block cursor-help rounded bg-indigo-50 px-1 text-[10px] font-semibold text-indigo-700 align-middle"
      >
        {c}
      </span>
    ));
  const items = text.sentences.map((s, i) => (
    <React.Fragment key={i}>
      {s.text}
      {chips(s.cites)}
    </React.Fragment>
  ));
  return (
    <div className="text-sm text-gray-800">
      {asList ? (
        <ul className="list-disc space-y-1 pl-5">
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      ) : (
        <p className="space-x-1 leading-relaxed">
          {items.map((it, i) => (
            <span key={i}>{it} </span>
          ))}
        </p>
      )}
      <div className="mt-1 text-[11px] text-gray-500">
        {text.writtenBy === 'model'
          ? 'Written by the model, every sentence checked against the cited facts.'
          : 'Written by code from the facts.'}
      </div>
      {Boolean(text.removed.length) && (
        <details className="mt-1 text-[11px] text-amber-700">
          <summary className="cursor-pointer">
            {text.removed.length} sentence(s) removed by the checks
          </summary>
          <ul className="mt-1 list-disc pl-5">
            {text.removed.map((s, i) => (
              <li key={i}>
                <span className="line-through">{s.text}</span> (
                {s.reasons.join('; ')})
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

export default CheckedTextView;
