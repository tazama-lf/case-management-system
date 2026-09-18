export const ACTIVE_SESSION_KEY = 'ACTIVE_AUTH_SESSION';
export const ACTIVE_SESSION_USER = 'ACTIVE_SESSION_USER';

export interface ActiveSession {
  userId: string;
  username: string;
  issuedAt: number;
}
