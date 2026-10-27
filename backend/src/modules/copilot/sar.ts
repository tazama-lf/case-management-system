import type { CaseFacts, Fact, SarCheck, SarSection, Sentence, Txn } from './copilot.types';
import { PSEUDO_ACCOUNT, formatDate } from './history';
import { parseKyc, statusLabel } from './facts';
import { ruleInfo, ruleNumber } from './rules.catalog';

/**
 * STR/SAR narrative sections (backlog P3-2). Each section has a retrieval query: the SAR agent
 * ranks the copilot's stored fact vectors against it and drafts the section from the best matches.
 */
export interface SectionSpec {
  key: string;
  title: string;
  guidance: string;
  query: string;
  always: Array<Fact['kind']>;
}

export const SECTIONS: SectionSpec[] = [
  {
    key: 'subject',
    title: 'Subject and relationship',
    guidance: 'who the subject is and their relationship with the reporting institution (1-3 sentences)',
    query: 'subject customer name account date of birth KYC occupation declared monthly income customer since risk rating business',
    always: ['subject', 'kyc'],
  },
  {
    key: 'activity',
    title: 'Suspicious activity',
    guidance: 'what happened: amounts, dates, counterparties and the flow of funds (2-5 sentences)',
    query: 'alert transaction credits debits totalling counterparties window largest transfers cash deposits flow of funds',
    always: ['transaction', 'activity'],
  },
  {
    key: 'grounds',
    title: 'Grounds for suspicion',
    guidance: 'why the activity is unusual against the profile and history: the red flags (2-5 sentences)',
    query:
      'rule fired typology score red flag times earlier average declared income pass-through 24 hours threshold new counterparties location Benford',
    always: ['alert', 'rule'],
  },
  {
    key: 'investigation',
    title: 'Investigation and findings',
    guidance: 'what the institution checked and what it found (1-4 sentences)',
    query: 'investigation notes findings screening results recall request customer call information request documents verified',
    always: ['screening'],
  },
  {
    key: 'action',
    title: 'Action taken',
    guidance: 'what the institution did or recommends, without tipping off the customer (1-3 sentences)',
    query: 'supervisor approval final outcome closed confirmed recommend STR restrict account hold recall filing',
    always: ['case'],
  },
];

const first = (facts: Fact[], kind: Fact['kind']): Fact | undefined => facts.find((f) => f.kind === kind);
const all = (facts: Fact[], kind: Fact['kind']): Fact[] => facts.filter((f) => f.kind === kind);
const plain = (f: Fact): Sentence => ({ text: f.text, cites: [f.id] });

/** A note fact as its author wrote it, without the "Comment 12 on Task by user on date" wrapper or a form label. */
const quoted = (f: Fact): Sentence => {
  const inner = /: "(?<body>[\s\S]*)"$/v.exec(f.text)?.groups?.body ?? f.text;
  const body = inner
    .replace(/^(?:Final Investigation Summary|Supervisor Approval):\s*/iv, '')
    .replace(/^Final investigation summary:\s*/iv, '');
  return { text: `${body.charAt(0).toUpperCase()}${body.slice(1)}${/[.!?]$/v.test(body) ? '' : '.'}`, cites: [f.id] };
};

/** The section written by code from its facts, used when there is no model or the model's text fails the checks. */
const SECTION_WRITERS: Record<string, (facts: Fact[], cf: CaseFacts) => Sentence[]> = {
  subject: (facts) => {
    const out: Sentence[] = [];
    const s = first(facts, 'subject');
    if (s) out.push(plain(s));
    const k = first(facts, 'kyc');
    if (!k) return out;
    const f = parseKyc(k.text.replace(/; /gv, '\n'));
    const parts = [
      f.occupation && `occupation or business: ${f.occupation}`,
      f.customerSince && `customer since ${f.customerSince}`,
      f.riskRating && `risk rating ${f.riskRating}`,
    ].filter(Boolean);
    if (parts.length) out.push({ text: `According to the KYC extract, the subject's ${parts.join('; ')}.`, cites: [k.id] });
    return out;
  },
  activity: (facts) =>
    [first(facts, 'transaction'), ...all(facts, 'activity').slice(0, 1), ...all(facts, 'counterparty').slice(-1)]
      .filter((f): f is Fact => f !== undefined)
      .map(plain),
  grounds: (facts, cf) => {
    const out: Sentence[] = [];
    const rules = all(facts, 'rule');
    if (rules.length) {
      const flags = cf.ruleIds.map((r) => `${ruleInfo(r).redFlag} (rule ${ruleNumber(r)})`);
      out.push({ text: `Tazama's transaction monitoring flagged ${flags.join(', ')}.`, cites: rules.map((r) => r.id) });
    }
    return [...out, ...all(facts, 'pattern').slice(0, 4).map(plain)];
  },
  investigation: (facts) => {
    const notes = all(facts, 'note').filter((f) => !/Supervisor Approval|Taking the filing/iv.test(f.text));
    return [...all(facts, 'screening'), ...notes.slice(-2)].map(quoted);
  },
  action: (facts) => [
    ...[first(facts, 'case')].filter((f): f is Fact => f !== undefined).map(plain),
    ...[facts.find((f) => /Supervisor Approval/iv.test(f.text))].filter((f): f is Fact => f !== undefined).map(quoted),
  ],
};

