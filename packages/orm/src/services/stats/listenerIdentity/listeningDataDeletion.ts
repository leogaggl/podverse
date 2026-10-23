import type { EntityManager } from 'typeorm';

import { StatsListenerService } from './statsListener.js';
import { lockListener } from './statsWriteGuard.js';

/**
 * Deletes an account's stored listening data when the listener opts out of Popularity Tracking.
 * Removing the listener row cascades to that listener's listen events, open events, Taste Profile
 * rows, and Hidden From Taste Profile rows. Daily and range totals have no listener column and
 * stay. See docs/features/POPULARITY-TRACKING.md.
 */
export class ListeningDataDeletionService {
  /**
   * Runs inside the caller's transaction, which also records the No, so the decision and the
   * deletion commit together. Returns whether a listener row existed.
   */
  async deleteForAccount(account_id: number, manager: EntityManager): Promise<boolean> {
    const listenerService = new StatsListenerService();
    const listenerId = await listenerService.findListenerId(account_id, manager);
    if (listenerId === null) {
      return false;
    }
    await lockListener(manager, listenerId);
    return listenerService.deleteForAccount(account_id, manager);
  }
}
