import type { CheckedSentence, CheckedText, Fact, Sentence } from './copilot.types';

/**
 * Checks each sentence a model wrote before anyone sees it. A sentence is removed when:
 *  - it cites a fact id that does not exist
 *  - it has a number that is not in the facts it cites (amounts, counts, dates, percentages)
 *  - it names a person or organisation that appears in no fact
 *  - it states guilt as a fact
 *  - it suggests telling the customer about the alert, the investigation or a report (tipping off)
 *  - it puts an account, IBAN or national ID number in the prose
 * Sentences with numbers or names must cite at least one fact.
 */

const GUILT = [
  /\b(?:is|are|was|were)\s+(?:guilty|a criminal|criminals|a money launderer|money launderers|a fraudster|fraudsters|a terrorist)\b/iv,
  /\b(?:committed|perpetrated)\s+(?:fraud|money laundering|a crime|terrorist financing)\b/iv,
  /\b(?:proves?|proven|definitely|certainly|undoubtedly|without (?:a )?doubt)\b/iv,
];
const TIPPING_OFF =
  /\b(?:inform|tell|notify|alert|warn|advise|let)\s+(?:the\s+)?(?:customer|client|subject|account holder)\b[^.]*\b(?:suspicion|suspicious|STR|SAR|report|investigation|FMU|FIU|alert)\b|\btip(?:ping)?[\- ]?off\b/iv;
const NEGATED = /\b(?:do not|don't|never|must not|should not|avoid|without)\s+(?:inform|tell|notify|alert|warn|advise|let|tip)/iv;
const IDENTIFIER = /\b[A-Z]{2}\d{2}[A-Z]{4}\d{10,}\b|\b\d{5}-\d{7}-\d\b|\b\d{11,}\b/v;
const FACT_REF = /\[?\b(?<id>F\d+)\b\]?/gv;
const NAME = /\b(?<name>[A-Z][a-z]+(?:[ \-](?:[A-Z][a-z]+|&|\(Pvt\)|Ltd))+)/gv;
const SPACE_BEFORE_PUNCT = /\s+(?<p>[.,;])/gv;
// a run of citations with their separators, as in "... involved [F19], [F23] and [F25]."
const CITATION_RUN = /\s*\[F\d+\](?:\s*(?:,|and)?\s*\[F\d+\])*/gv;

const LEADING = new Set([
  'The',
  'This',
  'These',
  'That',
  'On',
  'In',
  'Between',
  'During',
  'Over',
  'Within',
  'Of',
  'Before',
  'After',
  'From',
  'To',
  'A',
  'An',
  'Each',
  'All',
  'Both',
  'Rule',
  'Case',
  'Typology',
  'Tazama',
  'Since',
  'When',
  'While',
  'At',
  'By',
  'For',
  'With',
  'Its',
  'Their',
  'His',
  'Her',
  'No',
  'Some',
  'Several',
  'Most',
  'Credits',
  'Debits',
]);
const ALLOWED = new Set(
  [
    'currency transaction report',
    'suspicious transaction report',
    'suspicious activity report',
    'financial monitoring unit',
    'financial intelligence unit',
    'know your customer',
    'enhanced due diligence',
    'customer due diligence',
    'source of funds',
    'source of wealth',
    'case management system',
    'law enforcement',
    'business email compromise',
    'reporting entity',
  ].map((s) => s.toLowerCase()),
);

export function numbersIn(text: string): string[] {
  const clean = text.replace(FACT_REF, ' ');
  return (clean.match(/\d[\d,]*(?:\.\d+)?/gv) ?? []).map((n) => {
    let v = n.replace(/,/gv, '');
    if (v.includes('.')) v = v.replace(/0+$/v, '').replace(/\.$/v, '');
    return v.replace(/^0+(?=\d)/v, '');
  });
}

export function namesIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.replace(FACT_REF, ' ').matchAll(NAME)) {
    const words = (m.groups?.name ?? '').split(/\s+/v);
    while (words.length && LEADING.has(words[0])) words.shift();
    if (words.length >= 2 && !ALLOWED.has(words.join(' ').toLowerCase())) out.push(words.join(' '));
  }
  return out;
}

