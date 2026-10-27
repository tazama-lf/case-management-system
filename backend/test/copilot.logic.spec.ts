import { checkAll, checkSentence, namesIn, numbersIn, toSentences } from '../src/modules/copilot/verifier';
import { chooseSubject, computeFacts, parseKyc, statusLabel } from '../src/modules/copilot/facts';
import { readPacs008 } from '../src/modules/copilot/history';
import { cosine, embedBuiltin, topK } from '../src/modules/copilot/embeddings';
import { codeSection, goamlXml, indicators, reportTransactions, sarChecks } from '../src/modules/copilot/sar';
import type { Fact } from '../src/modules/copilot/copilot.types';
import { ALERT_DATA, KYC, SUBJECT, TRIGGER_E2E, muleHistory, pacs008 } from './copilot.fixtures';

function muleCase(notes = [{ source: 'Comment 7 on Investigate Case', author: 'cms investigator', at: new Date('2026-10-05T09:00:00Z'), text: KYC }]) {
  const history = muleHistory().map((m) => readPacs008(m)!);
  const trigger = history.find((p) => p.endToEndId === TRIGGER_E2E)!;
  return computeFacts({
    caseRow: { case_id: 42, tenant_id: 'TAZAMA', status: 'STATUS_82_CLOSED_CONFIRMED', priority: 'HIGH', case_type: 'FRAUD_AND_AML', created_at: new Date('2026-10-05T03:11:00Z') },
    alert: { alert_id: 7, created_at: new Date('2026-10-05T03:11:00Z'), alert_data: ALERT_DATA, priority_score: 0.75, confidence_per: 88 },
    trigger,
    subjectRole: chooseSubject(trigger, ['001@1.0.0', '016@1.0.0'], 'fsp001'),
    history,
    notes,
    ctrThreshold: 2_000_000,
  });
}

describe('copilot verifier', () => {
  const facts: Fact[] = [
    { id: 'F1', kind: 'activity', text: 'The account had 3 credits totalling PKR 450,000 from 3 counterparties.', source: 's' },
    { id: 'F2', kind: 'subject', text: 'The subject of the case is the creditor, Hamza Rafiq.', source: 's' },
  ];
  const map = new Map(facts.map((f) => [f.id, f]));
  const all = facts.map((f) => f.text).join(' ');

  it('normalises numbers and ignores fact ids', () => {
    expect(numbersIn('PKR 450,000.00 in 3 credits [F12], 97%')).toEqual(['450000', '3', '97']);
  });

  it('keeps a sentence whose numbers are in the cited facts', () => {
    expect(checkSentence({ text: 'Hamza Rafiq received PKR 450,000 in 3 credits.', cites: ['F1'] }, map, all).ok).toBe(true);
  });

  it('removes unsupported numbers, unknown citations, invented names, guilt, tipping off and identifiers', () => {
    const r = (text: string, cites = ['F1']): string[] => checkSentence({ text, cites }, map, all).reasons;
    expect(r('He received PKR 500,000.')[0]).toMatch(/500000/);
    expect(r('He received PKR 450,000.', ['F9'])[0]).toMatch(/F9/);
    expect(r('Money went to Bilal Khan.', ['F2'])[0]).toMatch(/Bilal Khan/);
    expect(r('Hamza Rafiq is a money launderer.', ['F2'])).toContain('states guilt or certainty as fact');
    expect(r('Inform the customer about the STR.', ['F2'])).toContain('could tip off the customer');
    expect(r('Do not inform the customer about the STR.', ['F2'])).toEqual([]);
    expect(r('Account PK36DEMO1234567890123456 received funds.', ['F2'])).toContain('puts an account or ID number in the prose');
    expect(r('He received 3 credits.', [])).toContain('has figures or names but cites no fact');
  });

  it('splits kept and removed sentences and accepts loose model shapes', () => {
    const out = checkAll(toSentences([{ text: 'There were 3 credits.', cites: ['F1'] }, 'There were 9 credits [F1].', { sentence: 'That looks fine overall.', citations: 'F2' }]), facts, 'model');
    expect(out.sentences.map((s) => s.text)).toEqual(['There were 3 credits.', 'That looks fine overall.']);
    expect(out.removed).toHaveLength(1);
    expect(namesIn('The Financial Monitoring Unit and Hamza Rafiq')).toEqual(['Hamza Rafiq']);
    expect(toSentences('not a list')).toEqual([]);
    expect(toSentences(['A new device in Peshawar was involved [F19], [F23] and [F25].'])).toEqual([{ text: 'A new device in Peshawar was involved.', cites: ['F19', 'F23', 'F25'] }]);
    expect(toSentences(['A new device in Peshawar was involved, [F19][F23]'])[0].text).toBe('A new device in Peshawar was involved.');
    expect(checkAll([{ text: 'Refer for STR', cites: [] }, { text: 'The pattern looks like a mule account.', cites: [] }], facts, 'model', true).removed.map((s) => s.reasons[0])).toEqual(['is a fragment, not a sentence', 'cites no fact']);
  });
});

