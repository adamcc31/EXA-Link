/**
 * Types untuk feature Auth.
 * Akan dipopulasi di Fase 3–4 saat implementasi login/session.
 */

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'agent';
  is_active: boolean;
}
