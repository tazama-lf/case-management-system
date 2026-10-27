import React from 'react';
import apiClient from '@/shared/services/apiClient';

let cached: Promise<boolean> | null = null;

/** Asks the backend once whether the copilot feature is switched on. Unknown or failing counts as off. */
const load = async (): Promise<boolean> => {
  cached ??= apiClient
    .get<{ copilot?: boolean }>('/api/v1/features')
    .then((f) => f.copilot === true)
    .catch(() => false);
  return await cached;
};

export function useCopilotEnabled(): boolean {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    void load().then((v) => {
      if (live) setOn(v);
    });
    return () => {
      live = false;
    };
  }, []);
  return on;
}
