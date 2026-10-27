import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ANY_CLAIMS_KEY, TazamaClaims } from '../src/decorators/auth.decorator';
import type { CheckedText, Fact } from '../src/modules/copilot/copilot.types';
import { FeedbackController, GovernanceController } from '../src/modules/copilot/governance.controller';
import { FeedbackRefused, GovernanceService } from '../src/modules/copilot/governance.service';
import { MeaningCheck } from '../src/modules/copilot/meaning-check';
import { PROMPT_VERSION } from '../src/modules/copilot/prompts';
import { provenanceOf } from '../src/modules/copilot/provenance';
import { canonical, recordHash } from '../src/modules/copilot/record-chain';
import { RecordStore, type StoredRecord } from '../src/modules/copilot/record-store.service';
import { goamlXml } from '../src/modules/copilot/sar';

const CALLER = { userId: '5fb927ab-d31b-46f7-87c9-0a069b8df9ee', tenantId: 'TAZAMA', name: 'cms investigator' };

/** In-memory copilot_records with the Prisma calls RecordStore makes. */
function recordsDb(): any {
  const rows: any[] = [];
  const matches = (r: any, where: Record<string, any>): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (v !== null && typeof v === 'object' && 'not' in v) return r[k] !== v.not;
      if (v !== null && typeof v === 'object' && 'gt' in v) return r[k] > v.gt;
      return r[k] === v;
    });
  const db: any = {
    rows,
    $queryRaw: jest.fn(async () => []),
    $transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => await work(db)),
    copilotRecord: {
      create: jest.fn(async ({ data }: any) => {
        const row = { ...data, id: rows.length + 1, created_at: data.created_at ?? new Date() };
        rows.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(rows.find((r) => r.id === where.id), data)),
      findFirst: jest.fn(async ({ where }: any) => [...rows].reverse().find((r) => matches(r, where)) ?? null),
      findMany: jest.fn(async ({ where, take }: any) => rows.filter((r) => matches(r, where)).slice(0, take ?? rows.length)),
    },
  };
  return db;
}

const write = async (store: RecordStore, payload: object, kind: any = 'INVESTIGATION'): Promise<StoredRecord> =>
  await store.create({ caseId: 17, tenantId: 'TAZAMA', kind, userId: CALLER.userId, provider: 'bundled', model: 'm', payload });

describe('record chain', () => {
  it('writes the same text for the same content, whatever the key order, and drops undefined like JSONB', () => {
    expect(canonical({ b: 1, a: { d: [2, { y: 1, x: 2 }], c: undefined } })).toBe('{"a":{"d":[2,{"x":2,"y":1}]},"b":1}');
    expect(canonical({ a: 1, b: 2 })).toBe(canonical({ b: 2, a: 1 }));
  });

  it('changes the hash when the content or the previous hash changes', () => {
    const base = { caseId: 1, tenantId: 't', kind: 'ASK', parentId: null, createdBy: 'u', provider: 'off', model: null, embeddingModel: null, payload: { a: 1 }, createdAt: '2026-10-28T00:00:00.000Z', prevHash: null };
    expect(recordHash(base)).toMatch(/^[0-9a-f]{64}$/v);
    expect(recordHash({ ...base, payload: { a: 2 } })).not.toBe(recordHash(base));
    expect(recordHash({ ...base, prevHash: 'x' })).not.toBe(recordHash(base));
  });

  it('links each record to the one before and verifies the whole chain', async () => {
    const db = recordsDb();
    const store = new RecordStore(db);
    await write(store, { n: 1, skip: undefined });
    await write(store, { n: 2 });
    expect(db.rows[0].prev_hash).toBeNull();
    expect(db.rows[1].prev_hash).toBe(db.rows[0].hash);
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(await store.verifyChain('TAZAMA')).toEqual({ ok: true, checked: 2, unchained: 0, head: db.rows[1].hash });
  });

  it('finds a record changed after it was written', async () => {
    const db = recordsDb();
    const store = new RecordStore(db);
    await write(store, { summary: 'kept' });
    await write(store, { summary: 'next' });
    db.rows[0].payload = { summary: 'edited later' };
    expect(await store.verifyChain('TAZAMA')).toMatchObject({ ok: false, brokenAt: 1, reason: 'the record was changed after it was written' });
  });

  it('finds a removed record, and counts records written before the chain existed', async () => {
    const db = recordsDb();
    db.rows.push({ id: 1, tenant_id: 'TAZAMA', hash: null, prev_hash: null });
    const store = new RecordStore(db);
    await write(store, { n: 1 });
    await write(store, { n: 2 });
    await write(store, { n: 3 });
    db.rows.splice(2, 1); // record 3
    expect(await store.verifyChain('TAZAMA')).toMatchObject({ ok: false, checked: 1, unchained: 1, brokenAt: 4, reason: 'the record before it was removed or changed' });
  });

  it('writes each new hash to the audit log as well, and a failing audit log does not stop the write', async () => {
    const audit = { init: jest.fn(), log: jest.fn(async () => ({})) };
    const store = new RecordStore(recordsDb(), audit as any);
    const r = await write(store, { n: 1 }, 'ASK');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'COPILOT_RECORD_WRITTEN', resourceId: String(r.id), outcome: expect.objectContaining({ kind: 'ASK', hash: expect.any(String) }) }),
    );
    audit.log.mockRejectedValueOnce(new Error('opensearch down'));
    await expect(write(store, { n: 2 })).resolves.toMatchObject({ id: 2 });
  });
});

