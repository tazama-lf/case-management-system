import type { CaseFacts, CheckedText, Fact, ModelInfo, Sentence } from './copilot.types';
import { ruleInfo, ruleNumber } from './rules.catalog';

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

export function noticeFor(info: ModelInfo): string {
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
