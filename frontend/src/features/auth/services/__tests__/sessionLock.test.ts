import { describe, it, expect } from 'vitest';
import { ACTIVE_SESSION_KEY } from '../sessionLock';
import type { ActiveSession } from '../sessionLock';

describe('sessionLock', () => {
  it('exports ACTIVE_SESSION_KEY constant', () => {
    expect(ACTIVE_SESSION_KEY).toBe('ACTIVE_AUTH_SESSION');
  });

  it('ActiveSession interface is structurally valid', () => {
    const session: ActiveSession = {
      userId: 'user-1',
      username: 'john',
      issuedAt: Date.now(),
    };
    expect(session.userId).toBe('user-1');
    expect(session.username).toBe('john');
    expect(typeof session.issuedAt).toBe('number');
  });
});