/** Problems with the wording itself, whatever the facts. */
function wordingReasons(text: string): string[] {
  const reasons: string[] = [];
  if (GUILT.some((g) => g.test(text))) reasons.push('states guilt or certainty as fact');
  if (TIPPING_OFF.test(text) && !NEGATED.test(text)) reasons.push('could tip off the customer');
  if (IDENTIFIER.test(text)) reasons.push('puts an account or ID number in the prose');
  return reasons;
}

export function checkSentence(s: Sentence, facts: Map<string, Fact>, allFactText: string, citesRequired = false): CheckedSentence {
  const reasons: string[] = [];
  const text = s.text.trim();
  const cites = [...new Set(s.cites.map((c) => c.trim().toUpperCase()))];
  for (const c of cites) if (!facts.has(c)) reasons.push(`cites ${c}, which is not a fact of this case`);
  const known = cites.filter((c) => facts.has(c));
  const cited = known.map((c) => facts.get(c)!.text).join(' ');
  const citedNumbers = new Set(numbersIn(cited));
  const nums = numbersIn(text);
  const names = namesIn(text);
  if (text.split(/\s+/v).length < 4) reasons.push('is a fragment, not a sentence');
  if (!known.length && citesRequired) reasons.push('cites no fact');
  else if (!known.length && (nums.length || names.length)) reasons.push('has figures or names but cites no fact');
  for (const n of nums) if (known.length && !citedNumbers.has(n)) reasons.push(`the number ${n} is not in the cited facts`);
  for (const n of names) if (!allFactText.includes(n)) reasons.push(`"${n}" does not appear in the case data`);
  reasons.push(...wordingReasons(text));
  return { text, cites: known, ok: reasons.length === 0, reasons };
}

/** citesRequired: every sentence must cite a fact (summaries, red flags, SAR text); otherwise only sentences with figures or names must. */
export function checkAll(sentences: Sentence[], facts: Fact[], writtenBy: 'model' | 'code', citesRequired = false): CheckedText {
  const map = new Map(facts.map((f) => [f.id, f]));
  const all = facts.map((f) => f.text).join(' ');
  const checked = sentences.filter((s) => s.text.trim()).map((s) => checkSentence(s, map, all, citesRequired));
  return { sentences: checked.filter((c) => c.ok), removed: checked.filter((c) => !c.ok), writtenBy };
}

function stripRefs(text: string): string {
  return text
    .replace(CITATION_RUN, '')
    .replace(FACT_REF, '')
    .replace(SPACE_BEFORE_PUNCT, '$<p>')
    .replace(/,(?:\s*,)+/gv, ',')
    .replace(/,\s*\./gv, '.')
    .trim()
    .replace(/[,;:]$/v, '.');
}

function refsIn(text: string): string[] {
  return [...text.matchAll(FACT_REF)].map((m) => m.groups?.id ?? '').filter(Boolean);
}

/** Accepts the shapes small models return: [{text, cites}], ["text [F1]"], or {text, citations}. */
export function toSentences(value: unknown): Sentence[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v): Sentence | null => {
      if (typeof v === 'string') {
        return { text: stripRefs(v), cites: refsIn(v) };
      }
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        const text = [o.text, o.sentence].find((x): x is string => typeof x === 'string') ?? '';
        const raw = o.cites ?? o.citations ?? o.facts ?? [];
        const cites = Array.isArray(raw)
          ? raw.filter((c): c is string => typeof c === 'string')
          : typeof raw === 'string'
            ? raw.split(/[,\s]+/v)
            : [];
        return { text: stripRefs(text), cites: [...cites, ...refsIn(text)] };
      }
      return null;
    })
    .filter((s): s is Sentence => Boolean(s?.text));
}
