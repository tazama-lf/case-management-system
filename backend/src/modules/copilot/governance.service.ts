import { Injectable } from '@nestjs/common';
import type { AgentTrace, Caller, CheckedText, Feedback, FeedbackRating, GovernanceReport, Provenance, SarSection } from './copilot.types';
import { ModelProviderService } from './model-provider.service';
import { RecordStore, type StoredRecord } from './record-store.service';

const RATED_KINDS = ['INVESTIGATION', 'ASK', 'SAR_DRAFT'];
const MAX_COMMENT = 1000;
const TOP_REASONS = 8;
const RECENT_FEEDBACK = 10;
const DAY_MS = 86_400_000;

/** A rating that cannot be recorded; the message says why. */
export class FeedbackRefused extends Error {}

interface Written {
  texts: CheckedText[];
  provenance?: Provenance;
  agent?: AgentTrace;
}

/** The texts a record holds, whatever its kind, so they can be counted the same way. */
function writtenIn(r: StoredRecord): Written | null {
  const p = r.payload as Record<string, unknown>;
  const provenance = p.provenance as Provenance | undefined;
  if (r.kind === 'INVESTIGATION') {
    return { texts: [p.summary, p.redFlags, p.nextSteps] as CheckedText[], provenance, agent: p.agent as AgentTrace | undefined };
  }
  if (r.kind === 'ASK') return { texts: [p.answer as CheckedText], provenance, agent: p.agent as AgentTrace | undefined };
  if (r.kind === 'SAR_DRAFT') return { texts: (p.sections as SarSection[]).map((s) => s.text), provenance };
  return null;
}

/** "the number 999999 is not in the cited facts" and "the number 12 is not..." count as one reason. */
const reasonKind = (reason: string): string => reason.replace(/"[^"]*"|\d[\d,.]*|F\d+/gv, '#').slice(0, 120);

const tally = (keys: string[]): Map<string, number> => keys.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>());

/**
 * Oversight of the copilot: users rate its outputs, and supervisors and compliance officers get a report of what it
 * did in a period (models and prompt versions in use, how much model text passed the checks and why the rest was
 * removed, agent fallbacks, ratings, review outcomes) together with a check of the record chain.
 */
@Injectable()
export class GovernanceService {
  constructor(
    private readonly store: RecordStore,
    private readonly models: ModelProviderService,
  ) {}

  /** Records a rating of a copilot output of this case. */
  async rate(caseId: number, caller: Caller, recordId: number, rating: FeedbackRating, comment: string): Promise<Feedback> {
    const target = await this.store.byId(caseId, caller.tenantId, recordId);
    if (!target || !RATED_KINDS.includes(target.kind)) {
      throw new FeedbackRefused(`Record ${recordId} is not a copilot output of this case.`);
    }
    const text = comment.trim().slice(0, MAX_COMMENT);
    const row = await this.store.create({
      caseId,
      tenantId: caller.tenantId,
      kind: 'FEEDBACK',
      parentId: recordId,
      userId: caller.userId,
      provider: this.models.info().mode,
      payload: { rating, comment: text, ratedKind: target.kind, actorName: caller.name },
    });
    return { id: row.id, recordId, rating, comment: text, createdAt: row.createdAt.toISOString() };
  }

  async report(tenantId: string, days: number, now = new Date()): Promise<GovernanceReport> {
    const from = new Date(now.getTime() - days * DAY_MS);
    const records = await this.store.since(tenantId, from);
    const written = records.map((r) => ({ r, w: writtenIn(r) })).filter((x): x is { r: StoredRecord; w: Written } => x.w !== null);
    const texts = written.flatMap((x) => x.w.texts).filter(Boolean);
    const removed = texts.flatMap((t) => t.removed);
    const feedback = records
      .filter((r) => r.kind === 'FEEDBACK')
      .map((r) => ({ r, p: r.payload as { rating: FeedbackRating; comment: string } }));
    const models = tally(
      written.map(({ r, w }) =>
        JSON.stringify({
          provider: r.provider,
          model: r.model,
          file: w.provenance?.served?.file,
          build: w.provenance?.served?.build,
          promptVersion: w.provenance?.promptVersion ?? 'not recorded',
          strategy: w.provenance?.strategy ?? 'pipeline',
        }),
      ),
    );
    const agentRuns = written.map((x) => x.w.agent).filter((a): a is AgentTrace => Boolean(a));
    return {
      tenantId,
      from: from.toISOString(),
      to: now.toISOString(),
      records: Object.fromEntries(tally(records.map((r) => r.kind))),
      models: [...models].map(([key, count]) => ({ ...(JSON.parse(key) as GovernanceReport['models'][number]), records: count })),
      writing: {
        modelParts: texts.filter((t) => t.writtenBy === 'model').length,
        codeParts: texts.filter((t) => t.writtenBy === 'code').length,
        sentencesKept: texts.filter((t) => t.writtenBy === 'model').reduce((n, t) => n + t.sentences.length, 0),
        sentencesRemoved: removed.length,
        removalReasons: [...tally(removed.flatMap((s) => s.reasons.map(reasonKind)))]
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, TOP_REASONS),
      },
      agent: { runs: agentRuns.length, fellBack: agentRuns.filter((a) => a.fellBack).length },
      feedback: {
        up: feedback.filter((f) => f.p.rating === 'up').length,
        down: feedback.filter((f) => f.p.rating === 'down').length,
        recent: feedback
          .filter((f) => f.p.comment)
          .slice(-RECENT_FEEDBACK)
          .reverse()
          .map((f) => ({ recordId: f.r.parentId ?? 0, rating: f.p.rating, comment: f.p.comment, at: f.r.createdAt.toISOString() })),
      },
      review: Object.fromEntries(
        tally(records.filter((r) => r.kind === 'SAR_REVIEW').map((r) => (r.payload as { action: string }).action)),
      ),
      chain: await this.store.verifyChain(tenantId),
    };
  }
}
