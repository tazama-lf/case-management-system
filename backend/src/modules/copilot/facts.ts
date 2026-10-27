import type { CaseFacts, Fact, FactKind, Party, Txn } from './copilot.types';
import { ruleInfo, ruleNumber } from './rules.catalog';
import {
  PSEUDO_ACCOUNT,
  asTxn,
  between,
  credits,
  daysBefore,
  debits,
  formatDate,
  formatDateTime,
  formatMoney,
  habitualLocation,
  haversineKm,
  leadingDigitShare,
  localHour,
  maskAccount,
  passThrough,
  pick,
  sum,
  type Pacs008,
} from './history';

export interface NoteInput {
  source: string;
  author: string;
  at: Date;
  text: string;
}

export interface FactInput {
  caseRow: { case_id: number; tenant_id: string; status: string; priority: string; case_type: string | null; created_at: Date };
  alert: { alert_id: number; created_at: Date; alert_data: unknown; priority_score?: number | null; confidence_per?: number | null } | null;
  trigger: Pacs008 | null;
  subjectRole: 'debtor' | 'creditor' | null;
  history: Pacs008[];
  notes: NoteInput[];
  ctrThreshold: number;
}

export interface KycFields {
  income?: number;
  turnover?: number;
  occupation?: string;
  customerSince?: string;
  riskRating?: string;
}

export interface Typology {
  cfg: string | null;
  score: number | null;
  alertThreshold?: number;
  interdictionThreshold?: number;
  rules: Array<{ id: string; wght: number; ref?: string }>;
}

type Add = (kind: FactKind, text: string, source: string) => string;

/** The subject account's history around the alert, as the fact builders see it. */
interface Ctx {
  t: Pacs008;
  all: Txn[];
  window: Txn[];
  base: Txn[];
  earlier: Txn[];
  from: Date;
  to: Date;
  src: string;
  money: (x: number) => string;
}

const DAY = 86_400_000;
/** Ratios at or above this are reported as patterns (red flags); below it they are ordinary activity. */
const SIGNIFICANT_RATIO = 2;
const pct = (x: number): string => `${Math.round(x * 100)}%`;
const times = (x: number): string => (x >= 10 ? Math.round(x).toString() : x.toFixed(1));
const count = (n: number, word: string): string => `${n} ${n === 1 ? word : `${word}s`.replace(/ys$/v, 'ies')}`;
const distinct = (xs: Txn[]): string => count(new Set(xs.map((x) => x.counterpartyAccount)).size, 'counterparty');
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

export function statusLabel(status: string): string {
  return status
    .replace(/^STATUS_\d+_/v, '')
    .replace(/_/gv, ' ')
    .toLowerCase();
}

/** Which party of the alert transaction the case is about. */
export function chooseSubject(trigger: Pacs008, ruleIds: string[], reportingFsp: string): 'debtor' | 'creditor' {
  const own = (p: Party): boolean => p.fsp === reportingFsp && !PSEUDO_ACCOUNT.test(p.account);
  if (own(trigger.debtor) !== own(trigger.creditor)) return own(trigger.debtor) ? 'debtor' : 'creditor';
  const sides = ruleIds.map((r) => ruleInfo(r).side);
  return sides.filter((s) => s === 'creditor').length > sides.filter((s) => s === 'debtor').length ? 'creditor' : 'debtor';
}

/** "Key: value" lines from a KYC extract pasted into a comment. */
export function parseKyc(text: string): KycFields {
  const get = (key: string): string | undefined => new RegExp(`^${key}:\\s*(?<value>.+)$`, 'imv').exec(text)?.groups?.value.trim();
  const money = (v?: string): number | undefined => {
    const m = v?.replace(/,/gv, '').match(/\d+(?:\.\d+)?/v);
    return m ? Number(m[0]) : undefined;
  };
  return {
    income: money(get('Declared monthly income')),
    turnover: money(get('Expected monthly turnover')),
    occupation: get('Occupation') ?? get('Nature of business'),
    customerSince: get('Customer since'),
    riskRating: get('Risk rating'),
  };
}

export function typologyOf(alertData: unknown): Typology {
  const t = pick(alertData, 'tadpResult', 'typologyResult', 0);
  const rules = pick(t, 'ruleResults');
  const cfg = pick(t, 'cfg');
  return {
    cfg: typeof cfg === 'string' ? cfg : null,
    score: num(pick(t, 'result')) ?? null,
    alertThreshold: num(pick(t, 'workflow', 'alertThreshold')),
    interdictionThreshold: num(pick(t, 'workflow', 'interdictionThreshold')),
    rules: (Array.isArray(rules) ? rules : []).map((r: unknown) => {
      const ref = pick(r, 'subRuleRef');
      const id = pick(r, 'id');
      return { id: typeof id === 'string' ? id : '', wght: num(pick(r, 'wght')) ?? 0, ref: typeof ref === 'string' ? ref : undefined };
    }),
  };
}

