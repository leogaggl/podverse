import type { AccountSessionClientType } from '../../lib/accountSession.js';

/** One active session of the signed-in account. Dates are ISO 8601 strings. */
export type DTOAccountSession = {
  id_text: string;
  client_type: AccountSessionClientType;
  device_label: string | null;
  created_at: string;
  /** Last request on this session, kept to within a day. */
  last_seen_at: string;
  /** True for the session that made this request. */
  is_current: boolean;
};
