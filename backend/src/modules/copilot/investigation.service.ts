import { Inject, Injectable } from '@nestjs/common';
import { CaseFactsService } from './case-facts.service';
import type { AgentTrace, CaseFacts, Caller, CheckedText, InvestigationRecord, ModelInfo, Provenance, Sentence } from './copilot.types';
import { topK } from './embeddings';
import { codeFindings, noticeFor, preferModel } from './findings';
import { MeaningCheck } from './meaning-check';
import { ModelProviderService } from './model-provider.service';
import { INVESTIGATION_STRATEGY, type InvestigationStrategy } from './investigation.strategy';
import { provenanceOf } from './provenance';
import { RecordStore, type StoredRecord } from './record-store.service';
import { checkAll, toSentences } from './verifier';

const KIND = 'INVESTIGATION' as const;
const ASK_KIND = 'ASK' as const;
const CLOSEST_FACTS = 8;
const FALLBACK_CANDIDATES = 6;
const FALLBACK_FACTS = 3;

export interface AskResult {
  /** The stored ASK record for this question and answer; feedback on the answer points at it. */
  askId: number;
  recordId: number;
  factIds: string[];
  answer: CheckedText;
  notice?: string;
  /** With the agent strategy: the tool calls behind this answer. */
  agent?: AgentTrace;
}

type Answered = Omit<AskResult, 'askId'>;
type Stored = Omit<InvestigationRecord, 'id' | 'caseId' | 'createdAt' | 'createdBy' | 'model'>;

/** Investigation copilot (backlog P4-2): the case facts, the findings written from them, and the case chat. */
@Injectable()
export class InvestigationService {
  constructor(
    private readonly store: RecordStore,
    private readonly caseFacts: CaseFactsService,
    private readonly models: ModelProviderService,
    @Inject(INVESTIGATION_STRATEGY) private readonly strategy: InvestigationStrategy,
    private readonly meaning: MeaningCheck,
  ) {}

  async status(): Promise<ModelInfo & { reachable: boolean; strategy: string }> {
    return { ...this.models.info(), reachable: await this.models.reachable(), strategy: this.strategy.name };
  }

  /** Reads the case, computes and embeds the facts, writes findings, and stores it all as the case's investigation record. */
  async investigate(caseId: number, caller: Caller): Promise<InvestigationRecord> {
    const cf = await this.caseFacts.load(caseId, caller.tenantId);
    const { vectors, model: embeddingModel } = await this.models.embed(cf.facts.map((f) => f.text));
    const byId = Object.fromEntries(cf.facts.map((f, i) => [f.id, vectors[i]]));
    const written = await this.strategy.investigate(cf.facts);

    const findings = await this.findings(cf, written.reply, written.evidence);
    const info = { ...this.models.info(), embeddings: embeddingModel };
    const payload: Stored = {
      facts: cf.facts,
      vectors: byId,
      ...findings,
      notice: written.reply ? undefined : noticeFor(info),
      agent: written.agent,
      provenance: await this.provenance(),
      raw: written.raw,
    };
    const row = await this.store.create({
      caseId,
      tenantId: caller.tenantId,
      kind: KIND,
      userId: caller.userId,
      provider: info.mode,
      model: info.model,
      embeddingModel,
      payload,
    });
    return { id: row.id, caseId, createdAt: row.createdAt.toISOString(), createdBy: caller.name, model: info, ...payload };
  }

  async latest(caseId: number, tenantId: string): Promise<InvestigationRecord | null> {
    const row = await this.store.latest(caseId, tenantId, KIND);
    return row ? this.toRecord(row) : null;
  }

  /** The latest stored record, or a fresh run when the case has none yet. */
  async latestOrInvestigate(caseId: number, caller: Caller): Promise<InvestigationRecord> {
    return (await this.latest(caseId, caller.tenantId)) ?? (await this.investigate(caseId, caller));
  }