/** The section written by code from its facts, used when there is no model or the model's text fails the checks. */
export function codeSection(key: string, facts: Fact[], cf: CaseFacts): Sentence[] {
  return (SECTION_WRITERS[key] as ((facts: Fact[], cf: CaseFacts) => Sentence[]) | undefined)?.(facts, cf) ?? [];
}

export function indicators(cf: CaseFacts): string[] {
  const out = cf.ruleIds.map((r) => `Rule ${ruleNumber(r)}: ${ruleInfo(r).redFlag}`);
  if (cf.typology) out.unshift(`Typology ${cf.typology}`);
  return out;
}

const esc = (s: string | number | null | undefined): string =>
  String(s ?? '')
    .replace(/&/gv, '&amp;')
    .replace(/</gv, '&lt;')
    .replace(/>/gv, '&gt;')
    .replace(/"/gv, '&quot;');

/** Placeholder transmode codes: each FIU publishes its own goAML code lists. */
const TRANSMODE: Array<[RegExp, string]> = [
  [/cash|atm|cheque/iv, 'CASH'],
  [/card|pos/iv, 'CARD'],
  [/remittance/iv, 'REMIT'],
  [/rtgs/iv, 'RTGS'],
  [/wallet/iv, 'WALLET'],
];

/**
 * Transactions for the report: those in the window with counterparties the subject had not dealt with
 * before, or of at least 10% of the largest amount; never routine POS, bill or top-up payments.
 */
export function reportTransactions(cf: CaseFacts, limit = 30): Txn[] {
  const known = new Set(cf.knownCounterparties);
  const largest = Math.max(0, ...cf.window.map((t) => t.amount));
  const material = cf.window.filter(
    (t) => !/^(?:POS|BILL|TOPUP)-/v.test(t.counterpartyAccount) && (!known.has(t.counterpartyAccount) || t.amount >= largest * 0.1),
  );
  const chosen = [...material].sort((a, b) => b.amount - a.amount).slice(0, limit);
  if (cf.trigger && !chosen.some((t) => t.endToEndId === cf.trigger!.endToEndId)) chosen.push(cf.trigger);
  return chosen.sort((a, b) => +a.at - +b.at);
}

export interface GoamlInput {
  cf: CaseFacts;
  narrative: string;
  action: string;
  indicators: string[];
  reportingPerson: { name: string; email?: string };
  rentityId: string | null;
  submissionDate: Date;
  transactions: Txn[];
}

/** goAML report in the UNODC base structure. Codes and element order must be checked against the FIU's own XSD. */
export function goamlXml(g: GoamlInput): string {
  const s = g.cf.subject;
  const ccy = g.cf.trigger?.currency ?? '';
  const [first, ...rest] = g.reportingPerson.name.split(' ');
  const account = (inst: string, acct: string, name: string, mine: boolean): string =>
    `<institution_code>${esc(inst)}</institution_code><account>${esc(acct)}</account><currency_code>${esc(ccy)}</currency_code><account_name>${esc(name)}</account_name>${mine ? '<is_primary>true</is_primary>' : ''}`;
  const tx = g.transactions
    .map((t) => {
      const mode = TRANSMODE.find(([re]) => re.test(t.channel))?.[1] ?? 'TRANSFER';
      const subj = account(s?.fsp ?? '', s?.account ?? '', s?.name ?? '', true);
      const cp = PSEUDO_ACCOUNT.test(t.counterpartyAccount)
        ? `<institution_code>${esc(t.counterpartyFsp)}</institution_code><account>${esc(t.counterpartyAccount)}</account><currency_code>${esc(ccy)}</currency_code><account_name>${esc(t.counterparty)}</account_name>`
        : account(t.counterpartyFsp, t.counterpartyAccount, t.counterparty, false);
      const from =
        t.direction === 'DR'
          ? `<t_from_my_client><from_funds_code>K</from_funds_code><from_account>${subj}</from_account><from_country>PK</from_country></t_from_my_client>`
          : `<t_from><from_funds_code>K</from_funds_code><from_account>${cp}</from_account><from_country>PK</from_country></t_from>`;
      const to =
        t.direction === 'DR'
          ? `<t_to><to_funds_code>K</to_funds_code><to_account>${cp}</to_account><to_country>PK</to_country></t_to>`
          : `<t_to_my_client><to_funds_code>K</to_funds_code><to_account>${subj}</to_account><to_country>PK</to_country></t_to_my_client>`;
      return `  <transaction>
    <transactionnumber>${esc(t.endToEndId)}</transactionnumber>
    <internal_ref_number>CMS-CASE-${g.cf.caseId}</internal_ref_number>
    <transaction_description>${esc(t.narrative || t.channel)}</transaction_description>
    <date_transaction>${t.at.toISOString().slice(0, 19)}</date_transaction>
    <transmode_code>${mode}</transmode_code>
    <amount_local>${t.amount.toFixed(2)}</amount_local>
    ${from}
    ${to}
  </transaction>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<report>
  <rentity_id>${esc(g.rentityId ?? 'NOT-CONFIGURED')}</rentity_id>
  <submission_code>E</submission_code>
  <report_code>STR</report_code>
  <entity_reference>CMS-CASE-${g.cf.caseId}</entity_reference>
  <submission_date>${g.submissionDate.toISOString().slice(0, 19)}</submission_date>
  <currency_code_local>${esc(ccy)}</currency_code_local>
  <reporting_person><first_name>${esc(first)}</first_name><last_name>${esc(rest.join(' '))}</last_name><email>${esc(g.reportingPerson.email ?? '')}</email></reporting_person>
  <reason>${esc(g.narrative)}</reason>
  <action>${esc(g.action)}</action>
${tx}
  <report_indicators>
${g.indicators.map((i) => `    <indicator>${esc(i)}</indicator>`).join('\n')}
  </report_indicators>
</report>
`;
}

export function sarChecks(
  cf: CaseFacts,
  sections: SarSection[],
  xml: string,
  txs: Txn[],
  rentityId: string | null,
  recordId: number,
  recordAt: string,
): SarCheck[] {
  const kept = sections.flatMap((s) => s.text.sentences);
  const removed = sections.flatMap((s) => s.text.removed);
  const empty = sections.filter((s) => !s.text.sentences.length).map((s) => s.title);
  const confirmed = /CLOSED_CONFIRMED|AUTOCLOSED_CONFIRMED/v.test(cf.status);
  const amounts = [...xml.matchAll(/<amount_local>(?<amount>[\d.]+)<\/amount_local>/gv)].reduce(
    (s, m) => s + Number(m.groups?.amount ?? 0),
    0,
  );
  const expected = txs.reduce((s, t) => s + t.amount, 0);
  return [
    {
      name: 'Every sentence cites case facts',
      ok: kept.every((s) => s.cites.length > 0),
      detail: `${kept.length} sentences, all checked against the facts they cite`,
    },
    {
      name: 'Sentences removed by the checks',
      ok: true,
      detail: removed.length ? `${removed.length} removed (shown below each section)` : 'none',
    },
    { name: 'All sections drafted', ok: empty.length === 0, detail: empty.length ? `empty: ${empty.join(', ')}` : 'yes' },
    {
      name: 'Case closed as confirmed',
      ok: confirmed,
      detail: confirmed ? statusLabel(cf.status) : `case is ${statusLabel(cf.status)}; file only after the supervisor confirms`,
    },
    {
      name: 'Alert transaction in the goAML report',
      ok: !cf.trigger || xml.includes(`<transactionnumber>${cf.trigger.endToEndId}</transactionnumber>`),
      detail: cf.trigger?.endToEndId ?? 'no alert transaction',
    },
    {
      name: 'goAML amounts match the source transactions',
      ok: Math.abs(amounts - expected) < 0.01,
      detail: `${txs.length} transactions totalling ${amounts.toFixed(2)}`,
    },
    {
      name: 'Reporting entity id configured',
      ok: Boolean(rentityId),
      detail: rentityId ?? 'set GOAML_RENTITY_ID to the id the FIU issued',
    },
    { name: 'Built from the stored investigation record', ok: true, detail: `record ${recordId} from ${formatDate(new Date(recordAt))}` },
  ];
}
