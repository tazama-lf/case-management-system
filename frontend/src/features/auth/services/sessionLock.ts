export const ACTIVE_SESSION_KEY = 'ACTIVE_AUTH_SESSION';

export interface ActiveSession {
    userId: string;
    username: string;
    issuedAt: number;
}