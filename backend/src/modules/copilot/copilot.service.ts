import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client-cms';
import { PrismaService } from '../../../prisma/prisma.service';
import { CaseFactsService } from './case-facts.service';
import type { CaseFacts, CheckedText, Fact, InvestigationRecord, ModelInfo, SarDraft, SarSection, Sentence } from './copilot.types';
import { topK } from './embeddings';
import { ModelProviderService } from './model-provider.service';
import { SECTIONS, codeSection, goamlXml, indicators, reportTransactions, sarChecks } from './sar';
import { ruleInfo, ruleNumber } from './rules.catalog';
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

export interface Caller {
  userId: string;
  tenantId: string;
  name: string;
  email?: string;
}

const KIND_INVESTIGATION = 'INVESTIGATION';
const FALLBACK_CANDIDATES = 6;
const FALLBACK_FACTS = 3;
const KIND_SAR = 'SAR_DRAFT';
const KIND_REVIEW = 'SAR_REVIEW';

export interface ReviewState {
  draftId: number | null;
  status: ReviewStatus;
  events: ReviewEvent[];
  allowed: Allowed[];
}

const RULES_OF_WRITING = `Use only the numbered facts you are given. End every sentence with the ids of the facts it relies on in square brackets, for example: The account received PKR 450,000 from 3 senders [F10].
Copy numbers, amounts, dates and names exactly as they appear in the cited facts. Do not calculate new numbers.
Do not say anyone is guilty or has committed a crime: describe what the facts show and what it is consistent with.
Never suggest telling the customer about the alert, the investigation or any report.
Do not put account numbers or ID numbers in the text.`;

const INVESTIGATE_PROMPT = `You are the investigation copilot in the Tazama case management system. You assist a human investigator; the investigator decides the case.
${RULES_OF_WRITING}
Reply with JSON only, in this shape:
{"summary":["sentence [F2]","sentence [F7][F10]"],"red_flags":["sentence [F12]"],"next_steps":["sentence [F16]"]}
summary: 3 to 5 sentences on what happened. red_flags: up to 5, each one unusual fact. next_steps: up to 5 concrete investigative steps, each citing the fact that motivates it.`;

const ASK_PROMPT = `You are the investigation copilot in the Tazama case management system, answering an investigator's question about one case.
${RULES_OF_WRITING}
If the facts do not answer the question, reply with one sentence saying the case data does not show it, with no citations.
Reply with JSON only: {"answer":["sentence [F2]","sentence [F5]"]}`;

const SAR_PROMPT = `You draft the narrative of a suspicious transaction report (STR/SAR) for a compliance officer to review, edit and file.
${RULES_OF_WRITING}
Write in the third person and past tense, in a neutral tone. Refer to the subject by name.
Reply with JSON only, one array of sentences per section: {"subject":["sentence [F8]"],"activity":["sentence [F7]"],"grounds":["sentence [F3][F12]"],"investigation":["sentence [F21]"],"action":["sentence [F1]"]}.`;

/** Facts as the model sees them. Long notes are shortened (COPILOT_PROMPT_NOTE_CHARS, default 500) to fit small models; the checks still use the full text. */
function factLines(facts: Fact[]): string {
  const max = Number(process.env.COPILOT_PROMPT_NOTE_CHARS ?? 500);
  const short = (f: Fact): string =>
    ['note', 'kyc', 'screening'].includes(f.kind) && f.text.length > max ? `${f.text.slice(0, max)}..."` : f.text;
  return facts.map((f) => `${f.id} [${f.kind}] ${short(f)}`).join('\n');
}

/** A review step the workflow does not allow; the message says why. */
export class ReviewRefused extends Error {}

