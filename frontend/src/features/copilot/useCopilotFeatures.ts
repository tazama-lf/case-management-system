import React from 'react';
import apiClient from '@/shared/services/apiClient';

export interface CopilotFeatures {
  investigation: boolean;
  sar: boolean;
}

const OFF: CopilotFeatures = { investigation: false, sar: false };
let cached: Promise<CopilotFeatures> | null = null;

/** Asks the backend once which copilot features are switched on. Unknown or failing counts as off. */
const load = async (): Promise<CopilotFeatures> => {
  cached ??= apiClient
    .get<{ copilotInvestigation?: boolean; copilotSar?: boolean }>('/api/v1/features')
    .then((r) => ({ investigation: r.copilotInvestigation === true, sar: r.copilotSar === true }))
    .catch(() => {
      cached = null; // ask again next time instead of hiding the copilot until a reload
      return OFF;
    });
  return await cached;
};

/** The investigation copilot and the SAR/STR agent are separate features; each part of the UI follows its own. */
export function useCopilotFeatures(): CopilotFeatures {
  const [features, setFeatures] = React.useState<CopilotFeatures>(OFF);
  React.useEffect(() => {
    let live = true;
    void load().then((r) => {
      if (live) setFeatures(r);
    });
    return () => {
      live = false;
    };
  }, []);
  return features;
}
