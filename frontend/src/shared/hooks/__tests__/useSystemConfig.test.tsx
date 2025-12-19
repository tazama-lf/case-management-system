import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useSystemConfig, getTriageModeLabel, getTriageModeDescription, getTriageModeColor } from '../useSystemConfig';
import systemConfigService from '../../services/systemConfigService';

const TestComponent: React.FC = () => {
  const { config, loading, error, triageType, isAIMode, isManualMode } = useSystemConfig();

  return (
    <div>
      <div>loading:{String(loading)}</div>
      <div>error:{String(error)}</div>
      <div>triage:{String(triageType)}</div>
      <div>isAI:{String(isAIMode)}</div>
      <div>isManual:{String(isManualMode)}</div>
      <div>config:{config ? JSON.stringify(config) : 'null'}</div>
    </div>
  );
};

describe('useSystemConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and exposes config when service resolves', async () => {
    vi.spyOn(systemConfigService, 'getSystemConfig').mockResolvedValue({
      triageType: 'AI',
      confidenceThreshold: 80,
      interdictionEnabled: false,
    });

    render(<TestComponent />);

    // Initially loading true
    expect(screen.getByText(/loading:true/)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText(/loading:false/)).toBeInTheDocument());

    expect(screen.getByText(/triage:AI/)).toBeInTheDocument();
    expect(screen.getByText(/isAI:true/)).toBeInTheDocument();
    expect(screen.getByText(/isManual:false/)).toBeInTheDocument();
    expect(screen.getByText(/config:/)).toBeInTheDocument();
  });

  it('handles service error and returns defaults and error message', async () => {
    vi.spyOn(systemConfigService, 'getSystemConfig').mockRejectedValue(new Error('network fail'));

    render(<TestComponent />);

    await waitFor(() => expect(screen.getByText(/loading:false/)).toBeInTheDocument());

    // default triageType should be MANUAL when error occurs
    expect(screen.getByText(/triage:MANUAL/)).toBeInTheDocument();
    expect(screen.getByText(/isManual:true/)).toBeInTheDocument();
    expect(screen.getByText(/error:/)).toBeInTheDocument();
  });
});

describe('triage helpers', () => {
  it('returns correct labels, descriptions and colors for modes', () => {
    expect(getTriageModeLabel('AI')).toContain('AI Automated');
    expect(getTriageModeLabel('MANUAL')).toContain('Manual Review');
    expect(getTriageModeLabel('DISABLED')).toContain('Direct Investigation');

    expect(getTriageModeDescription('AI')).toContain('AI predictions');
    expect(getTriageModeDescription('MANUAL')).toContain('manual review');
    expect(getTriageModeDescription('DISABLED')).toContain('bypass triage');

    expect(getTriageModeColor('AI')).toContain('text-blue-600');
    expect(getTriageModeColor('MANUAL')).toContain('text-yellow-600');
    expect(getTriageModeColor('DISABLED')).toContain('text-gray-600');
  });
});
