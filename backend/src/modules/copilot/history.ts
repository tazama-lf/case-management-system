import type { Party, Txn } from './copilot.types';

/** Accounts that stand for cash, ATM, POS, bill and card channels rather than a real customer account. */
export const PSEUDO_ACCOUNT = /^(?:CASH|ATM|POS|BILL|TOPUP|CARD|EXT)-/v;

const DAY = 86_400_000;

/** Value at a path in a JSON message, or undefined. */
export function pick(obj: unknown, ...path: Array<string | number>): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[k];
  }
  return cur;
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown): number | undefined => (typeof v === 'string' || typeof v === 'number' ? Number(v) : undefined);

export function party(side: unknown, account: unknown, agent: unknown, initiator?: unknown): Party {
  const birthDate = pick(side, 'Id', 'PrvtId', 'DtAndPlcOfBirth', 'BirthDt');
  return {
    name: str(pick(side, 'Nm'), str(pick(account, 'Nm'), 'unknown')),
    account: str(pick(account, 'Id', 'Othr', 0, 'Id'), 'unknown'),
    fsp: str(pick(agent, 'FinInstnId', 'ClrSysMmbId', 'MmbId'), 'unknown'),
    birthDate: typeof birthDate === 'string' ? birthDate : undefined,
    isOrganisation: pick(side, 'Id', 'OrgId') !== undefined,
    lat: num(pick(initiator, 'Lat')),
    long: num(pick(initiator, 'Long')),
  };
}

export interface Pacs008 {
  endToEndId: string;
  at: Date;
  amount: number;
  currency: string;
  debtor: Party;
  creditor: Party;
  channel: string;
  narrative: string;
}

export function readPacs008(msg: unknown): Pacs008 | null {
  const root = pick(msg, 'FIToFICstmrCdtTrf');
  const tx = pick(root, 'CdtTrfTxInf');
  if (tx === null || typeof tx !== 'object') return null;
  const doc = pick(root, 'SplmtryData', 'Envlp', 'Doc');
  const amt = pick(tx, 'IntrBkSttlmAmt', 'Amt') ?? pick(tx, 'InstdAmt', 'Amt');
  return {
    endToEndId: str(pick(tx, 'PmtId', 'EndToEndId'), str(pick(root, 'GrpHdr', 'MsgId'))),
    at: new Date(str(pick(root, 'GrpHdr', 'CreDtTm'), '1970-01-01T00:00:00Z')),
    amount: num(pick(amt, 'Amt')) ?? 0,
    currency: str(pick(amt, 'Ccy')),
    debtor: party(pick(tx, 'Dbtr'), pick(tx, 'DbtrAcct'), pick(tx, 'DbtrAgt'), pick(doc, 'InitgPty', 'Glctn')),
    creditor: party(pick(tx, 'Cdtr'), pick(tx, 'CdtrAcct'), pick(tx, 'CdtrAgt')),
    channel: str(pick(doc, 'Chnl'), str(pick(tx, 'Purp', 'Cd'), 'transfer')),
    narrative: str(pick(root, 'RmtInf', 'Ustrd')),
  };
}

/** The same pacs.008 as seen from one account: a credit or a debit with its counterparty. */
export function asTxn(p: Pacs008, account: string): Txn {
  const isDebit = p.debtor.account === account;
  const cp = isDebit ? p.creditor : p.debtor;
  return {
    endToEndId: p.endToEndId,
    at: p.at,
    direction: isDebit ? 'DR' : 'CR',
    amount: p.amount,
    currency: p.currency,
    counterparty: cp.name,
    counterpartyAccount: cp.account,
    counterpartyFsp: cp.fsp,
    channel: p.channel,
    narrative: p.narrative,
    lat: p.debtor.lat,
    long: p.debtor.long,
  };
}

