export type { AuthSession, AuthUser } from '../../types';
export interface Credentials { email: string; password: string }
export interface Registration extends Credentials { name: string }
