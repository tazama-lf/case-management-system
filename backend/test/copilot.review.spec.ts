import { refusal, statusOf, type ReviewEvent } from '../src/modules/copilot/sar-review';

const ev = (action: ReviewEvent['action'], actorId: string, id = 1): ReviewEvent => ({
  id,
  draftId: 1,
  action,
  actorId,
  actorName: actorId,
  role: action === 'APPROVE' || action === 'RETURN' ? 'checker' : 'maker',
  comment: '',
  at: '2026-10-26T00:00:00Z',
});
const maker = { id: 'inv', role: 'maker' as const };
const checker = { id: 'sup', role: 'checker' as const };

describe('SAR/STR review workflow', () => {
  it('starts as a draft and walks submit, approve, file', () => {
    expect(statusOf([])).toBe('DRAFT');
    expect(statusOf([ev('SUBMIT', 'inv')])).toBe('IN_REVIEW');
    expect(statusOf([ev('SUBMIT', 'inv'), ev('APPROVE', 'sup')])).toBe('APPROVED');
    expect(statusOf([ev('SUBMIT', 'inv'), ev('APPROVE', 'sup'), ev('FILE', 'inv')])).toBe('FILED');
  });

  it('a returned draft goes back to the maker and can be resubmitted', () => {
    const events = [ev('SUBMIT', 'inv'), ev('RETURN', 'sup')];
    expect(statusOf(events)).toBe('RETURNED');
    expect(refusal(events, 'SUBMIT', maker, '')).toBeNull();
  });

  it('only a checker reviews, and not their own submission', () => {
    const events = [ev('SUBMIT', 'inv')];
    expect(refusal(events, 'APPROVE', maker, '')).toMatch(/supervisor/);
    expect(refusal(events, 'APPROVE', checker, '')).toBeNull();
    expect(refusal([ev('SUBMIT', 'sup')], 'APPROVE', checker, '')).toMatch(/submitted/);
  });

  it('a return needs a reason and filing needs the FIU reference', () => {
    expect(refusal([ev('SUBMIT', 'inv')], 'RETURN', checker, ' ')).toMatch(/what needs to change/i);
    const approved = [ev('SUBMIT', 'inv'), ev('APPROVE', 'sup')];
    expect(refusal(approved, 'FILE', maker, '', '')).toMatch(/reference/);
    expect(refusal(approved, 'FILE', maker, '', 'FIU-123')).toBeNull();
  });

  it('refuses steps out of order', () => {
    expect(refusal([], 'APPROVE', checker, '')).toMatch(/not available/);
    expect(refusal([ev('SUBMIT', 'inv')], 'FILE', maker, '', 'x')).toMatch(/not available/);
  });
});