export const sum = (xs: Txn[]): number => xs.reduce((s, t) => s + t.amount, 0);
export const credits = (xs: Txn[]): Txn[] => xs.filter((t) => t.direction === 'CR');
export const debits = (xs: Txn[]): Txn[] => xs.filter((t) => t.direction === 'DR');
export const between = (xs: Txn[], from: Date, to: Date): Txn[] => xs.filter((t) => t.at >= from && t.at <= to);
export const daysBefore = (d: Date, n: number): Date => new Date(d.getTime() - n * DAY);

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Pass-through: for each credit, the debits in the next 24 hours (each debit used once).
 * Returns the share of credited value that left within 24 hours and the median minutes to the first debit.
 */
export function passThrough(window: Txn[]): { share: number; medianMinutes: number } {
  const cr = credits(window).sort((a, b) => +a.at - +b.at);
  const dr = debits(window)
    .filter((t) => !PSEUDO_ACCOUNT.test(t.counterpartyAccount) || /CASH|ATM/v.test(t.counterpartyAccount))
    .sort((a, b) => +a.at - +b.at);
  const used = new Set<Txn>();
  let matched = 0;
  const delays: number[] = [];
  for (const c of cr) {
    let remaining = c.amount;
    let first: number | null = null;
    for (const d of dr) {
      if (remaining <= c.amount * 0.05) break; // matched, allowing for a retained fee
      if (used.has(d) || d.at < c.at || +d.at - +c.at > DAY) continue;
      used.add(d);
      remaining -= d.amount;
      first ??= (+d.at - +c.at) / 60_000;
    }
    matched += Math.min(c.amount, c.amount - Math.max(remaining, 0));
    if (first !== null) delays.push(first);
  }
  const total = sum(cr);
  return { share: total ? matched / total : 0, medianMinutes: median(delays) };
}

export function haversineKm(aLat: number, aLong: number, bLat: number, bLong: number): number {
  const r = (x: number): number => (x * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLong = r(bLong - aLong);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLong / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** The location the account usually transacts from: the most frequent rounded coordinate pair. */
export function habitualLocation(xs: Txn[]): { lat: number; long: number; share: number } | null {
  const counts = new Map<string, number>();
  const located = xs.filter((t) => t.lat !== undefined && t.long !== undefined && t.direction === 'DR');
  for (const t of located) {
    const k = `${t.lat!.toFixed(1)},${t.long!.toFixed(1)}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1]).at(0);
  if (!best) return null;
  const [lat, long] = best[0].split(',').map(Number);
  return { lat, long, share: best[1] / located.length };
}

export function leadingDigitShare(xs: Txn[], digit: number): number {
  const ds = xs.map((t) => String(Math.floor(t.amount)).replace(/^0+/v, '')[0]).filter(Boolean);
  return ds.length ? ds.filter((d) => d === String(digit)).length / ds.length : 0;
}

export function formatMoney(amount: number, currency: string): string {
  const fixed = Number.isInteger(amount)
    ? amount.toLocaleString('en-US')
    : amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency || ''} ${fixed}`.trim();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Dates in the deployment's local time (COPILOT_TZ_OFFSET_MINUTES, default +300 for Pakistan). */
function local(d: Date): Date {
  return new Date(d.getTime() + Number(process.env.COPILOT_TZ_OFFSET_MINUTES ?? 300) * 60_000);
}

export function formatDate(d: Date): string {
  const l = local(d);
  return `${String(l.getUTCDate()).padStart(2, '0')} ${MONTHS[l.getUTCMonth()]} ${l.getUTCFullYear()}`;
}

export function formatDateTime(d: Date): string {
  const l = local(d);
  return `${formatDate(d)} ${String(l.getUTCHours()).padStart(2, '0')}:${String(l.getUTCMinutes()).padStart(2, '0')}`;
}

export function localHour(d: Date): number {
  return local(d).getUTCHours();
}

export function maskAccount(account: string): string {
  return PSEUDO_ACCOUNT.test(account) || account.length < 8 ? account : `****${account.slice(-4)}`;
}
