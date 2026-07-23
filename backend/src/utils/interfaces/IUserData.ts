export interface IUserData {
  userId: string;
  tenantId: string;
  email: string;
  fullName: string | undefined;
  role: string;
  claims: string[];
  validateClaim: string;
  isComplianceOfficer: boolean;
  userInfo: { tenantName: string; role: string; token: string | undefined; validateClaim: string };
}
