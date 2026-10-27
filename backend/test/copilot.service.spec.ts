import { NotFoundException } from '@nestjs/common';
import { CaseFactsService, htmlToText } from '../src/modules/copilot/case-facts.service';
import { codeFindings } from '../src/modules/copilot/findings';
import { InvestigationService } from '../src/modules/copilot/investigation.service';
import { type InvestigationStrategy, PipelineStrategy } from '../src/modules/copilot/investigation.strategy';
import { MeaningCheck } from '../src/modules/copilot/meaning-check';
import { ModelProviderService, parseJsonObject } from '../src/modules/copilot/model-provider.service';
import { RecordStore } from '../src/modules/copilot/record-store.service';
import { SarService } from '../src/modules/copilot/sar.service';
import { ALERT_DATA, KYC, SUBJECT, T0, TRIGGER_E2E, muleHistory } from './copilot.fixtures';

const CALLER = { userId: '5fb927ab-d31b-46f7-87c9-0a069b8df9ee', tenantId: 'TAZAMA', name: 'cms investigator', email: 'inv@tazama.org' };

/** Prisma-style where: plain values must be equal; { not: null } and { gt: n } are supported. */
const matches = (row: any, where: Record<string, any>): boolean =>
  Object.entries(where).every(([k, v]) => {
    if (v !== null && typeof v === 'object' && 'not' in v) return row[k] !== v.not;
    if (v !== null && typeof v === 'object' && 'gt' in v) return row[k] > v.gt;
    return row[k] === v;
  });

function prismaMock(): any {
  const history = muleHistory();
  const records: any[] = [];
  const mock: any = {
    records,
    case: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.case_id !== 42
          ? null
          : {
              case_id: 42,
              tenant_id: 'TAZAMA',
              status: 'STATUS_82_CLOSED_CONFIRMED',
              priority: 'HIGH',
              case_type: 'FRAUD_AND_AML',
              created_at: T0,
              alert: { alert_id: 7, created_at: T0, alert_data: ALERT_DATA, priority_score: 0.75, confidence_per: 88, transaction: { FIToFIPmtSts: { TxInfAndSts: { OrgnlEndToEndId: TRIGGER_E2E } } } },
              investigationGroup: null,
              tasks: [{ task_id: 3, name: 'Investigate Case', investigationNotes: '<p>Recall requests received.</p><p>No reply to call-back.</p>', assigned_user_id: 'u', updated_at: T0 }],
            },
      ),
    },
    transactionData: { findMany: jest.fn(async () => [{ transactionData: { TxTp: 'pacs.002.001.12' } }, { transactionData: history.find((m: any) => m.FIToFICstmrCdtTrf.GrpHdr.MsgId === TRIGGER_E2E) }]) },
    $queryRaw: jest.fn(async () => history.map((m: any) => ({ transactionData: m }))),
    comment: {
      findMany: jest.fn(async () => [
        { comment_id: 9, user_id: 'u1', case_id: 42, task_id: 3, note: KYC, created_at: T0 },
        { comment_id: 10, user_id: 'u2', case_id: null, task_id: 3, note: 'Supervisor Approval:\nAgree. Refer for STR.', created_at: T0 },
      ]),
    },
    cms_usernames: { findMany: jest.fn(async () => [{ user_id: 'u1', name: 'cms investigator' }]) },
    copilotRecord: {
      create: jest.fn(async ({ data }: any) => {
        const row = { ...data, id: records.length + 1, created_at: data.created_at ?? new Date() };
        records.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(records.find((r) => r.id === where.id), data)),
      findFirst: jest.fn(async ({ where }: any) => [...records].reverse().find((r) => matches(r, where)) ?? null),
      findMany: jest.fn(async ({ where }: any) => records.filter((r) => matches(r, where))),
    },
    $transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => await work(mock)),
  };
  return mock;
}

function setup(env: Record<string, string>, reply?: (body: any) => unknown): { service: InvestigationService; sar: SarService; prisma: any; fetchMock: jest.Mock } {
  for (const k of Object.keys(process.env).filter((k) => k.startsWith('COPILOT_'))) delete process.env[k];
  Object.assign(process.env, env);
  const fetchMock = jest.fn(async (url: string, init?: any) => {
    if (url.endsWith('/models')) return { ok: true, json: async () => ({ data: [{ id: 'm' }] }) };
    if (url.endsWith('/embeddings')) return { ok: false, status: 404, text: async () => 'no' };
    const body = JSON.parse(init.body);
    const content = reply ? reply(body) : null;
    if (content === null) return { ok: false, status: 503, text: async () => 'down' };
    return { ok: true, json: async () => ({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] }) };
  });
  global.fetch = fetchMock as any;
  const prisma = prismaMock();
  const models = new ModelProviderService();
  const caseFacts = new CaseFactsService(prisma);
  const meaning = new MeaningCheck(models);
  const service = new InvestigationService(new RecordStore(prisma), caseFacts, models, new PipelineStrategy(models), meaning);
  const sar = new SarService(new RecordStore(prisma), caseFacts, models, service, meaning);
  return { service, sar, prisma, fetchMock };
}