function alertFacts(add: Add, a: NonNullable<FactInput['alert']>, typ: Typology): void {
  let thresholds = '';
  if (typ.alertThreshold !== undefined) {
    const interdiction = typ.interdictionThreshold === undefined ? '' : ` and an interdiction threshold of ${typ.interdictionThreshold}`;
    thresholds = ` against an alert threshold of ${typ.alertThreshold}${interdiction}`;
  }
  let triage = '';
  if (typeof a.priority_score === 'number') {
    const confidence = typeof a.confidence_per === 'number' ? ` with ${a.confidence_per}% confidence` : '';
    triage = ` Triage gave it a priority score of ${a.priority_score}${confidence}.`;
  }
  add(
    'alert',
    `Tazama alert ${a.alert_id} was raised on ${formatDateTime(a.created_at)}: typology ${typ.cfg ?? 'unknown'} scored ${typ.score ?? 'unknown'}${thresholds}.${triage}`,
    `CMS alert ${a.alert_id}`,
  );
  for (const r of typ.rules) {
    const info = ruleInfo(r.id);
    add(
      'rule',
      `Rule ${ruleNumber(r.id)} (${info.name}) fired and added ${r.wght} to the typology score; it looks for ${info.redFlag}.`,
      `alert ${a.alert_id} rule results`,
    );
  }
}

function triggerText(t: Pacs008, money: (x: number) => string): string {
  const side = (p: Party): string => `${p.name} (account ${maskAccount(p.account)}, ${p.fsp})`;
  const narrative = t.narrative ? `, narrative "${t.narrative}"` : '';
  return `The alert transaction ${t.endToEndId} on ${formatDateTime(t.at)} was ${money(t.amount)} from ${side(t.debtor)} to ${side(t.creditor)}${narrative}, channel ${t.channel}.`;
}

function subjectText(s: Party, role: 'debtor' | 'creditor', at: Date): string {
  const who = `The subject of the case is the ${role}, ${s.name}, account ${maskAccount(s.account)} at ${s.fsp}`;
  if (s.birthDate === undefined) return `${who}.`;
  const age = Math.floor((+at - +new Date(s.birthDate)) / (365.25 * DAY));
  return `${who}; date of birth ${s.birthDate}, age ${age} at the time of the alert.`;
}

function accountAgeFacts(add: Add, c: Ctx): void {
  const daysTo = (d: Date): number => Math.round((+c.t.at - +d) / DAY);
  const first = c.all.at(0);
  if (first && daysTo(first.at) < 360) {
    add(
      daysTo(first.at) < 90 ? 'pattern' : 'activity',
      `The earliest transaction on the subject account in the CMS is on ${formatDate(first.at)}, ${daysTo(first.at)} days before the alert.`,
      c.src,
    );
  }
  const prev = c.earlier.at(-1);
  if (prev && daysTo(prev.at) > 60) {
    add(
      'pattern',
      `Before the alert, the previous transaction on the subject account was on ${formatDate(prev.at)}, ${daysTo(prev.at)} days earlier.`,
      c.src,
    );
  }
}

function activityFacts(add: Add, c: Ctx): void {
  const cin = credits(c.window);
  const cout = debits(c.window);
  const now = new Date();
  const end = c.to < now ? c.to : now;
  add(
    'activity',
    `Between ${formatDate(c.from)} and ${formatDate(end)} the subject account had ${count(cin.length, 'credit')} totalling ${c.money(sum(cin))} from ${distinct(cin)}, and ${count(cout.length, 'debit')} totalling ${c.money(sum(cout))} to ${distinct(cout)}.`,
    c.src,
  );
  if (!c.base.length) {
    add('activity', `There were no transactions on the subject account in the 90 days before ${formatDate(c.from)}.`, c.src);
    return;
  }
  const baseIn = sum(credits(c.base)) / 3;
  add(
    'activity',
    `In the 90 days before ${formatDate(c.from)}, the account averaged ${c.money(baseIn)} in credits and ${c.money(sum(debits(c.base)) / 3)} in debits a month.`,
    c.src,
  );
  if (baseIn > 0 && sum(cin) > 0) {
    const ratio = sum(cin) / baseIn;
    add(
      ratio >= SIGNIFICANT_RATIO ? 'pattern' : 'activity',
      `Credits in the 30-day window were ${times(ratio)} times the earlier monthly average.`,
      c.src,
    );
  }
}