  /** Answers a question using only the case facts, written by the model and checked, or the closest facts when that fails. */
  async ask(caseId: number, caller: Caller, question: string): Promise<AskResult> {
    const record = await this.latestOrInvestigate(caseId, caller);
    const { vectors } = await this.models.embed([question]);
    const core = record.facts.filter((f) => f.kind === 'subject' || f.kind === 'transaction').map((f) => f.id);
    const ids = [...new Set([...core, ...topK(vectors[0], record.vectors, CLOSEST_FACTS)])];
    const written = await this.strategy.answer(
      question,
      record.facts,
      record.facts.filter((f) => ids.includes(f.id)),
    );
    const answer = written.reply
      ? await this.meaning.review(checkAll(toSentences(written.reply.answer), written.evidence, 'model'), written.evidence)
      : null;
    const result: Answered = answer?.sentences.length
      ? { recordId: record.id, factIds: ids, answer, agent: written.agent }
      : {
          recordId: record.id,
          factIds: ids,
          answer: this.closestFacts(record, topK(vectors[0], record.vectors, FALLBACK_CANDIDATES)),
          notice: written.reply ? 'The model answer did not pass the checks; these are the closest facts.' : noticeFor(this.models.info()),
          agent: written.agent,
        };
    const askId = await this.keep(caseId, caller, question, result, written.raw);
    return { askId, ...result };
  }

  /** Every question and its answer is kept, linked to the investigation record it was answered from, for audit. */
  private async keep(
    caseId: number,
    caller: Caller,
    question: string,
    { recordId, ...answered }: Answered,
    raw: string | null,
  ): Promise<number> {
    const info = this.models.info();
    const row = await this.store.create({
      caseId,
      tenantId: caller.tenantId,
      kind: ASK_KIND,
      userId: caller.userId,
      provider: info.mode,
      model: info.model,
      parentId: recordId,
      payload: { question, ...answered, provenance: await this.provenance(), raw },
    });
    return row.id;
  }

  private async provenance(): Promise<Provenance> {
    return await provenanceOf(this.models, this.strategy.name, this.meaning.enabled);
  }

  /** The closest facts that pass the checks (a fact holding an account number would not), at most three. */
  private closestFacts(record: InvestigationRecord, ranked: string[]): CheckedText {
    const sentences: Sentence[] = ranked.map((id) => ({ text: record.facts.find((f) => f.id === id)!.text, cites: [id] }));
    const checked = checkAll(sentences, record.facts, 'code');
    return { ...checked, sentences: checked.sentences.slice(0, FALLBACK_FACTS), removed: [] };
  }

  /** Summary, red flags and next steps: the model's text where it passed the checks, otherwise code's. */
  private async findings(
    cf: CaseFacts,
    reply: Record<string, unknown> | null,
    evidence: CaseFacts['facts'],
  ): Promise<Pick<Stored, 'summary' | 'redFlags' | 'nextSteps'>> {
    const fromModel = async (key: string, citesRequired: boolean): Promise<CheckedText | null> =>
      reply ? await this.meaning.review(checkAll(toSentences(reply[key]), evidence, 'model', citesRequired), evidence) : null;
    const code = codeFindings(cf);
    return {
      summary: preferModel(await fromModel('summary', true), checkAll(code.summary, cf.facts, 'code', true)),
      redFlags: preferModel(await fromModel('red_flags', true), checkAll(code.redFlags, cf.facts, 'code', true)),
      nextSteps: preferModel(await fromModel('next_steps', false), checkAll(code.nextSteps, cf.facts, 'code')),
    };
  }

  private toRecord(row: StoredRecord): InvestigationRecord {
    return {
      id: row.id,
      caseId: row.caseId,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
      model: { ...this.models.info(), mode: row.provider as ModelInfo['mode'], model: row.model, embeddings: row.embeddingModel ?? '' },
      ...(row.payload as Stored),
    };
  }
}