describe('meaning check', () => {
  const facts: Fact[] = [{ id: 'F13', kind: 'activity', text: 'Credits in the 30-day window were 1.0 times the earlier monthly average.', source: 's' }];
  const text: CheckedText = {
    writtenBy: 'model',
    removed: [],
    sentences: [
      { text: 'Credits rose 1.0 times.', cites: ['F13'], ok: true, reasons: [] },
      { text: 'Credits matched the earlier average.', cites: ['F13'], ok: true, reasons: [] },
      { text: 'The case data does not show this.', cites: [], ok: true, reasons: [] },
    ],
  };
  const judge = (value: unknown): any => ({ chatJson: jest.fn(async () => ({ value, raw: JSON.stringify(value) })) });
  const on = (models: any): MeaningCheck => {
    process.env.COPILOT_MEANING_CHECK = 'true';
    const check = new MeaningCheck(models);
    delete process.env.COPILOT_MEANING_CHECK;
    return check;
  };

  it('is off unless switched on, and never reads code-written text', async () => {
    const models = judge({ verdicts: [{ n: 1, supported: false }] });
    expect(await new MeaningCheck(models).review(text, facts)).toBe(text);
    expect(await on(models).review({ ...text, writtenBy: 'code' }, facts)).toEqual({ ...text, writtenBy: 'code' });
    expect(models.chatJson).not.toHaveBeenCalled();
  });

  it('removes a cited sentence whose facts do not say it, with the reason, and judges only cited sentences', async () => {
    const models = judge({ verdicts: [{ n: 1, supported: false, reason: '1.0 times is no increase' }, { n: 2, supported: true }, { n: 9, supported: false }] });
    const r = await on(models).review(text, facts);
    expect(r!.sentences.map((s) => s.text)).toEqual(['Credits matched the earlier average.', 'The case data does not show this.']);
    expect(r!.removed[0].reasons[0]).toBe('the meaning check found the cited facts do not say this: 1.0 times is no increase');
    const sent: string = models.chatJson.mock.calls[0][1];
    expect(sent).toContain('2. Credits matched');
    expect(sent).toContain('F13: Credits in the 30-day window');
    expect(sent).not.toContain('does not show this');
  });

  it('keeps the text as the code checks left it when the second reading fails', async () => {
    expect(await on(judge(null)).review(text, facts)).toBe(text);
    expect(await on(judge({ verdicts: 'nonsense' })).review(text, facts)).toBe(text);
  });
});

