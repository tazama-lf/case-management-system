import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NetworkGraph from '../network-analysis/NetworkGraph';

describe('NetworkGraph', () => {
  const nodes = [
    { id: 'n1', label: 'Account A', type: 'account' as const, status: 'normal' as const, position: { x: 100, y: 100 } },
    { id: 'n2', label: 'Account B', type: 'account' as const, status: 'alert' as const, position: { x: 200, y: 200 } },
    { id: 'n3', label: 'Counterparty', type: 'counterparty' as const, status: 'normal' as const, position: { x: 300, y: 100 } },
  ];

  const edges = [
    { id: 'e1', source: 'n1', target: 'n2', type: 'outbound' as const },
    { id: 'e2', source: 'n3', target: 'n1', type: 'inbound' as const },
  ];

  it('renders nodes', () => {
    render(<NetworkGraph nodes={nodes} edges={edges} />);
    expect(screen.getByText('Account A')).toBeInTheDocument();
    expect(screen.getByText('Account B')).toBeInTheDocument();
    expect(screen.getByText('Counterparty')).toBeInTheDocument();
  });

  it('renders zoom controls', () => {
    render(<NetworkGraph nodes={nodes} edges={edges} />);
    // Zoom in, zoom out, and reset buttons should be present
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('calls onNodeClick when node is clicked', () => {
    const onNodeClick = vi.fn();
    render(<NetworkGraph nodes={nodes} edges={edges} onNodeClick={onNodeClick} />);
    fireEvent.click(screen.getByText('Account A'));
    expect(onNodeClick).toHaveBeenCalled();
  });
});
