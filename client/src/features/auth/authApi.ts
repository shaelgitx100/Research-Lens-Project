import { apiRequest } from '../../services/api';
import type { AuthSession, Credentials, Registration } from './authTypes';

export const authApi = {
  login: (credentials: Credentials) => apiRequest<AuthSession>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (details: Registration) => apiRequest<AuthSession>('/auth/register', { method: 'POST', body: JSON.stringify(details) }),
  currentUser: (token: string) => apiRequest<{ user: AuthSession['user'] }>('/auth/me', {}, token),
};
