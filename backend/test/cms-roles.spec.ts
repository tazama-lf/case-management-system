import { CMS_ROLE_PRECEDENCE, isAclBypassRole, resolveCmsRole } from '../src/utils/cms-roles';

describe('cms-roles', () => {
  describe('resolveCmsRole', () => {
    it('picks the highest-precedence role regardless of input order', () => {
      expect(resolveCmsRole(['CMS_INVESTIGATOR', 'CMS_SUPERVISOR'])).toBe('CMS_SUPERVISOR');
      expect(resolveCmsRole(['CMS_SUPERVISOR', 'CMS_INVESTIGATOR'])).toBe('CMS_SUPERVISOR');
      expect(resolveCmsRole(['CMS_INVESTIGATOR', 'CMS_COMPLIANCE_OFFICER'])).toBe('CMS_COMPLIANCE_OFFICER');
    });

    it('ranks admin first, then supervisor, compliance officer and investigator', () => {
      expect(resolveCmsRole(['CMS_INVESTIGATOR', 'CMS_SUPERVISOR', 'CMS_ADMIN'])).toBe('CMS_ADMIN');
      expect(resolveCmsRole(['CMS_ADMIN', 'CMS_COMPLIANCE_OFFICER'])).toBe('CMS_ADMIN');
      expect(resolveCmsRole(['CMS_COMPLIANCE_OFFICER', 'CMS_SUPERVISOR'])).toBe('CMS_SUPERVISOR');
      expect(resolveCmsRole(['CMS_INVESTIGATOR', 'CMS_COMPLIANCE_OFFICER'])).toBe('CMS_COMPLIANCE_OFFICER');
      expect(CMS_ROLE_PRECEDENCE[CMS_ROLE_PRECEDENCE.length - 1]).toBe('CMS_INVESTIGATOR');
    });

    it('returns the only supported role, ignoring unrelated ones and non-strings', () => {
      expect(resolveCmsRole(['offline_access', 'CMS_INVESTIGATOR', 42, null])).toBe('CMS_INVESTIGATOR');
    });

    it('returns undefined when there is no CMS role or no list', () => {
      expect(resolveCmsRole(['offline_access'])).toBeUndefined();
      expect(resolveCmsRole([])).toBeUndefined();
      expect(resolveCmsRole(undefined)).toBeUndefined();
      expect(resolveCmsRole(null)).toBeUndefined();
    });
  });

  describe('isAclBypassRole', () => {
    it('is true only for supervisor and compliance officer', () => {
      expect(isAclBypassRole('CMS_SUPERVISOR')).toBe(true);
      expect(isAclBypassRole('CMS_COMPLIANCE_OFFICER')).toBe(true);
      expect(isAclBypassRole('CMS_INVESTIGATOR')).toBe(false);
      expect(isAclBypassRole('CMS_ADMIN')).toBe(false);
      expect(isAclBypassRole(null)).toBe(false);
      expect(isAclBypassRole(undefined)).toBe(false);
    });
  });
});
