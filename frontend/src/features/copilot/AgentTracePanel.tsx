import React from 'react';
import type { AgentTrace } from './copilotService';

const STOPPED: Record<AgentTrace['stopped'], string> = {
  answered: 'The model answered.',
  step_limit: 'Stopped at the step limit.',
  tool_limit: 'Stopped at the tool-call limit.',
  timeout: 'Stopped at the time limit.',
  model_failed: 'The model did not respond.',
};

const SINGLE = 1;

const argsText = (args: unknown): string => {
  const text = JSON.stringify(args);
  return text === '{}' ? '' : text;
};

/** How the agent strategy got to its findings: which tools it called, what each returned, and whether it fell back. */
const AgentTracePanel: React.FC<{ agent: AgentTrace }> = ({ agent }) => (
  <details className="rounded-md bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700">
    <summary className="cursor-pointer font-medium">
      How this was produced: the agent made {agent.calls.length}{' '}
      {agent.calls.length === SINGLE ? 'tool call' : 'tool calls'}
    </summary>
    <p className="mt-1 text-gray-600">
      {STOPPED[agent.stopped]}{' '}
      {agent.fellBack
        ? 'The standard pipeline wrote this instead.'
        : `Its sentences may cite only the ${agent.factIds.length} facts the tools returned.`}
    </p>
    <ol className="mt-1 list-decimal space-y-0.5 pl-5">
      {agent.calls.map((c, i) => (
        <li key={`${c.step}-${i}`}>
          <code>{c.tool}</code> {argsText(c.arguments)}{' '}
          {c.ok ? (
            <span className="text-gray-500">
              {c.repeated ? 'repeated, not run again' : `${c.factIds.length} facts`}
            </span>
          ) : (
            <span className="text-red-700">refused: {c.error}</span>
          )}
        </li>
      ))}
    </ol>
  </details>
);

export default AgentTracePanel;