describe('copilot facts', () => {
  it('reads the case from CMS data: subject, activity, pass-through and income ratio', () => {
    const cf = muleCase();
    expect(cf.subject?.name).toBe('Hamza Rafiq');
    expect(cf.subject?.role).toBe('creditor');
    expect(cf.ruleIds).toHaveLength(4);
    const text = cf.facts.map((f) => f.text).join('\n');
    expect(text).toMatch(/typology 101@1.0.0 scored 450 against an alert threshold of 300/);
    expect(text).toMatch(/Rule 024 \(Non-commissioned transaction mirroring - creditor\)/);
    expect(text).toMatch(/3 credits totalling PKR 450,000 from 3 counterparties/);
    expect(text).toMatch(/left the account within 24 hours; the median time from a credit to the next debit was 30 minutes/);
    expect(text).toMatch(/times the declared monthly income of PKR 30,000/);
    expect(text).toMatch(/4 of the 4 counterparties in the window had not appeared/);
    expect(text).toMatch(/3 debits totalling PKR 441,000 to 1 counterparty\./);
    expect(text).toMatch(/^98% of the value credited/m);
    expect(cf.facts.find((f) => f.kind === 'kyc')?.text).toMatch(/^Comment 7 on Investigate Case by cms investigator/);
    expect(cf.facts.map((f) => f.id)).toEqual(cf.facts.map((_, i) => `F${i + 1}`));
  });

  it('chooses the subject from the reporting FSP, then from the rules', () => {
    const p = readPacs008(muleHistory().find((m: any) => m.FIToFICstmrCdtTrf.GrpHdr.MsgId === 'E2E-OUT0'))!;
    expect(chooseSubject(p, [], 'fsp001')).toBe('debtor');
    expect(chooseSubject({ ...p, creditor: { ...p.creditor, fsp: 'fsp001' } }, ['016@1.0.0', '024@1.0.0'], 'fsp001')).toBe('creditor');
  });

  it('parses KYC extracts and status labels', () => {
    expect(parseKyc(KYC)).toEqual({ income: 30000, turnover: undefined, occupation: 'Student', customerSince: '14 Jul 2026', riskRating: 'LOW' });
    expect(statusLabel('STATUS_82_CLOSED_CONFIRMED')).toBe('closed confirmed');
  });

  it('works without an alert transaction', () => {
    const cf = computeFacts({ caseRow: { case_id: 1, tenant_id: 'T', status: 'STATUS_00_DRAFT', priority: 'LOW', case_type: null, created_at: new Date() }, alert: null, trigger: null, subjectRole: null, history: [], notes: [], ctrThreshold: 2_000_000 });
    expect(cf.facts).toHaveLength(1);
    expect(cf.subject).toBeNull();
  });
});

describe('copilot embeddings', () => {
  it('ranks related text first', () => {
    const v = { a: embedBuiltin('cash deposits under the reporting threshold'), b: embedBuiltin('date of birth and occupation of the customer') };
    expect(topK(embedBuiltin('cash deposit threshold'), v, 1)).toEqual(['a']);
    expect(cosine(v.a, v.a)).toBeCloseTo(1);
  });
});

describe('SAR drafting helpers', () => {
  const cf = muleCase();

  it('writes every section from facts without a model', () => {
    for (const key of ['subject', 'activity', 'grounds', 'investigation', 'action']) {
      const out = checkAll(codeSection(key, cf.facts, cf), cf.facts, 'code');
      expect(out.removed).toEqual([]);
    }
    expect(codeSection('subject', cf.facts, cf).map((s) => s.text).join(' ')).toMatch(/occupation or business: Student/);
  });

  it('builds goAML XML that holds the alert transaction and matching totals', () => {
    const txs = reportTransactions(cf);
    const xml = goamlXml({ cf, narrative: 'A & B <test>', action: 'Filed.', indicators: indicators(cf), reportingPerson: { name: 'Compliance Officer', email: 'co@example.org' }, rentityId: null, submissionDate: new Date('2026-10-22T00:00:00Z'), transactions: txs });
    expect(xml).toContain(`<transactionnumber>${TRIGGER_E2E}</transactionnumber>`);
    expect(xml).toContain('<reason>A &amp; B &lt;test&gt;</reason>');
    expect(xml).toContain('<t_to_my_client>');
    expect(xml).toContain(`<account>${SUBJECT}</account>`);
    const checks = sarChecks(cf, [], xml, txs, null, 5, new Date().toISOString());
    expect(checks.find((c) => c.name.startsWith('goAML amounts'))?.ok).toBe(true);
    expect(checks.find((c) => c.name.startsWith('Reporting entity'))?.ok).toBe(false);
    expect(checks.find((c) => c.name.startsWith('Case closed'))?.ok).toBe(true);
  });
});