function incomeFact(add: Add, c: Ctx, notes: NoteInput[]): void {
  const kycNote = notes.find((n) => /^KYC extract/iv.test(n.text));
  const credited = sum(credits(c.window));
  if (!kycNote || credited <= 0) return;
  const k = parseKyc(kycNote.text);
  const ref: [string, number] | null = k.income
    ? ['declared monthly income', k.income]
    : k.turnover
      ? ['expected monthly turnover', k.turnover]
      : null;
  if (!ref) return;
  add(
    credited / ref[1] >= SIGNIFICANT_RATIO ? 'pattern' : 'activity',
    `Credits in the 30-day window were ${times(credited / ref[1])} times the ${ref[0]} of ${c.money(ref[1])} in the KYC extract.`,
    `${c.src}; ${kycNote.source}`,
  );
}

function flowFacts(add: Add, c: Ctx, ctr: number): void {
  const cin = credits(c.window);
  const pt = passThrough(c.window);
  if (cin.length && debits(c.window).length && pt.share >= 0.2) {
    add(
      'pattern',
      `${pct(pt.share)} of the value credited in the window left the account within 24 hours; the median time from a credit to the next debit was ${Math.round(pt.medianMinutes)} minutes.`,
      c.src,
    );
  }
  const cash = cin.filter((x) => /cash/iv.test(x.channel) || x.counterpartyAccount.startsWith('CASH-'));
  if (!cash.length) return;
  const near = cash.filter((x) => x.amount >= ctr * 0.9 && x.amount < ctr);
  add(
    'pattern',
    `${cash.length} cash deposits totalling ${c.money(sum(cash))} were made in the window; ${near.length} of them were between ${c.money(ctr * 0.9)} and ${c.money(ctr - 1)}, just under the ${c.money(ctr)} currency transaction report threshold.`,
    c.src,
  );
}

function counterpartyFacts(add: Add, c: Ctx): void {
  const real = c.window.filter((x) => !PSEUDO_ACCOUNT.test(x.counterpartyAccount));
  const seen = new Set(c.base.concat(c.earlier.filter((x) => x.at < c.from)).map((x) => x.counterpartyAccount));
  const cps = [...new Set(real.map((x) => x.counterpartyAccount))];
  if (cps.length && seen.size) {
    add(
      'counterparty',
      `${cps.filter((a) => !seen.has(a)).length} of the ${cps.length} counterparty accounts in the window, not counting cash, card, bill and top-up payments, had not appeared in the account's earlier history.`,
      c.src,
    );
  }
  const byCp = new Map<string, { name: string; cr: number; dr: number; n: number }>();
  for (const x of real) {
    const e = byCp.get(x.counterpartyAccount) ?? { name: x.counterparty, cr: 0, dr: 0, n: 0 };
    if (x.direction === 'CR') e.cr += x.amount;
    else e.dr += x.amount;
    e.n += 1;
    byCp.set(x.counterpartyAccount, e);
  }
  const top = [...byCp.values()].sort((a, b) => b.cr + b.dr - (a.cr + a.dr)).slice(0, 3);
  if (!top.length) return;
  const parts = top.map(
    (e) => `${e.name} (${e.dr >= e.cr ? `paid ${c.money(e.dr)}` : `received from them ${c.money(e.cr)}`}, ${count(e.n, 'transaction')})`,
  );
  add('counterparty', `The largest counterparties in the window were ${parts.join('; ')}.`, c.src);
}

function behaviourFacts(add: Add, c: Ctx): void {
  for (const [label, xs] of [
    ['credits', credits(c.window)],
    ['debits', debits(c.window)],
  ] as const) {
    if (xs.length >= 50) {
      add(
        'pattern',
        `Of the ${xs.length} ${label} in the window, ${pct(leadingDigitShare(xs, 9))} have amounts starting with the digit 9; Benford's Law expects about 5%.`,
        c.src,
      );
    }
  }
  const home = habitualLocation(c.base.length ? c.base : c.earlier);
  const { lat, long } = c.t.debtor;
  if (home && lat !== undefined && long !== undefined) {
    const km = haversineKm(home.lat, home.long, lat, long);
    if (km > 100) {
      add('pattern', `The alert transaction was initiated about ${Math.round(km)} km from the account's usual location.`, c.src);
    }
  }
  const earlierDebits = debits(c.earlier);
  if (localHour(c.t.at) < 6 && earlierDebits.length >= 5) {
    const day = earlierDebits.filter((x) => localHour(x.at) >= 8 && localHour(x.at) < 22).length / earlierDebits.length;
    add(
      'pattern',
      `The alert transaction was made at ${formatDateTime(c.t.at).slice(-5)} local time; ${pct(day)} of the account's earlier payments were made between 08:00 and 22:00.`,
      c.src,
    );
  }
}

