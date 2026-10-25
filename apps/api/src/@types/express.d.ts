import "express"; // Import express types

import type {
  AccountMembershipEnum,
  AccountSessionClientType,
  AccountTrustEntitlements,
  ApiKeyPermissions,
} from "@podverse/helpers";

declare global {
  namespace Express {
    interface User {
      id: number;
      id_text: string;
      verified: boolean;
      /** `id_text` of the account session the request's token names; null for an API key. */
      session_id_text: string | null;
      /** The session's client type; set with `session_id_text` from the active session row. */
      session_client_type?: AccountSessionClientType;
      /** The session's device label; set with `session_id_text` from the active session row. */
      session_device_label?: string | null;
      /** ISO 8601; set with `session_id_text` from the active session row. */
      session_created_at?: string;
      /** The API key that authenticated the request; null for a session. */
      api_key: { id_text: string; permissions: ApiKeyPermissions } | null;
      entitlements?: AccountTrustEntitlements;
      /** Set when membership is checked. Trial and premium are the only stored values. */
      account_membership_id?: AccountMembershipEnum;
      /** The credential's expiry in epoch seconds: the JWT `exp`, or a key's `expires_at`. */
      token_expires_at?: number;
    }
    interface Request {
      user?: User;
    }
  }
}

// Exporting an empty module to make sure TypeScript treats this as a module
export {};