describe('InvestigationService and SarService', () => {
  it('runs with the model off: code-written findings, stored record with vectors', async () => {
    const { service, prisma } = setup({ COPILOT_MODE: 'off' });
    const r = await service.investigate(42, CALLER);
    expect(r.model.mode).toBe('off');
    expect(r.summary.writtenBy).toBe('code');
    expect(r.summary.removed).toEqual([]);
    expect(r.redFlags.sentences.length).toBeGreaterThan(3);
    expect(Object.keys(r.vectors)).toHaveLength(r.facts.length);
    expect(r.notice).toMatch(/switched off/);
    expect(prisma.records[0].kind).toBe('INVESTIGATION');
    expect((await service.latest(42, 'TAZAMA'))?.id).toBe(r.id);
    expect(await service.latest(42, 'OTHER')).toBeNull();
    expect(await service.status()).toMatchObject({ mode: 'off', reachable: false, strategy: 'pipeline' });
  });

  it('keeps checked model sentences and removes the ones that fail', async () => {
    const { service } = setup({ COPILOT_MODE: 'byok', COPILOT_BYOK_URL: 'https://llm.example.com/v1', COPILOT_BYOK_API_KEY: 'k', COPILOT_BYOK_MODEL: 'big' }, (body) => {
      const facts: string = body.messages[1].content;
      const id = /(F\d+) \[activity\] Between/.exec(facts)![1];
      return {
        summary: [
          { text: 'Hamza Rafiq received 3 credits totalling PKR 450,000.', cites: [id] },
          { text: 'Hamza Rafiq received PKR 999,999.', cites: [id] },
        ],
        red_flags: ['Funds moved on quickly [F1].'],
        next_steps: [{ text: 'Tell the customer about the STR.', cites: ['F1'] }],
      };
    });
    const r = await service.investigate(42, CALLER);
    expect(r.model).toMatchObject({ mode: 'byok', model: 'big', dataLeavesDeployment: true });
    expect(r.summary.writtenBy).toBe('model');
    expect(r.summary.sentences).toHaveLength(1);
    expect(r.summary.removed[0].reasons[0]).toMatch(/999999/);
    expect(r.nextSteps.writtenBy).toBe('code');
    expect(await service.status()).toMatchObject({ reachable: true });
  });

  it('replaces mostly wrong model text with code text and lists what was dropped', async () => {
    const { service } = setup({ COPILOT_MODE: 'bundled' }, (body) => {
      const id = /(F\d+) \[activity\] Between/.exec(body.messages[1].content)![1];
      return { summary: [`Hamza Rafiq received 3 credits [${id}].`, `He received PKR 999,999 [${id}].`, `He sent PKR 888,888 onward [${id}].`] };
    });
    const r = await service.investigate(42, CALLER);
    expect(r.summary.writtenBy).toBe('code');
    expect(r.summary.removed.map((x) => x.reasons[0])).toEqual([
      'the number 999999 is not in the cited facts',
      'the number 888888 is not in the cited facts',
      'dropped with the rest of the model text, most of which failed the checks',
    ]);
  });

  it('answers questions from the nearest facts, with a code fallback', async () => {
    const { service } = setup({ COPILOT_MODE: 'bundled' }, (body) => (body.messages[1].content.includes('cash') ? null : { answer: [{ text: 'The case data does not show this.', cites: [] }] }));
    const a = await service.ask(42, CALLER, 'Who sent the money?');
    expect(a.answer.writtenBy).toBe('model');
    expect(a.factIds.length).toBeGreaterThan(2);
    const b = await service.ask(42, CALLER, 'Any cash deposits?');
    expect(b.answer.writtenBy).toBe('code');
    expect(b.notice).toBeDefined();
    expect(b.recordId).toBe(a.recordId);
  });

  it('keeps every question and answer, linked to the investigation record, for audit', async () => {
    const { service, prisma } = setup({ COPILOT_MODE: 'bundled' }, () => ({ answer: [{ text: 'The case data does not show this.', cites: [] }] }));
    const a = await service.ask(42, CALLER, 'Who sent the money?');
    const asks = prisma.records.filter((r: any) => r.kind === 'ASK');
    expect(asks).toHaveLength(1);
    expect(asks[0]).toMatchObject({ parent_id: a.recordId, created_by: CALLER.userId, provider: 'bundled', tenant_id: 'TAZAMA' });
    expect(asks[0].payload).toMatchObject({ question: 'Who sent the money?', answer: { writtenBy: 'model' } });
  });

  it('returns the agent trace with an answer, so the chat can show how it was produced', async () => {
    const { prisma } = setup({ COPILOT_MODE: 'off' });
    const agent = { stopped: 'answered' as const, calls: [], factIds: [], fellBack: false };
    const strategy: InvestigationStrategy = {
      name: 'agent',
      investigate: async (facts) => ({ reply: null, raw: null, evidence: facts }),
      answer: async (_question, facts) => ({ reply: { answer: ['The case data does not show this.'] }, raw: null, evidence: facts, agent }),
    };
    const models = new ModelProviderService();
    const service = new InvestigationService(new RecordStore(prisma), new CaseFactsService(prisma), models, strategy, new MeaningCheck(models));
    const a = await service.ask(42, CALLER, 'Which device was used?');
    expect(a.answer.writtenBy).toBe('model');
    expect(a.agent).toEqual(agent);
  });

  it('drafts a SAR from the stored record, linked to it, with goAML XML and checks', async () => {
    const { service, sar, prisma } = setup({ COPILOT_MODE: 'off', GOAML_RENTITY_ID: 'RE-123' });
    const first = await service.investigate(42, CALLER);
    const d = await sar.draft(42, CALLER);
    expect(d.investigationRecordId).toBe(first.id);
    expect(d.sections.map((s) => s.key)).toEqual(['subject', 'activity', 'grounds', 'investigation', 'action']);
    expect(d.sections.every((s) => s.text.sentences.length > 0)).toBe(true);
    expect(d.goamlXml).toContain('<rentity_id>RE-123</rentity_id>');
    expect(d.goamlXml).toContain(SUBJECT);
    expect(d.checks.every((c) => c.ok)).toBe(true);
    expect(prisma.records.at(-1)).toMatchObject({ kind: 'SAR_DRAFT', parent_id: first.id });
    expect((await sar.latest(42, 'TAZAMA'))?.id).toBe(d.id);
    expect(await sar.latest(1, 'TAZAMA')).toBeNull();
    const refreshed = await sar.draft(42, CALLER, true);
    expect(refreshed.investigationRecordId).not.toBe(first.id);
  });

  it('uses model SAR sections when they pass the checks', async () => {
    const { sar } = setup({ COPILOT_MODE: 'bundled' }, (body) => {
      if (body.messages[0].content.includes('investigation copilot')) return 'not json';
      const id = /(F\d+) \[subject\]/.exec(body.messages[1].content)![1];
      return { subject: [{ text: 'Hamza Rafiq held the account.', cites: [id] }] };
    });
    const d = await sar.draft(42, CALLER);
    expect(d.sections[0].text.writtenBy).toBe('model');
    expect(d.sections[1].text.writtenBy).toBe('code');
  });

  it('rejects unknown cases', async () => {
    const { service } = setup({ COPILOT_MODE: 'off' });
    await expect(service.investigate(1, CALLER)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ModelProviderService', () => {
  it('describes each mode', () => {
    setup({ COPILOT_MODE: 'bundled' });
    expect(new ModelProviderService().info()).toMatchObject({ mode: 'bundled', model: 'qwen3-4b-instruct-2507', license: 'Apache-2.0', endpoint: 'localhost:8091', dataLeavesDeployment: false, embeddings: 'builtin-hash-512' });
    setup({ COPILOT_MODE: 'nonsense' });
    expect(new ModelProviderService().mode).toBe('bundled');
  });

  it('falls back to built-in embeddings when the provider fails', async () => {
    setup({ COPILOT_MODE: 'bundled', COPILOT_EMBEDDINGS: 'provider', COPILOT_EMBEDDING_MODEL: 'nomic-embed-text-v1.5' });
    const p = new ModelProviderService();
    expect(p.info().embeddings).toBe('nomic-embed-text-v1.5');
    const r = await p.embed(['a b c']);
    expect(r.model).toBe('builtin-hash-512');
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data: [{ embedding: [3, 4] }] }) })) as any;
    expect((await p.embed(['x'])).vectors[0]).toEqual([0.6, 0.8]);
    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    }) as any;
    expect((await p.embed(['x'])).model).toBe('builtin-hash-512');
    expect(await p.reachable()).toBe(false);
    expect(await p.chatJson('s', 'u')).toEqual({ value: null, raw: null });
  });

  it('parses fenced and wrapped JSON', () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonObject('Sure: {"a":2} done')).toEqual({ a: 2 });
    expect(parseJsonObject('{broken} {')).toBeNull();
    expect(parseJsonObject('nothing')).toBeNull();
  });
});

describe('copilot helpers', () => {
  it('turns rich-text notes into text', () => {
    expect(htmlToText('<p>A &amp; B</p><p>C&nbsp;D</p>')).toBe('A & B\nC D');
  });

  it('suggests next steps from the rules that fired', () => {
    const f = codeFindings({ caseId: 1, tenantId: 't', status: 's', caseType: null, alertId: null, alertAt: null, subject: null, counterparty: null, trigger: null, window: [], knownCounterparties: [], ruleIds: ['091@1.0.0', '074@1.0.0', '003@1.0.0', '063@1.0.0'], typology: null, score: null, facts: [{ id: 'F1', kind: 'case', text: 'Case 1.', source: 's' }] });
    expect(f.nextSteps.map((s) => s.text).join(' ')).toMatch(/KYC extract.*Screen/);
    expect(f.nextSteps).toHaveLength(5);
  });
});