/** Note lines on one line: a line that ends a sentence is followed by a space, others by "; ". */
function flatten(text: string): string {
  return text
    .split('\n')
    .map((l) => l.trim().replace(/^-\s*/v, ''))
    .filter(Boolean)
    .reduce((out, line) => (out ? `${out}${/[.:!?]$/v.test(out) ? ' ' : '; '}${line}` : line), '');
}

function noteFacts(add: Add, notes: NoteInput[]): void {
  for (const n of notes) {
    const kind: FactKind = /^KYC extract/iv.test(n.text) ? 'kyc' : /^Screening results/iv.test(n.text) ? 'screening' : 'note';
    add(kind, `${n.source} by ${n.author} on ${formatDate(n.at)}: "${flatten(n.text).slice(0, 900)}"`, n.source);
  }
}

/** Facts about the alert transaction and the subject account's history around it. */
function transactionFacts(
  add: Add,
  input: FactInput,
  t: Pacs008,
  role: 'debtor' | 'creditor',
): Pick<CaseFacts, 'subject' | 'counterparty' | 'trigger' | 'window' | 'knownCounterparties'> {
  const s = role === 'debtor' ? t.debtor : t.creditor;
  const money = (x: number): string => formatMoney(Math.round(x * 100) / 100, t.currency);
  add('transaction', triggerText(t, money), `transaction_data ${t.endToEndId}`);
  add('subject', subjectText(s, role, t.at), `transaction_data ${t.endToEndId}`);

  const all = input.history.map((p) => asTxn(p, s.account)).sort((a, b) => +a.at - +b.at);
  const from = daysBefore(t.at, 30);
  const c: Ctx = {
    t,
    all,
    from,
    to: new Date(+t.at + 2 * DAY),
    window: between(all, from, new Date(+t.at + 2 * DAY)),
    base: between(all, daysBefore(t.at, 120), new Date(+from - 1)),
    earlier: all.filter((x) => x.at < t.at && x.endToEndId !== t.endToEndId),
    src: `transaction_data history of ${maskAccount(s.account)}`,
    money,
  };
  accountAgeFacts(add, c);
  activityFacts(add, c);
  incomeFact(add, c, input.notes);
  flowFacts(add, c, input.ctrThreshold);
  counterpartyFacts(add, c);
  behaviourFacts(add, c);
  return {
    subject: { ...s, role },
    counterparty: role === 'debtor' ? t.creditor : t.debtor,
    trigger: asTxn(t, s.account),
    window: c.window,
    knownCounterparties: [...new Set(all.filter((x) => x.at < from).map((x) => x.counterpartyAccount))],
  };
}

export function computeFacts(input: FactInput): CaseFacts {
  const facts: Fact[] = [];
  const add: Add = (kind, text, source) => {
    const id = `F${facts.length + 1}`;
    facts.push({ id, kind, text, source });
    return id;
  };
  const c = input.caseRow;
  const type = c.case_type ? `, case type ${c.case_type}` : '';
  add(
    'case',
    `Case ${c.case_id} is ${statusLabel(c.status)} with ${c.priority.toLowerCase()} priority${type}; it was opened on ${formatDate(c.created_at)}.`,
    `CMS case ${c.case_id}`,
  );

  const typ = typologyOf(input.alert?.alert_data);
  if (input.alert) alertFacts(add, input.alert, typ);
  const t = input.trigger;
  const tx =
    t && input.subjectRole
      ? transactionFacts(add, input, t, input.subjectRole)
      : { subject: null, counterparty: null, trigger: null, window: [], knownCounterparties: [] };
  noteFacts(add, input.notes);

  return {
    caseId: c.case_id,
    tenantId: c.tenant_id,
    status: c.status,
    caseType: c.case_type,
    alertId: input.alert ? input.alert.alert_id : null,
    alertAt: tx.trigger ? tx.trigger.at : null,
    ...tx,
    ruleIds: typ.rules.map((r) => r.id),
    typology: typ.cfg,
    score: typ.score,
    facts,
  };
}
