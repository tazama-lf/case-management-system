/**
 * Tazama rule processors the copilot can explain, keyed by rule number.
 * Names come from the tazama-stack rule configuration (core/postgres/migration/config).
 * `side` says whose behaviour the rule looks at: the debtor (payer) or the creditor (payee).
 */
export interface RuleInfo {
  name: string;
  side: 'debtor' | 'creditor' | 'either';
  redFlag: string;
}

export const RULES: Record<string, RuleInfo> = {
  '001': { name: 'Derived account age - creditor', side: 'creditor', redFlag: 'funds received by a recently opened account' },
  '002': { name: 'Transaction convergence - debtor', side: 'debtor', redFlag: 'many payments converging from one payer' },
  '003': { name: 'Account dormancy - creditor', side: 'creditor', redFlag: 'a dormant account suddenly receiving funds' },
  '004': { name: 'Account dormancy - debtor', side: 'debtor', redFlag: 'a dormant account suddenly sending funds' },
  '006': { name: 'Outgoing transfer similarity - amounts', side: 'debtor', redFlag: 'many outgoing transfers of similar amounts' },
  '007': {
    name: 'Outgoing transfer similarity - descriptions',
    side: 'debtor',
    redFlag: 'many outgoing transfers with similar descriptions',
  },
  '008': { name: 'Outgoing transfer similarity - creditor', side: 'debtor', redFlag: 'repeated outgoing transfers to the same payee' },
  '010': { name: 'Increased account activity: volume - debtor', side: 'debtor', redFlag: 'a sharp rise in outgoing transaction volume' },
  '011': {
    name: 'Increased account activity: volume - creditor',
    side: 'creditor',
    redFlag: 'a sharp rise in incoming transaction volume',
  },
  '016': { name: 'Transaction convergence - creditor', side: 'creditor', redFlag: 'funds converging from many unrelated payers' },
  '017': { name: 'Transaction divergence - debtor', side: 'debtor', redFlag: 'funds dispersed to many payees' },
  '018': { name: 'Exceptionally large outgoing transfer - debtor', side: 'debtor', redFlag: 'an exceptionally large outgoing transfer' },
  '020': {
    name: 'Large transaction amount vs history - creditor',
    side: 'creditor',
    redFlag: 'a credit far larger than the account history',
  },
  '021': {
    name: 'A large number of similar transaction amounts - creditor',
    side: 'creditor',
    redFlag: 'many incoming amounts of similar size',
  },
  '024': {
    name: 'Non-commissioned transaction mirroring - creditor',
    side: 'creditor',
    redFlag: 'incoming funds mirrored by outgoing funds (pass-through)',
  },
  '025': { name: 'Non-commissioned transaction mirroring - debtor', side: 'debtor', redFlag: 'outgoing funds mirrored by returning funds' },
  '026': {
    name: 'Commissioned transaction mirroring - creditor',
    side: 'creditor',
    redFlag: 'pass-through with a small retained commission',
  },
  '027': { name: 'Commissioned transaction mirroring - debtor', side: 'debtor', redFlag: 'pass-through with a small retained commission' },
  '028': { name: 'Age classification - debtor', side: 'debtor', redFlag: 'payer in an age group often targeted by scams' },
  '030': { name: 'Transfer to unfamiliar creditor account - debtor', side: 'debtor', redFlag: 'payment to a payee never paid before' },
  '044': {
    name: 'Successful transactions from the debtor, including the new transaction',
    side: 'debtor',
    redFlag: 'unusual count of successful outgoing payments',
  },
  '045': {
    name: 'Successful transactions to the creditor, including the new transaction',
    side: 'creditor',
    redFlag: 'unusual count of successful incoming payments',
  },
  '048': { name: 'Large transaction amount vs history - debtor', side: 'debtor', redFlag: 'a payment far larger than the account history' },
  '054': {
    // eslint-disable-next-line @stylistic/quotes -- the rule name contains an apostrophe; double quotes are the only form prettier and eslint agree on
    name: "Synthetic data check - Benford's Law - debtor",
    side: 'debtor',
    // eslint-disable-next-line @stylistic/quotes -- see above
    redFlag: "outgoing amounts that do not follow Benford's Law",
  },
  '063': {
    // eslint-disable-next-line @stylistic/quotes -- see above
    name: "Synthetic data check - Benford's Law - creditor",
    side: 'creditor',
    // eslint-disable-next-line @stylistic/quotes -- see above
    redFlag: "incoming amounts that do not follow Benford's Law",
  },
  '074': {
    name: 'Distance over time from last transaction location - debtor',
    side: 'debtor',
    redFlag: 'implausible travel between transaction locations',
  },
  '075': { name: 'Distance from habitual locations - debtor', side: 'debtor', redFlag: 'a transaction far from the usual locations' },
  '076': { name: 'Time since last transaction - debtor', side: 'debtor', redFlag: 'activity after an unusual gap' },
  '078': { name: 'Transaction type', side: 'either', redFlag: 'an unusual transaction type' },
  '083': { name: 'Multiple accounts associated with a debtor', side: 'debtor', redFlag: 'a payer linked to multiple accounts' },
  '084': { name: 'Multiple accounts associated with a creditor', side: 'creditor', redFlag: 'a payee linked to multiple accounts' },
  '090': { name: 'Upstream transaction divergence - debtor', side: 'debtor', redFlag: 'funds received and quickly dispersed onward' },
  '091': { name: 'Transaction amount vs regulatory threshold', side: 'either', redFlag: 'amounts kept just under a reporting threshold' },
};

export function ruleNumber(ruleId: string): string {
  return ruleId
    .split('@')[0]
    .replace(/^rule-?/iv, '')
    .padStart(3, '0');
}

export function ruleInfo(ruleId: string): RuleInfo {
  return RULES[ruleNumber(ruleId)] ?? { name: `Rule ${ruleNumber(ruleId)}`, side: 'either', redFlag: `rule ${ruleNumber(ruleId)} fired` };
}
