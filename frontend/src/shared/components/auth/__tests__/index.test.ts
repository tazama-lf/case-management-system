import { describe, it, expect } from 'vitest';
import * as AuthComponents from '../index';

describe('shared/components/auth/index', () => {
  it('exports RoleGuard', () => {
    expect(AuthComponents.RoleGuard).toBeDefined();
  });

  it('exports SupervisorOnly', () => {
    expect(AuthComponents.SupervisorOnly).toBeDefined();
  });

  it('exports InvestigatorOnly', () => {
    expect(AuthComponents.InvestigatorOnly).toBeDefined();
  });

  it('exports AdminOnly', () => {
    expect(AuthComponents.AdminOnly).toBeDefined();
  });

  it('exports SupervisorOrAdmin', () => {
    expect(AuthComponents.SupervisorOrAdmin).toBeDefined();
  });

  it('exports AuthenticatedOnly', () => {
    expect(AuthComponents.AuthenticatedOnly).toBeDefined();
  });
});

