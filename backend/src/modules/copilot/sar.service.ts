import { Injectable } from '@nestjs/common';
import { CaseFactsService } from './case-facts.service';
import type { CaseFacts, Caller, Fact, InvestigationRecord, ModelInfo, SarDraft, SarSection } from './copilot.types';
import { topK } from './embeddings';
import { noticeFor, preferModel } from './findings';
import { InvestigationService } from './investigation.service';
import { ModelProviderService } from './model-provider.service';
import { SAR_PROMPT, factLines } from './prompts';
import { RecordStore, type StoredRecord } from './record-store.service';
import { SECTIONS, codeSection, goamlXml, indicators, reportTransactions, sarChecks } from './sar';
import {
  allowedActions,
  refusal,
  statusOf,
  type Allowed,
  type ReviewAction,
  type ReviewEvent,
  type ReviewRole,
  type ReviewStatus,
} from './sar-review';
import { checkAll, toSentences } from './verifier';

const KIND_DRAFT = 'SAR_DRAFT' as const;
const KIND_REVIEW = 'SAR_REVIEW' as const;
const FACTS_PER_SECTION = 8;
const MAX_COMMENT = 2000;
const MAX_REFERENCE = 200;

/** A review step the workflow does not allow; the message says why. */
export class ReviewRefused extends Error {}

export interface ReviewState {
  draftId: number | null;
  status: ReviewStatus;
  events: ReviewEvent[];
  allowed: Allowed[];
}

type DraftPayload = Omit<SarDraft, 'id' | 'caseId' | 'investigationRecordId' | 'createdAt' | 'model'>;
type ReviewPayload = Pick<ReviewEvent, 'action' | 'actorName' | 'role' | 'comment' | 'reference'>;

/** SAR/STR drafting agent (backlog P3-2): drafts from the stored investigation record, and the maker-checker review of the draft. */
@Injectable()
export class SarService {
  constructor(
    private readonly store: RecordStore,
    private readonly caseFacts: CaseFactsService,
    private readonly models: ModelProviderService,
    private readonly investigation: InvestigationService,
  ) {}

  /** Drafts the STR/SAR from the stored investigation record: retrieval per section, drafting, checks, goAML XML. */
  async draft(caseId: number, caller: Caller, refresh = false): Promise<SarDraft> {
    const record = refresh
      ? await this.investigation.investigate(caseId, caller)
      : await this.investigation.latestOrInvestigate(caseId, caller);
    const cf = await this.caseFacts.load(caseId, caller.tenantId);
    const picked = await this.pickFactsPerSection(record);
    const reply = await this.models.chatJson<Record<string, unknown>>(SAR_PROMPT, this.sectionPrompt(record.facts, picked));
    const sections = this.sections(cf, record.facts, picked, reply);
    const report = this.report(cf, sections, record, caller);
    const info = this.models.info();
    const payload: DraftPayload = { ...report, notice: reply ? undefined : noticeFor(info) };
    const row = await this.store.create({
      caseId,
      tenantId: caller.tenantId,
      kind: KIND_DRAFT,
      parentId: record.id,
      userId: caller.userId,
      provider: info.mode,
      model: info.model,
      embeddingModel: info.embeddings,
      payload,
    });
    return { id: row.id, caseId, investigationRecordId: record.id, createdAt: row.createdAt.toISOString(), model: info, ...payload };
  }

  async latest(caseId: number, tenantId: string): Promise<SarDraft | null> {
    const row = await this.store.latest(caseId, tenantId, KIND_DRAFT);
    if (!row) return null;
    return {
      id: row.id,
      caseId,
      investigationRecordId: row.parentId ?? 0,
      createdAt: row.createdAt.toISOString(),
      model: { ...this.models.info(), mode: row.provider as ModelInfo['mode'], model: row.model },
      ...(row.payload as DraftPayload),
    };
  }

  /** Where the latest draft stands in the review workflow, with its full history. */
  async reviewState(caseId: number, tenantId: string): Promise<ReviewState> {
    const draft = await this.store.latest(caseId, tenantId, KIND_DRAFT);
    if (!draft) return { draftId: null, status: 'DRAFT', events: [], allowed: [] };
    const events = (await this.store.children(caseId, tenantId, KIND_REVIEW, draft.id)).map((r) => this.toEvent(r, draft.id));
    const status = statusOf(events);
    return { draftId: draft.id, status, events, allowed: allowedActions(status) };
  }

