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

export interface AgentToolCall {
  step: number;
  tool: string;
  arguments: unknown;
  ok: boolean;
  factIds: string[];
  error?: string;
  repeated?: boolean;
  ms: number;
}

/** How the agent strategy produced the findings: every tool call, and why it stopped. */
export interface AgentTrace {
  stopped: 'answered' | 'step_limit' | 'tool_limit' | 'timeout' | 'model_failed';
  calls: AgentToolCall[];
  factIds: string[];
  fellBack: boolean;
}

/** The model the endpoint actually served: file, quantisation and build from llama.cpp, the resolved id from a provider. */
export interface ServedModel {
  model: string | null;
  file?: string;
  quantisation?: string;
  build?: string;
}

/** Exactly what produced a record: the prompts, the settings and the model served. */
export interface Provenance {
  promptVersion: string;
  strategy: 'pipeline' | 'agent';
  temperature: number;
  maxTokens: number;
  meaningCheck: boolean;
  served: ServedModel | null;
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
  agent?: AgentTrace;
  provenance?: Provenance;
  raw?: string | null;
}

export interface AskResult {
  recordId: number;
  /** The stored record of this question and answer; feedback on the answer refers to it. */
  askId: number;
  factIds: string[];
  answer: CheckedText;
  notice?: string;
  agent?: AgentTrace;
}

export type FeedbackRating = 'up' | 'down';

export interface Feedback {
  id: number;
  recordId: number;
  rating: FeedbackRating;
  comment: string;
  createdAt: string;
}

/** Result of recomputing the hash of every copilot record of the tenant. */
export interface ChainReport {
  ok: boolean;
  checked: number;
  unchained: number;
  head: string | null;
  brokenAt?: number;
  reason?: string;
}

/** What the copilot did in a period, for supervisors and compliance officers. */
export interface GovernanceReport {
  tenantId: string;
  from: string;
  to: string;
  records: Record<string, number>;
  models: Array<{
    provider: string;
    model: string | null;
    file?: string;
    build?: string;
    promptVersion: string;
    strategy: string;
    records: number;
  }>;
  writing: {
    modelParts: number;
    codeParts: number;
    sentencesKept: number;
    sentencesRemoved: number;
    removalReasons: Array<{ reason: string; count: number }>;
  };
  agent: { runs: number; fellBack: number };
  feedback: {
    up: number;
    down: number;
    recent: Array<{
      recordId: number;
      rating: FeedbackRating;
      comment: string;
      at: string;
    }>;
  };
  review: Record<string, number>;
  chain: ChainReport;
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
  /** The facts the draft cites; older drafts did not carry them. */
  facts?: CopilotFact[];
  sections: SarSection[];
  indicators: string[];
  goamlXml: string;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
  notice?: string;
  provenance?: Provenance;
  raw?: string | null;
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
  feedback: async (
    caseId: number,
    recordId: number,
    rating: FeedbackRating,
    comment?: string,
  ): Promise<Feedback> =>
    await apiClient.post(`${base}/cases/${caseId}/feedback`, {
      recordId,
      rating,
      comment,
    }),
  governance: async (days: number): Promise<GovernanceReport> =>
    await apiClient.get(`${base}/governance?days=${days}`),
};

/** One line on what produced a record: the model served, its build, the prompt version and the strategy. */
export function provenanceLabel(p: Provenance): string {
  const s = p.served;
  const model = s
    ? [
        s.file ?? s.model ?? 'model not reported',
        s.quantisation,
        s.build ? `build ${s.build}` : undefined,
      ]
        .filter(Boolean)
        .join(', ')
    : 'no model';
  return `${model} · prompts ${p.promptVersion} · ${p.strategy} · meaning check ${p.meaningCheck ? 'on' : 'off'}`;
}

/** The narrative as a text file, headed by a note that it was drafted with AI assistance and must be reviewed. */
export function sarNarrative(d: SarDraft): string {
  const model =
    d.model.mode === 'off'
      ? 'no model, written by code'
      : `${d.model.model ?? 'model not set'}, ${d.model.mode === 'bundled' ? 'bundled model' : 'your provider'}`;
  return [
    `STR draft for CMS case ${d.caseId} (copilot record ${d.investigationRecordId}, ${new Date(d.createdAt).toLocaleString()})`,
    `Prepared with AI assistance by the Tazama CMS copilot (${model}) from investigation record ${d.investigationRecordId}, draft ${d.id}.`,
    'Every sentence cites case facts and passed automated checks. It must be reviewed and approved under the CMS maker-checker workflow before filing.',
    ...(d.provenance ? [`Produced by: ${provenanceLabel(d.provenance)}`] : []),
    '',
    ...d.sections.flatMap((s) => [
      s.title.toUpperCase(),
      s.text.sentences.map((x) => x.text).join(' '),
      '',
    ]),
    'INDICATORS',
    ...d.indicators.map((i) => `- ${i}`),
  ].join('\n');
}

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
