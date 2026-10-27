import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AgentTracePanel from '../AgentTracePanel';
import type { AgentTrace } from '../copilotService';

const trace = (over: Partial<AgentTrace> = {}): AgentTrace => ({
  stopped: 'answered',
  fellBack: false,
  factIds: ['F1', 'F2', 'F3'],
  calls: [
    { step: 1, tool: 'get_alert_and_rules', arguments: {}, ok: true, factIds: ['F1', 'F2'], ms: 3 },
    { step: 1, tool: 'search_facts', arguments: { query: 'device' }, ok: true, factIds: ['F3'], ms: 2 },
    { step: 2, tool: 'search_facts', arguments: { query: 'device' }, ok: true, factIds: [], repeated: true, ms: 0 },
    { step: 2, tool: 'drop_table', arguments: {}, ok: false, factIds: [], error: 'There is no tool called "drop_table".', ms: 0 },
  ],
  ...over,
});

describe('AgentTracePanel', () => {
  it('lists every tool call with what it returned, and what the model could cite', () => {
    render(<AgentTracePanel agent={trace()} />);
    expect(screen.getByText(/the agent made 4 tool calls/)).toBeInTheDocument();
    expect(screen.getByText('get_alert_and_rules')).toBeInTheDocument();
    expect(screen.getByText('2 facts')).toBeInTheDocument();
    expect(screen.getByText('repeated, not run again')).toBeInTheDocument();
    expect(screen.getByText(/refused: There is no tool called "drop_table"/)).toBeInTheDocument();
    expect(screen.getByText(/may cite only the 3 facts the tools returned/)).toBeInTheDocument();
  });

  it('says when the pipeline wrote the findings instead, and why the run stopped', () => {
    render(<AgentTracePanel agent={trace({ fellBack: true, stopped: 'model_failed', calls: [], factIds: [] })} />);
    expect(screen.getByText(/the agent made 0 tool calls/)).toBeInTheDocument();
    expect(screen.getByText(/The model did not respond/)).toBeInTheDocument();
    expect(screen.getByText(/The standard pipeline wrote this instead/)).toBeInTheDocument();
  });

  it('uses the singular for one call', () => {
    render(<AgentTracePanel agent={trace({ calls: [trace().calls[0]] })} />);
    expect(screen.getByText(/the agent made 1 tool call$/)).toBeInTheDocument();
  });
});