  /** Submit, approve, return, withdraw or file the latest draft. Refused with a reason when the workflow does not allow it. */
  async review(
    caseId: number,
    caller: Caller,
    role: ReviewRole,
    action: ReviewAction,
    comment: string,
    reference?: string,
  ): Promise<ReviewState> {
    const state = await this.reviewState(caseId, caller.tenantId);
    if (state.draftId === null) throw new ReviewRefused('There is no draft to review yet.');
    const why = refusal(state.events, action, { id: caller.userId, role }, comment, reference);
    if (why) throw new ReviewRefused(why);
    const payload: ReviewPayload = {
      action,
      role,
      actorName: caller.name,
      comment: comment.trim().slice(0, MAX_COMMENT),
      reference: reference?.trim().slice(0, MAX_REFERENCE),
    };
    await this.store.create({
      caseId,
      tenantId: caller.tenantId,
      kind: KIND_REVIEW,
      parentId: state.draftId,
      userId: caller.userId,
      provider: this.models.info().mode,
      payload,
    });
    return await this.reviewState(caseId, caller.tenantId);
  }

  /** For each report section, the facts it always needs plus the ones nearest its query in the stored vectors. */
  private async pickFactsPerSection(record: InvestigationRecord): Promise<string[][]> {
    const queries = await this.models.embed(SECTIONS.map((s) => s.query));
    return SECTIONS.map((s, i) => {
      const always = record.facts.filter((f) => s.always.includes(f.kind)).map((f) => f.id);
      return [...new Set([...always, ...topK(queries.vectors[i], record.vectors, FACTS_PER_SECTION)])];
    });
  }

  private sectionPrompt(facts: Fact[], picked: string[][]): string {
    return SECTIONS.map(
      (s, i) => `## ${s.key}: ${s.title} - ${s.guidance}\n${factLines(facts.filter((f) => picked[i].includes(f.id)))}`,
    ).join('\n\n');
  }

  private sections(cf: CaseFacts, facts: Fact[], picked: string[][], reply: Record<string, unknown> | null): SarSection[] {
    return SECTIONS.map((s, i) => {
      const own = facts.filter((f) => picked[i].includes(f.id));
      const modelText = reply ? checkAll(toSentences(reply[s.key]), facts, 'model', true) : null;
      return {
        key: s.key,
        title: s.title,
        factIds: picked[i],
        text: preferModel(modelText, checkAll(codeSection(s.key, own, cf), facts, 'code', true)),
      };
    });
  }

  /** The narrative, indicators and goAML XML, with the checks to pass before filing. */
  private report(cf: CaseFacts, sections: SarSection[], record: InvestigationRecord, caller: Caller): Omit<DraftPayload, 'notice'> {
    const text = (key: string): string =>
      sections
        .find((s) => s.key === key)!
        .text.sentences.map((x) => x.text)
        .join(' ');
    const narrative = SECTIONS.filter((s) => s.key !== 'action')
      .map((s) => `${s.title}: ${text(s.key)}`)
      .join('\n\n');
    const transactions = reportTransactions(cf);
    const rentityId = process.env.GOAML_RENTITY_ID ?? null;
    const inds = indicators(cf);
    const xml = goamlXml({
      cf,
      narrative,
      action: text('action'),
      indicators: inds,
      reportingPerson: { name: caller.name, email: caller.email },
      rentityId,
      submissionDate: new Date(),
      transactions,
    });
    return {
      facts: record.facts,
      sections,
      indicators: inds,
      goamlXml: xml,
      checks: sarChecks(cf, sections, xml, transactions, rentityId, record.id, record.createdAt),
    };
  }

  private toEvent(row: StoredRecord, draftId: number): ReviewEvent {
    return { id: row.id, draftId, actorId: row.createdBy, at: row.createdAt.toISOString(), ...(row.payload as ReviewPayload) };
  }
}
