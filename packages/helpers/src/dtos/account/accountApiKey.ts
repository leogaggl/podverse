import type { ApiKeyExpirationDays, ApiKeyPermissions } from '../../lib/apiKey.js';

/** One API key of the signed-in account. Dates are ISO 8601 strings. The token is never listed. */
export type DTOAccountApiKey = {
  id_text: string;
  name: string;
  /** Last characters of the token; show with formatApiKeyTokenHint. */
  token_hint: string;
  permissions: ApiKeyPermissions;
  created_at: string;
  /** Null when the key never expires. */
  expires_at: string | null;
  /** Last accepted request, kept to within API_KEY_LAST_USED_INTERVAL_MS. Null until first use. */
  last_used_at: string | null;
};

/** The create response: the only time the token is returned. */
export type DTOAccountApiKeyCreated = {
  api_key: DTOAccountApiKey;
  token: string;
};

/** POST /auth/api-keys body. Omitted expires_in_days means API_KEY_DEFAULT_EXPIRATION_DAYS. */
export type AccountApiKeyCreateBody = {
  name: string;
  permissions: Partial<ApiKeyPermissions>;
  expires_in_days?: ApiKeyExpirationDays;
};
