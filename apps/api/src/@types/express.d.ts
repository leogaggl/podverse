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
    }
    interface Request {
      user?: User;
    }
  }
}

// Exporting an empty module to make sure TypeScript treats this as a module
export {};
