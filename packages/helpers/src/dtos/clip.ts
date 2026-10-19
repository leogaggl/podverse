import type { DTOAccount } from './account/account.js';
import type { DTOItem } from './item/item.js';
import type { DTORemovedSource } from './removedSource.js';
import type { DTOSharableStatus } from './sharableStatus.js';

export interface DTOClip {
  id: number;
  id_text: string;
  account: DTOAccount;
  item_id: string | null;
  item?: DTOItem | null;
  start_time: string;
  end_time?: string | null;
  title?: string | null;
  description?: string | null;
  removed_source?: DTORemovedSource | null;
  source_removed_at?: string | null;
  sharable_status: DTOSharableStatus;
}
