import { AuthenticatedRequest } from '../../modules/auth/auth.types';

/**
 * Simple function to extract common user data from request
 * Use this in any controller method
 */
export function extractUserData(req: AuthenticatedRequest) {
    const { clientId, tenantId, claims, email, fullName } = req.user.token;
    const bearerToken = req.headers.authorization?.replace('Bearer ', '');
    if (!clientId || !tenantId || !claims) {
        throw new Error('Missing clientId, tenantId or claims in auth token');
    }
    const role = req.user.validatedClaims.CMS_SUPERVISOR ? 'CMS_SUPERVISOR' : 'CMS_INVESTIGATOR';

    return {
        userId: clientId,
        tenantId,
        email,
        fullName,
        role,
        claims,
        userInfo: { tenantName: req.user.token.tenantName, role, token: bearerToken },
    };
}