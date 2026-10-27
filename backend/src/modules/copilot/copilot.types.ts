import type { StopReason, ToolTrace } from './agent/agent.types';

export type FactKind =
  'case' | 'alert' | 'rule' | 'transaction' | 'subject' | 'kyc' | 'activity' | 'pattern' | 'counterparty' | 'screening' | 'note';

/** One numbered statement computed by code from CMS data. Everything the model writes must cite these. */
export interface Fact {
  id: string;
  kind: FactKind;
  text: string;
  source: string;
}

/** A transaction read from a pacs.008 message, seen from the subject account. */
export interface Txn {
  endToEndId: string;
  at: Date;
  direction: 'CR' | 'DR';
  amount: number;
  currency: string;
  counterparty: string;
  counterpartyAccount: string;
  counterpartyFsp: string;
  channel: string;
  narrative: string;
  lat?: number;
  long?: number;
}

export interface Party {
  name: string;
  account: string;
  fsp: string;
  birthDate?: string;
  isOrganisation: boolean;
  lat?: number;
  long?: number;
}

export interface CaseFacts {
  caseId: number;
  tenantId: string;
  status: string;
  caseType: string | null;
  alertId: number | null;
  alertAt: Date | null;
  subject: (Party & { role: 'debtor' | 'creditor' }) | null;
  counterparty: Party | null;
  trigger: Txn | null;
  window: Txn[];
  /** Counterparty accounts the subject already dealt with before the 30-day window. */
  knownCounterparties: string[];
  ruleIds: string[];
  typology: string | null;
  score: number | null;
  facts: Fact[];
}

export interface Sentence {
  text: string;
  cites: string[];
}

export interface CheckedSentence extends Sentence {
  ok: boolean;
  reasons: string[];
}

/** Text shown to the user: sentences that passed the checks, and the ones removed with the reason. */
export interface CheckedText {
  sentences: CheckedSentence[];
  removed: CheckedSentence[];
  writtenBy: 'model' | 'code';
}

export interface ModelInfo {
  mode: 'bundled' | 'byok' | 'off';
  model: string | null;
  license: string | null;
  endpoint: string | null;
  dataLeavesDeployment: boolean;
  embeddings: string;
}

/** The model the endpoint actually served: file, quantisation and build from llama.cpp, the resolved model id from a provider. */
export interface ServedModel {
  model: string | null;
  file?: string;
  quantisation?: string;
  build?: string;
}

/** Exactly what produced a record: the prompts, the settings and the model served. Stored with every record. */
export interface Provenance {
  /** Changes whenever any copilot prompt changes. */
  promptVersion: string;
  strategy: 'pipeline' | 'agent';
  temperature: number;
  maxTokens: number;
  meaningCheck: boolean;
  served: ServedModel | null;
}

/** How an agent run produced the findings: every tool call, and why it stopped. Stored with the record as the audit trail. */
export interface AgentTrace {
  stopped: StopReason;
  calls: ToolTrace[];
  /** Facts the tools returned; the only ones the model's sentences may cite. */
  factIds: string[];
  /** True when the model did not use the tools or failed, and the pipeline wrote the findings instead. */
  fellBack: boolean;
}

/** What the copilot stores for a case: the facts with their vectors, and its findings. The SAR agent reads this. */
export interface InvestigationRecord {
  id: number;
  caseId: number;
  createdAt: string;
  createdBy: string;
  model: ModelInfo;
  facts: Fact[];
  vectors: Record<string, number[]>;
  summary: CheckedText;
  redFlags: CheckedText;
  nextSteps: CheckedText;
  notice?: string;
  /** Present when the findings were produced by the agent strategy. */
  agent?: AgentTrace;
  provenance?: Provenance;
  /** The model's reply exactly as it came back, before the checks; null when no model answered. */
  raw?: string | null;
}

export interface SarSection {
  key: string;
  title: string;
  factIds: string[];
  text: CheckedText;
}

export interface SarCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface SarDraft {
  id: number;
  caseId: number;
  investigationRecordId: number;
  createdAt: string;
  model: ModelInfo;
  /** The facts the draft cites, copied from the investigation record so the draft stands on its own. */
  facts: Fact[];
  sections: SarSection[];
  indicators: string[];
  goamlXml: string;
  checks: SarCheck[];
  notice?: string;
  provenance?: Provenance;
  raw?: string | null;
}

export type FeedbackRating = 'up' | 'down';

/** A user's rating of a copilot output (investigation findings, a chat answer or a SAR draft). */
export interface Feedback {
  id: number;
  recordId: number;
  rating: FeedbackRating;
  comment: string;
  createdAt: string;
}

/** Result of walking a tenant's copilot records and recomputing each hash. */
export interface ChainReport {
  ok: boolean;
  /** Records whose hash was recomputed and matched. */
  checked: number;
  /** Records written before the chain existed; they have no hash. */
  unchained: number;
  /** Hash of the newest record; compare it with the audit log to detect removal of the newest records. */
  head: string | null;
  brokenAt?: number;
  reason?: string;
}

/** What the copilot did in a period, for the people who oversee it. */
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
    /** Parts (summary, red flags, next steps, answers, SAR sections) the model wrote and that passed the checks. */
    modelParts: number;
    /** Parts written by code because there was no model or most of its text failed. */
    codeParts: number;
    sentencesKept: number;
    sentencesRemoved: number;
    removalReasons: Array<{ reason: string; count: number }>;
  };
  agent: { runs: number; fellBack: number };
  feedback: { up: number; down: number; recent: Array<{ recordId: number; rating: FeedbackRating; comment: string; at: string }> };
  review: Record<string, number>;
  chain: ChainReport;
}

/** Who is asking, taken from the verified token. */
export interface Caller {
  userId: string;
  tenantId: string;
  name: string;
  email?: string;
}
