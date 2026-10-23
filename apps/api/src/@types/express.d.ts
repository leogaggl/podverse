import "express"; // Import express types

import type { AccountTrustEntitlements } from "@podverse/helpers";

declare global {
  namespace Express {
    interface User {
      id: number;
      id_text: string;
      verified: boolean;
      /** `id_text` of the account session the request's token names. */
      session_id_text: string;
      entitlements?: AccountTrustEntitlements;
      /** The auth token's `exp` claim, in epoch seconds. */
      token_expires_at?: number;
    }
    interface Request {
      user?: User;
    }
  }
}

// Exporting an empty module to make sure TypeScript treats this as a module
export {};
