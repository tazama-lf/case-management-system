import apiClient from '@/shared/services/apiClient';

export interface CopilotFact {
  id: string;
  kind: string;
  text: string;
  source: string;
}

export interface CheckedSentence {
  text: string;
  cites: string[];
  ok: boolean;
  reasons: string[];
}

export interface CheckedText {
  sentences: CheckedSentence[];
  removed: CheckedSentence[];
  writtenBy: 'model' | 'code';
}

export interface CopilotModelInfo {
  mode: 'bundled' | 'byok' | 'off';
  model: string | null;
  license: string | null;
  endpoint: string | null;
  dataLeavesDeployment: boolean;
  embeddings: string;
  reachable?: boolean;
}

export interface InvestigationRecord {
  id: number;
  caseId: number;
  createdAt: string;
  createdBy: string;
  model: CopilotModelInfo;
  facts: CopilotFact[];
  summary: CheckedText;
  redFlags: CheckedText;
  nextSteps: CheckedText;
  notice?: string;
}

export interface AskResult {
  recordId: number;
  factIds: string[];
  answer: CheckedText;
  notice?: string;
}

export interface SarSection {
  key: string;
  title: string;
  factIds: string[];
  text: CheckedText;
}

export interface SarDraft {
  id: number;
  caseId: number;
  investigationRecordId: number;
  createdAt: string;
  model: CopilotModelInfo;
  sections: SarSection[];
  indicators: string[];
  goamlXml: string;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
  notice?: string;
}

const base = '/api/v1/copilot';

export const copilotService = {
  status: async (): Promise<CopilotModelInfo> =>
    await apiClient.get(`${base}/status`),
  latest: async (caseId: number): Promise<InvestigationRecord | null> =>
    await apiClient.get(`${base}/cases/${caseId}/investigation`),
  investigate: async (caseId: number): Promise<InvestigationRecord> =>
    await apiClient.post(`${base}/cases/${caseId}/investigation`, {}),
  ask: async (caseId: number, question: string): Promise<AskResult> =>
    await apiClient.post(`${base}/cases/${caseId}/ask`, { question }),
  latestSar: async (caseId: number): Promise<SarDraft | null> =>
    await apiClient.get(`${base}/cases/${caseId}/sar-draft`),
  draftSar: async (caseId: number, refresh = false): Promise<SarDraft> =>
    await apiClient.post(`${base}/cases/${caseId}/sar-draft`, { refresh }),
};

export function modelLabel(m: CopilotModelInfo): string {
  if (m.mode === 'off') return 'Model off: text written by code from the facts';
  const where =
    m.mode === 'bundled'
      ? 'bundled model, runs inside this deployment'
      : `your provider (${m.endpoint ?? 'not set'}); case data is sent there`;
  return `${m.model ?? 'model not set'} (${m.license ?? 'licence not set'}), ${where}`;
}

export function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export type ReviewAction = 'SUBMIT' | 'APPROVE' | 'RETURN' | 'WITHDRAW' | 'FILE';
export type ReviewStatus = 'DRAFT' | 'IN_REVIEW' | 'RETURNED' | 'APPROVED' | 'FILED';

export interface ReviewEvent {
  id: number;
  action: ReviewAction;
  actorName: string;
  role: 'maker' | 'checker';
  comment: string;
  reference?: string;
  at: string;
}

export interface ReviewState {
  draftId: number | null;
  status: ReviewStatus;
  events: ReviewEvent[];
  allowed: Array<{ action: ReviewAction; role: 'maker' | 'checker' }>;
  yourRole: 'maker' | 'checker';
}

export const reviewService = {
  state: async (caseId: number): Promise<ReviewState> =>
    await apiClient.get(`${base}/cases/${caseId}/sar-review`),
  act: async (
    caseId: number,
    action: ReviewAction,
    comment: string,
    reference?: string,
  ): Promise<ReviewState> =>
    await apiClient.post(`${base}/cases/${caseId}/sar-review`, {
      action,
      comment,
      reference,
    }),
};