describe('provenance', () => {
  afterEach(() => jest.restoreAllMocks());

  it('names the prompt version, settings and the model file and build llama.cpp serves', async () => {
    expect(PROMPT_VERSION).toMatch(/^[0-9a-f]{12}$/v);
    const models: any = {
      settings: () => ({ temperature: 0.1, maxTokens: 1200 }),
      served: async () => ({ model: 'qwen3-4b-instruct-2507', file: 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf', build: 'b11398' }),
    };
    expect(await provenanceOf(models, 'agent', true)).toEqual({
      promptVersion: PROMPT_VERSION,
      strategy: 'agent',
      temperature: 0.1,
      maxTokens: 1200,
      meaningCheck: true,
      served: { model: 'qwen3-4b-instruct-2507', file: 'Qwen3-4B-Instruct-2507-Q4_K_M.gguf', build: 'b11398' },
    });
  });
});

describe('governance service', () => {
  const record = (over: Partial<StoredRecord> & { payload: unknown }): StoredRecord => ({
    id: 1,
    caseId: 17,
    kind: 'INVESTIGATION',
    parentId: null,
    createdBy: CALLER.userId,
    provider: 'bundled',
    model: 'm',
    embeddingModel: null,
    createdAt: new Date('2026-10-27T10:00:00Z'),
    ...over,
  });
  const text = (writtenBy: 'model' | 'code', kept: number, reasons: string[]): CheckedText => ({
    writtenBy,
    sentences: Array.from({ length: kept }, () => ({ text: 's', cites: ['F1'], ok: true, reasons: [] })),
    removed: reasons.map((r) => ({ text: 'x', cites: ['F1'], ok: false, reasons: [r] })),
  });
  const models: any = { info: () => ({ mode: 'bundled' }) };

  it('records a rating of an output of this case, and refuses anything else', async () => {
    const store: any = { byId: jest.fn(async (_c: number, _t: string, id: number) => (id === 5 ? record({ id: 5, kind: 'ASK', payload: {} }) : id === 6 ? record({ id: 6, kind: 'SAR_REVIEW', payload: {} }) : null)), create: jest.fn(async () => record({ id: 9, kind: 'FEEDBACK', payload: {} })) };
    const g = new GovernanceService(store, models);
    expect(await g.rate(17, CALLER, 5, 'down', '  wrong device  ')).toMatchObject({ id: 9, recordId: 5, rating: 'down', comment: 'wrong device' });
    expect(store.create).toHaveBeenCalledWith(expect.objectContaining({ kind: 'FEEDBACK', parentId: 5, payload: expect.objectContaining({ rating: 'down', ratedKind: 'ASK' }) }));
    await expect(g.rate(17, CALLER, 6, 'up', '')).rejects.toBeInstanceOf(FeedbackRefused);
    await expect(g.rate(17, CALLER, 7, 'up', '')).rejects.toBeInstanceOf(FeedbackRefused);
  });

  it('reports models, checks, agent fallbacks, ratings, reviews and the chain for the period', async () => {
    const provenance = { promptVersion: 'abc123abc123', strategy: 'agent', served: { model: 'm', file: 'q.gguf', build: 'b1' } };
    const store: any = {
      since: jest.fn(async () => [
        record({ id: 1, payload: { summary: text('model', 3, ['the number 999 is not in the cited facts']), redFlags: text('model', 2, []), nextSteps: text('code', 2, []), provenance, agent: { fellBack: false } } }),
        record({ id: 2, kind: 'ASK', parentId: 1, payload: { answer: text('model', 1, ['the number 12 is not in the cited facts']), provenance, agent: { fellBack: true } } }),
        record({ id: 3, kind: 'SAR_DRAFT', parentId: 1, model: null, provider: 'off', payload: { sections: [{ text: text('code', 2, []) }] } }),
        record({ id: 4, kind: 'SAR_REVIEW', parentId: 3, payload: { action: 'SUBMIT' } }),
        record({ id: 5, kind: 'FEEDBACK', parentId: 2, payload: { rating: 'down', comment: 'missed the device' } }),
        record({ id: 6, kind: 'FEEDBACK', parentId: 1, payload: { rating: 'up', comment: '' } }),
      ]),
      verifyChain: jest.fn(async () => ({ ok: true, checked: 6, unchained: 0, head: 'h' })),
    };
    const r = await new GovernanceService(store, models).report('TAZAMA', 30, new Date('2026-10-28T00:00:00Z'));
    expect(store.since).toHaveBeenCalledWith('TAZAMA', new Date('2026-09-28T00:00:00Z'));
    expect(r.records).toEqual({ INVESTIGATION: 1, ASK: 1, SAR_DRAFT: 1, SAR_REVIEW: 1, FEEDBACK: 2 });
    expect(r.models).toEqual([
      { provider: 'bundled', model: 'm', file: 'q.gguf', build: 'b1', promptVersion: 'abc123abc123', strategy: 'agent', records: 2 },
      { provider: 'off', model: null, promptVersion: 'not recorded', strategy: 'pipeline', records: 1 },
    ]);
    expect(r.writing).toEqual({ modelParts: 3, codeParts: 2, sentencesKept: 6, sentencesRemoved: 2, removalReasons: [{ reason: 'the number # is not in the cited facts', count: 2 }] });
    expect(r.agent).toEqual({ runs: 2, fellBack: 1 });
    expect(r.feedback).toEqual({ up: 1, down: 1, recent: [{ recordId: 2, rating: 'down', comment: 'missed the device', at: '2026-10-27T10:00:00.000Z' }] });
    expect(r.review).toEqual({ SUBMIT: 1 });
    expect(r.chain.ok).toBe(true);
  });
});

describe('governance controllers', () => {
  const req: any = { user: { token: { clientId: CALLER.userId, tenantId: 'TAZAMA' }, actorName: 'x', validClaims: [] } };

  it('accepts only a record id and an up or down rating, and answers 404 for a record outside the case', async () => {
    const governance: any = { rate: jest.fn(async () => ({ id: 1 })) };
    const c = new FeedbackController(governance);
    await expect(c.rate(17, { recordId: 5, rating: 'meh' }, req)).rejects.toBeInstanceOf(BadRequestException);
    await expect(c.rate(17, { rating: 'up' }, req)).rejects.toBeInstanceOf(BadRequestException);
    await expect(c.rate(17, { recordId: 5, rating: 'up' }, req)).resolves.toEqual({ id: 1 });
    governance.rate.mockRejectedValueOnce(new FeedbackRefused('no'));
    await expect(c.rate(17, { recordId: 5, rating: 'up' }, req)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets only supervisors and compliance officers read the report, for a fixed set of periods', async () => {
    expect(Reflect.getMetadata(ANY_CLAIMS_KEY, GovernanceController)).toEqual([TazamaClaims.CMS_SUPERVISOR, TazamaClaims.CMS_COMPLIANCE_OFFICER]);
    const governance: any = { report: jest.fn(async () => ({ ok: true })) };
    const c = new GovernanceController(governance);
    await expect(c.report(5, req)).rejects.toBeInstanceOf(BadRequestException);
    await expect(c.report(90, req)).resolves.toEqual({ ok: true });
    expect(governance.report).toHaveBeenCalledWith('TAZAMA', 90);
  });
});

describe('goAML disclosure', () => {
  it('carries the AI-assistance note as an XML comment, which cannot hold "--"', () => {
    const xml = goamlXml({
      cf: { caseId: 1, subject: null, trigger: null } as any,
      narrative: 'n',
      action: 'a',
      indicators: [],
      reportingPerson: { name: 'A B' },
      rentityId: 'RE',
      submissionDate: new Date('2026-10-28T00:00:00Z'),
      transactions: [],
      aiNote: 'Drafted with AI assistance -- record 5',
    });
    expect(xml.split('\n')[1]).toBe('<!-- Drafted with AI assistance - record 5 -->');
  });
});