describe('copilot pattern facts', () => {
  const ME: [string, string, string] = ['Faisal Mirza', SUBJECT, 'fsp001'];
  const at = (h: number): Date => new Date(Date.UTC(2026, 9, 10, 0, 0) + h * 3_600_000);
  const run = (history: any[], trigger: any, notes: any[] = []) => {
    const ps = history.map((m) => readPacs008(m)!);
    const t = readPacs008(trigger)!;
    return computeFacts({ caseRow: { case_id: 1, tenant_id: 'T', status: 'STATUS_20_IN_PROGRESS', priority: 'HIGH', case_type: 'AML', created_at: t.at }, alert: null, trigger: t, subjectRole: chooseSubject(t, [], 'fsp001'), history: [...ps, t], notes, ctrThreshold: 2_000_000 })
      .facts.map((f) => f.text)
      .join('\n');
  };

  it('spots cash deposits just under the CTR threshold and a dormant account', () => {
    const old = pacs008('E2E-OLD', at(-24 * 300), 5000, ['Someone', 'PK10THAR0000000000000010', 'fsp004'], ME);
    const deps = [1_950_000, 1_980_000, 1_900_500].map((amt, i) => pacs008(`E2E-C${i}`, at(-24 * (5 - i)), amt, ['Cash deposit, Saddar branch', 'CASH-00000001', 'fsp001'], ME, { channel: 'Cash deposit' }));
    const out = pacs008('E2E-RTGS', at(0), 5_500_000, ME, ['Skyline Builders', 'PK20THAR0000000000000020', 'fsp004'], { channel: 'RTGS', narrative: 'plot booking payment' });
    const text = run([old, ...deps], out, [{ source: 'Comment 1', author: 'x', at: at(1), text: 'KYC extract\nExpected monthly turnover: PKR 2,400,000' }]);
    expect(text).toMatch(/3 cash deposits totalling PKR 5,830,500 were made in the window; 3 of them were between PKR 1,800,000 and PKR 1,999,999/);
    expect(text).toMatch(/There were no transactions on the subject account in the 90 days before/);
    expect(text).toMatch(/times the expected monthly turnover of PKR 2,400,000/);
    const remittance = pacs008('E2E-R', at(0), 6_100_000, ['Remitter via Gulzar Exchange Company', 'PK40GLZX0000000000000040', 'fsp005'], ME, { channel: 'Home remittance' });
    expect(run([old], remittance)).toMatch(/previous transaction on the subject account was on .*, 300 days earlier/);
  });

  it('spots a night-time payment far from the usual location, and Benford skew', () => {
    const usual = Array.from({ length: 6 }, (_, i) => pacs008(`E2E-U${i}`, at(-24 * (40 + i) + 12), 3000, ME, ['Corner Mart', 'POS-00000002', 'fsp001'], { channel: 'POS purchase' }));
    const sales = Array.from({ length: 50 }, (_, i) => pacs008(`E2E-S${i}`, at(-24 * 10 + i), 9100 + i, ['Card ****1234', 'CARD-00000003', 'fsp001'], ME, { channel: 'Card sale' }));
    const night = pacs008('E2E-N', new Date(Date.UTC(2026, 9, 9, 21, 30)), 950_000, ME, ['New Payee', 'PK30SVRW0000000000000030', 'fsp003'], { lat: '34.0151', long: '71.5249' });
    const text = run([...usual, ...sales], night);
    expect(text).toMatch(/initiated about \d+ km from the account's usual location/);
    expect(text).toMatch(/made at 02:30 local time; 100% of the account's earlier payments were made between 08:00 and 22:00/);
    expect(text).toMatch(/Of the 50 credits in the window, 100% have amounts starting with the digit 9/);
  });
});