/** Investigation copilot (backlog P4-2) and SAR drafting agent (backlog P3-2). */
@Injectable()
export class CopilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caseFacts: CaseFactsService,
    private readonly models: ModelProviderService,
  ) {}

  async status(): Promise<ModelInfo & { reachable: boolean }> {
    return { ...this.models.info(), reachable: await this.models.reachable() };
  }

  /** Reads the case, computes and embeds the facts, writes findings, and stores it all as the case's investigation record. */
  async investigate(caseId: number, caller: Caller): Promise<InvestigationRecord> {
    const cf = await this.caseFacts.load(caseId, caller.tenantId);
    const { vectors, model: embeddingModel } = await this.models.embed(cf.facts.map((f) => f.text));
    const byId = Object.fromEntries(cf.facts.map((f, i) => [f.id, vectors[i]]));

    const reply = await this.models.chatJson<Record<string, unknown>>(INVESTIGATE_PROMPT, `Case facts:\n${factLines(cf.facts)}`);
    const fromModel = (key: string, citesRequired: boolean): CheckedText | null =>
      reply ? checkAll(toSentences(reply[key]), cf.facts, 'model', citesRequired) : null;
    const code = codeFindings(cf);
    const summary = preferModel(fromModel('summary', true), checkAll(code.summary, cf.facts, 'code', true));
    const redFlags = preferModel(fromModel('red_flags', true), checkAll(code.redFlags, cf.facts, 'code', true));
    const nextSteps = preferModel(fromModel('next_steps', false), checkAll(code.nextSteps, cf.facts, 'code'));
    const info = { ...this.models.info(), embeddings: embeddingModel };
    const notice = reply ? undefined : noticeFor(info);

    const payload = { facts: cf.facts, vectors: byId, summary, redFlags, nextSteps, notice };
    const row = await this.prisma.copilotRecord.create({
      data: {
        case_id: caseId,
        tenant_id: caller.tenantId,
        kind: KIND_INVESTIGATION,
        created_by: caller.userId,
        provider: info.mode,
        model: info.model,
        embedding_model: embeddingModel,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
    return { id: row.id, caseId, createdAt: row.created_at.toISOString(), createdBy: caller.name, model: info, ...payload };
  }

  async latestInvestigation(caseId: number, tenantId: string): Promise<InvestigationRecord | null> {
    const row = await this.prisma.copilotRecord.findFirst({
      where: { case_id: caseId, tenant_id: tenantId, kind: KIND_INVESTIGATION },
      orderBy: { id: 'desc' },
    });
    if (!row) return null;
    const p = row.payload as unknown as Omit<InvestigationRecord, 'id' | 'caseId' | 'createdAt' | 'createdBy' | 'model'>;
    return {
      id: row.id,
      caseId,
      createdAt: row.created_at.toISOString(),
      createdBy: row.created_by,
      model: { ...this.models.info(), mode: row.provider as ModelInfo['mode'], model: row.model, embeddings: row.embedding_model ?? '' },
      ...p,
    };
  }

  /** Answers a question from the facts closest to it in the stored record. */
  async ask(
    caseId: number,
    caller: Caller,
    question: string,
  ): Promise<{ recordId: number; factIds: string[]; answer: CheckedText; notice?: string }> {
    const record = (await this.latestInvestigation(caseId, caller.tenantId)) ?? (await this.investigate(caseId, caller));
    const { vectors } = await this.models.embed([question]);
    const core = record.facts.filter((f) => f.kind === 'subject' || f.kind === 'transaction').map((f) => f.id);
    const ids = [...new Set([...core, ...topK(vectors[0], record.vectors, 8)])];
    const facts = record.facts.filter((f) => ids.includes(f.id));
    const reply = await this.models.chatJson<{ answer?: unknown }>(ASK_PROMPT, `Question: ${question}\n\nCase facts:\n${factLines(facts)}`);
    const answer = reply ? checkAll(toSentences(reply.answer), record.facts, 'model') : null;
    if (answer?.sentences.length) return { recordId: record.id, factIds: ids, answer };
    // the closest facts that pass the checks (a fact holding an account number would not), at most three
    const ranked = topK(vectors[0], record.vectors, FALLBACK_CANDIDATES);
    const fallback: Sentence[] = ranked.map((id) => ({ text: record.facts.find((f) => f.id === id)!.text, cites: [id] }));
    const checked = checkAll(fallback, record.facts, 'code');
    return {
      recordId: record.id,
      factIds: ids,
      answer: { ...checked, sentences: checked.sentences.slice(0, FALLBACK_FACTS), removed: [] },
      notice: reply ? 'The model answer did not pass the checks; these are the closest facts.' : noticeFor(this.models.info()),
    };
  }

  /** Drafts the STR/SAR from the stored investigation record: retrieval per section, drafting, checks, goAML XML. */
  async draftSar(caseId: number, caller: Caller, refresh = false): Promise<SarDraft> {
    const existing = refresh ? null : await this.latestInvestigation(caseId, caller.tenantId);
    const record = existing ?? (await this.investigate(caseId, caller));
    const cf = await this.caseFacts.load(caseId, caller.tenantId);
    const { facts } = record;
    const queries = await this.models.embed(SECTIONS.map((s) => s.query));
    const picked = SECTIONS.map((s, i) => {
      const always = facts.filter((f) => s.always.includes(f.kind)).map((f) => f.id);
      return [...new Set([...always, ...topK(queries.vectors[i], record.vectors, 8)])];
    });
    const prompt = SECTIONS.map(
      (s, i) => `## ${s.key}: ${s.title} - ${s.guidance}\n${factLines(facts.filter((f) => picked[i].includes(f.id)))}`,
    ).join('\n\n');
    const reply = await this.models.chatJson<Record<string, unknown>>(SAR_PROMPT, prompt);

    const sections: SarSection[] = SECTIONS.map((s, i) => {
      const own = facts.filter((f) => picked[i].includes(f.id));
      const modelText = reply ? checkAll(toSentences(reply[s.key]), facts, 'model', true) : null;
      return {
        key: s.key,
        title: s.title,
        factIds: picked[i],
        text: preferModel(modelText, checkAll(codeSection(s.key, own, cf), facts, 'code', true)),
      };
    });
    const text = (k: string): string =>
      sections
        .find((s) => s.key === k)!
        .text.sentences.map((x) => x.text)
        .join(' ');
    const narrative = SECTIONS.filter((s) => s.key !== 'action')
      .map((s) => `${s.title}: ${text(s.key)}`)
      .join('\n\n');
    const txs = reportTransactions(cf);
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
      transactions: txs,
    });
    const checks = sarChecks(cf, sections, xml, txs, rentityId, record.id, record.createdAt);
    const info = this.models.info();
    const notice = reply ? undefined : noticeFor(info);
    const payload = { sections, indicators: inds, goamlXml: xml, checks, notice };
    const row = await this.prisma.copilotRecord.create({
      data: {
        case_id: caseId,
        tenant_id: caller.tenantId,
        kind: KIND_SAR,
        parent_id: record.id,
        created_by: caller.userId,
        provider: info.mode,
        model: info.model,
        embedding_model: info.embeddings,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
    return { id: row.id, caseId, investigationRecordId: record.id, createdAt: row.created_at.toISOString(), model: info, ...payload };
  }

  /** Where the latest draft stands in the review workflow, with its full history. */
  async reviewState(caseId: number, tenantId: string): Promise<ReviewState> {
    const draft = await this.prisma.copilotRecord.findFirst({
      where: { case_id: caseId, tenant_id: tenantId, kind: KIND_SAR },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    if (!draft) return { draftId: null, status: 'DRAFT', events: [], allowed: [] };
    const rows = await this.prisma.copilotRecord.findMany({
      where: { case_id: caseId, tenant_id: tenantId, kind: KIND_REVIEW, parent_id: draft.id },
      orderBy: { id: 'asc' },
    });
    const events = rows.map((r): ReviewEvent => {
      const p = r.payload as unknown as Pick<ReviewEvent, 'action' | 'actorName' | 'role' | 'comment' | 'reference'>;
      return { id: r.id, draftId: draft.id, actorId: r.created_by, at: r.created_at.toISOString(), ...p };
    });
    const status = statusOf(events);
    return { draftId: draft.id, status, events, allowed: allowedActions(status) };
  }

  /** Submit, approve, return, withdraw or file the latest draft. Refused with a reason when the workflow does not allow it. */
  async reviewAction(
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
    const info = this.models.info();
    const payload = {
      action,
      role,
      actorName: caller.name,
      comment: comment.trim().slice(0, 2000),
      reference: reference?.trim().slice(0, 200),
    };
    await this.prisma.copilotRecord.create({
      data: {
        case_id: caseId,
        tenant_id: caller.tenantId,
        kind: KIND_REVIEW,
        parent_id: state.draftId,
        created_by: caller.userId,
        provider: info.mode,
        payload,
      },
    });
    return await this.reviewState(caseId, caller.tenantId);
  }

  async latestSar(caseId: number, tenantId: string): Promise<SarDraft | null> {
    const row = await this.prisma.copilotRecord.findFirst({
      where: { case_id: caseId, tenant_id: tenantId, kind: KIND_SAR },
      orderBy: { id: 'desc' },
    });
    if (!row) return null;
    const p = row.payload as unknown as Omit<SarDraft, 'id' | 'caseId' | 'investigationRecordId' | 'createdAt' | 'model'>;
    return {
      id: row.id,
      caseId,
      investigationRecordId: row.parent_id ?? 0,
      createdAt: row.created_at.toISOString(),
      model: { ...this.models.info(), mode: row.provider as ModelInfo['mode'], model: row.model },
      ...p,
    };
  }
}

/**
 * The model's text when most of it passed the checks. Otherwise the text written by code, with everything the
 * model wrote listed as removed, so the reader can see what was dropped and why.
 */
export function preferModel(model: CheckedText | null, code: CheckedText): CheckedText {
  if (!model) return code;
  if (model.sentences.length >= Math.max(1, model.removed.length)) return model;
  const dropped = model.sentences.map((x) => ({
    ...x,
    ok: false,
    reasons: ['dropped with the rest of the model text, most of which failed the checks'],
  }));
  return { ...code, removed: [...model.removed, ...dropped] };
}

function noticeFor(info: ModelInfo): string {
  return info.mode === 'off'
    ? 'The copilot model is switched off; this text was written by code from the facts.'
    : `The ${info.mode === 'bundled' ? 'bundled' : 'configured'} model (${info.model ?? 'not set'}) did not answer; this text was written by code from the facts.`;
}

type FactsOf = (kind: Fact['kind']) => Fact[];

/** Suggested next steps: each applies when its rules fired or its facts are missing, and cites what motivates it. */
const NEXT_STEPS: Array<{ when: (has: (rule: string) => boolean, of: FactsOf) => boolean; text: string; cite: (of: FactsOf) => Fact[] }> = [
  {
    when: (_, of) => !of('kyc').length,
    text: 'Add the customer KYC extract (occupation, declared income or turnover, customer since) so activity can be compared with the profile.',
    cite: (of) => of('subject'),
  },
  {
    when: (_, of) => !of('screening').length,
    text: 'Screen the subject and the main counterparties against sanctions, PEP and adverse media lists.',
    cite: (of) => of('subject'),
  },
  {
    when: (has) => ['024', '016', '001', '090', '017'].some(has),
    text: 'Trace where the onward payments went and ask the receiving institutions to hold the funds where possible.',
    cite: (of) => of('counterparty'),
  },
  {
    when: (has, of) => has('091') || of('pattern').some((f) => f.text.includes('currency transaction report threshold')),
    text: 'Review branch teller records for the cash deposits and request a source-of-funds declaration as part of routine due diligence.',
    cite: (of) => of('pattern').filter((f) => f.text.includes('cash deposits')),
  },
  {
    when: (has) => ['074', '075', '030'].some(has),
    text: 'Check the device, login and beneficiary changes before the alert, and contact the customer through the registered channel to confirm the payments were authorised.',
    cite: (of) => of('transaction'),
  },
  {
    when: (has) => ['003', '004'].some(has),
    text: 'Obtain the remitter or payer identity and the purpose of the payment from the sending institution.',
    cite: (of) => of('transaction'),
  },
  {
    when: (has) => ['063', '054'].some(has),
    text: 'Compare the merchant sales and refunds with the acquirer chargeback data and consider a site visit.',
    cite: (of) => of('pattern'),
  },
];

/** Findings written by code from the facts, used without a model and whenever the model's text fails the checks. */
export function codeFindings(cf: CaseFacts): { summary: Sentence[]; redFlags: Sentence[]; nextSteps: Sentence[] } {
  const of: FactsOf = (kind) => cf.facts.filter((f) => f.kind === kind);
  const plain = (f: Fact): Sentence => ({ text: f.text, cites: [f.id] });
  const summary = (['alert', 'transaction', 'subject', 'activity'] as const).flatMap((k) => of(k).slice(0, 1)).map(plain);

  const redFlags: Sentence[] = [
    ...of('rule').map((f, i) => ({
      text: `Tazama flagged ${ruleInfo(cf.ruleIds[i]).redFlag} (rule ${ruleNumber(cf.ruleIds[i])}).`,
      cites: [f.id],
    })),
    ...of('pattern').slice(0, 4).map(plain),
  ];

  const has = (r: string): boolean => cf.ruleIds.some((id) => ruleNumber(id) === r);
  const steps: Sentence[] = NEXT_STEPS.filter((st) => st.when(has, of)).map((st) => ({
    text: st.text,
    cites: st
      .cite(of)
      .slice(0, 2)
      .map((f) => f.id),
  }));
  steps.push({
    text: 'Record the findings in the investigation notes and propose an outcome for supervisor approval.',
    cites: of('case')
      .slice(0, 1)
      .map((f) => f.id),
  });
  return { summary, redFlags, nextSteps: steps.slice(0, 5) };
}
