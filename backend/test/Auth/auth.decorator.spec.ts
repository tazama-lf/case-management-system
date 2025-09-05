import 'reflect-metadata';
import { SetMetadata } from '@nestjs/common';
import {
  CLAIMS_KEY,
  IS_PUBLIC_KEY,
  RequireClaims,
  Public,
  RequireClaim,
  TazamaClaims,
 RequireAlertTriageRole,
  RequireAccountManagement,
} from '../../src/auth/auth.decorator';

// Mock SetMetadata to capture calls
jest.mock('@nestjs/common', () => ({
  SetMetadata: jest.fn(),
}));

const mockedSetMetadata = SetMetadata as jest.MockedFunction<typeof SetMetadata>;

describe('Auth Decorators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constants', () => {
    it('should define CLAIMS_KEY constant', () => {
      expect(CLAIMS_KEY).toBe('claims');
    });

    it('should define IS_PUBLIC_KEY constant', () => {
      expect(IS_PUBLIC_KEY).toBe('isPublic');
    });
  });

  describe('RequireClaims decorator', () => {
    it('should call SetMetadata with CLAIMS_KEY and claims array', () => {
      const claims = ['claim1', 'claim2', 'claim3'];
      
      RequireClaims(...claims);
      
      expect(mockedSetMetadata).toHaveBeenCalledWith(CLAIMS_KEY, claims);
      expect(mockedSetMetadata).toHaveBeenCalledTimes(1);
    });

    it('should work with single claim', () => {
      const claim = 'single-claim';
      
      RequireClaims(claim);
      
      expect(mockedSetMetadata).toHaveBeenCalledWith(CLAIMS_KEY, [claim]);
    });

    it('should work with empty claims array', () => {
      RequireClaims();
      
      expect(mockedSetMetadata).toHaveBeenCalledWith(CLAIMS_KEY, []);
    });

    it('should work with multiple identical claims', () => {
      const claims = ['same-claim', 'same-claim', 'same-claim'];
      
      RequireClaims(...claims);
      
      expect(mockedSetMetadata).toHaveBeenCalledWith(CLAIMS_KEY, claims);
    });
  });

  describe('Public decorator', () => {
    it('should call SetMetadata with IS_PUBLIC_KEY and true', () => {
      Public();
      
      expect(mockedSetMetadata).toHaveBeenCalledWith(IS_PUBLIC_KEY, true);
      expect(mockedSetMetadata).toHaveBeenCalledTimes(1);
    });
  });

  describe('RequireClaim decorator', () => {
    it('should call SetMetadata with CLAIMS_KEY and single claim in array', () => {
      const claim = 'test-claim';
      
      RequireClaim(claim);
      
      expect(mockedSetMetadata).toHaveBeenCalledWith(CLAIMS_KEY, [claim]);
      expect(mockedSetMetadata).toHaveBeenCalledTimes(1);
    });

    it('should work with empty string claim', () => {
      RequireClaim('');
      
      expect(mockedSetMetadata).toHaveBeenCalledWith(CLAIMS_KEY, ['']);
    });

    it('should work with special characters in claim', () => {
      const claim = 'claim-with-special-chars!@#$%^&*()';
      
      RequireClaim(claim);
      
      expect(mockedSetMetadata).toHaveBeenCalledWith(CLAIMS_KEY, [claim]);
    });
  });

  describe('TazamaClaims', () => {
    it('should define all expected claim constants', () => {
      expect(TazamaClaims.ALERT_TRIAGE).toBe('alert-triage');
      expect(TazamaClaims.MANAGE_ACCOUNT).toBe('manage-account');
      expect(TazamaClaims.MANAGE_ACCOUNT_LINKS).toBe('manage-account-links');
      expect(TazamaClaims.VIEW_PROFILE).toBe('view-profile');
      expect(TazamaClaims.DEFAULT_ROLES_TAZAMA_CMS).toBe('default-roles-tazama-cms');
      expect(TazamaClaims.OFFLINE_ACCESS).toBe('offline_access');
      expect(TazamaClaims.UMA_AUTHORIZATION).toBe('uma_authorization');
    });

    it('should have all expected properties', () => {
      const expectedClaims = [
        'ALERT_TRIAGE',
        'MANAGE_ACCOUNT', 
        'MANAGE_ACCOUNT_LINKS',
        'VIEW_PROFILE',
        'DEFAULT_ROLES_TAZAMA_CMS',
        'OFFLINE_ACCESS',
        'UMA_AUTHORIZATION'
      ];
      
      expectedClaims.forEach(claim => {
        expect(TazamaClaims).toHaveProperty(claim);
      });
    });

    it('should have string values for all claims', () => {
      Object.values(TazamaClaims).forEach(claim => {
        expect(typeof claim).toBe('string');
        expect(claim.length).toBeGreaterThan(0);
      });
    });
  });

  describe('RequireCMSTestRole decorator', () => {
    it('should call SetMetadata with CMS_TEST_ROLE claim', () => {
     RequireAlertTriageRole();
      
      expect(mockedSetMetadata).toHaveBeenCalledWith(CLAIMS_KEY, [TazamaClaims.ALERT_TRIAGE]);
      expect(mockedSetMetadata).toHaveBeenCalledTimes(1);
    });
  });

  describe('RequireAccountManagement decorator', () => {
    it('should call SetMetadata with both account management claims', () => {
      RequireAccountManagement();
      
      expect(mockedSetMetadata).toHaveBeenCalledWith(CLAIMS_KEY, [
        TazamaClaims.MANAGE_ACCOUNT,
        TazamaClaims.MANAGE_ACCOUNT_LINKS,
      ]);
      expect(mockedSetMetadata).toHaveBeenCalledTimes(1);
    });
  });

  describe('Decorator composition', () => {
    it('should allow multiple decorators to be used', () => {
      RequireClaims('claim1', 'claim2');
      Public();
      RequireClaim('single-claim');
      
      expect(mockedSetMetadata).toHaveBeenCalledTimes(3);
      expect(mockedSetMetadata).toHaveBeenNthCalledWith(1, CLAIMS_KEY, ['claim1', 'claim2']);
      expect(mockedSetMetadata).toHaveBeenNthCalledWith(2, IS_PUBLIC_KEY, true);
      expect(mockedSetMetadata).toHaveBeenNthCalledWith(3, CLAIMS_KEY, ['single-claim']);
    });
  });

  describe('Edge cases', () => {
    it('should handle Unicode characters in claims', () => {
      const unicodeClaim = 'claim-with-unicode-🚀-characters';
      
      RequireClaim(unicodeClaim);
      
      expect(mockedSetMetadata).toHaveBeenCalledWith(CLAIMS_KEY, [unicodeClaim]);
    });

    it('should handle very long claim names', () => {
      const longClaim = 'a'.repeat(1000);
      
      RequireClaim(longClaim);
      
      expect(mockedSetMetadata).toHaveBeenCalledWith(CLAIMS_KEY, [longClaim]);
    });

    it('should handle claims with spaces', () => {
      const claimWithSpaces = 'claim with multiple spaces';
      
      RequireClaim(claimWithSpaces);
      
      expect(mockedSetMetadata).toHaveBeenCalledWith(CLAIMS_KEY, [claimWithSpaces]);
    });

    it('should handle numeric-like strings as claims', () => {
      const numericClaim = '12345';
      
      RequireClaim(numericClaim);
      
      expect(mockedSetMetadata).toHaveBeenCalledWith(CLAIMS_KEY, [numericClaim]);
    });
  });

  describe('Function types and return values', () => {
    it('should return the result of SetMetadata for RequireClaims', () => {
      const mockReturnValue = 'mocked-return-value';
      mockedSetMetadata.mockReturnValue(mockReturnValue as any);
      
      const result = RequireClaims('test');
      
      expect(result).toBe(mockReturnValue);
    });

    it('should return the result of SetMetadata for Public', () => {
      const mockReturnValue = 'mocked-public-return';
      mockedSetMetadata.mockReturnValue(mockReturnValue as any);
      
      const result = Public();
      
      expect(result).toBe(mockReturnValue);
    });

    it('should return the result of SetMetadata for RequireClaim', () => {
      const mockReturnValue = 'mocked-claim-return';
      mockedSetMetadata.mockReturnValue(mockReturnValue as any);
      
      const result = RequireClaim('test');
      
      expect(result).toBe(mockReturnValue);
    });

    it('should return the result of SetMetadata forRequireAlertTriageRole', () => {
      const mockReturnValue = 'mocked-cms-return';
      mockedSetMetadata.mockReturnValue(mockReturnValue as any);
      
      const result =RequireAlertTriageRole();
      
      expect(result).toBe(mockReturnValue);
    });

    it('should return the result of SetMetadata for RequireAccountManagement', () => {
      const mockReturnValue = 'mocked-account-return';
      mockedSetMetadata.mockReturnValue(mockReturnValue as any);
      
      const result = RequireAccountManagement();
      
      expect(result).toBe(mockReturnValue);
    });
  });
});
