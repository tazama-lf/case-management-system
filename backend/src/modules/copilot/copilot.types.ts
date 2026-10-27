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
}

/** Who is asking, taken from the verified token. */
export interface Caller {
  userId: string;
  tenantId: string;
  name: string;
  email?: string;
}
