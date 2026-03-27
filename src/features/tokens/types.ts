/**
 * Types untuk feature Tokens.
 * Akan dipopulasi di Fase 3 saat implementasi token generation.
 */

export interface GenerateTokenPayload {
  expires_in_days?: number;
}

export interface GenerateTokenResponse {
  access_url: string;
  token_prefix: string;
  expires_at: string;
  warning: string;
}

export interface TokenInfo {
  id: string;
  prefix: string;
  is_active: boolean;
  expires_at: string;
  failed_attempts: number;
  locked_until: string | null;
  generated_by: {
    id: string;
    full_name: string;
  };
  created_at: string;
}

export interface ChallengeVerificationPayload {
  date_of_birth: string;
}

export interface ChallengeVerificationResult {
  verified: boolean;
  session_token?: string;
  session_expires_at?: string;
}
