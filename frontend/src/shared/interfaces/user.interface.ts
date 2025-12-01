export interface User {
    userId: string;
    tenantId: string;
    email: string;
    fullName: string;
    tenantName: string;
    validatedClaims: Record<string, any>;
}