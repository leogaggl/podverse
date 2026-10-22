import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';

import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';

import { useAuth } from '../../../auth/AuthProvider';
import { resolveAddToPlaylistTarget } from '../../../components/player/fullPlayerRows';
import { useQueueMutations } from '../../../hooks/useQueueMutations';
import { toAddByRssItemPlaybackResourceData } from '../../../lib/addByRss/domain';
import { useMembershipGate } from '../../../membership/MembershipGateProvider';
import type { MobileAddByRSSFeedRecord } from '../../../prefs/addByRSSFeeds';
import { useAddToPlaylist } from '../../library/useAddToPlaylist';
import type { QueueActionPosition } from '../useHomeRowPlayback';
import { useQueueHistoryGate } from '../useHomeRowPlayback';

export type AddByRssItemActionNoticeKey =
  | 'features.queue.added_to_queue'
  | 'features.queue.add_error'
  | 'features.history.marked_as_played'
  | 'features.history.mark_as_played_error';

export type AddByRssItemActionTarget = {
  feed: MobileAddByRSSFeedRecord;
  itemBundle: AddByRSSMappedFeed['items'][number];
  itemIndex: number;
  mappedFeed: AddByRSSMappedFeed;
};

const resolveTarget = (target: AddByRssItemActionTarget) => {
  const resourceData = toAddByRssItemPlaybackResourceData(
    target.feed,
    target.mappedFeed,
    target.itemBundle,
    target.itemIndex
  );
  const playlistTarget = resolveAddToPlaylistTarget({ kind: 'add-by-rss', resourceData });
  if (playlistTarget === null || playlistTarget.kind !== 'add-by-rss') {
    return null;
  }
  return { playlistTarget, resourceData };
};

/**
 * The More menu actions for one Add by RSS episode or track, mirroring `useHomeRowPlayback` and
 * the podcast Episodes section, written with resource data instead of a catalog id. The item's
 * medium picks the queue, playlist kind, and history.
 */
export function useAddByRssItemActions(): {
  actionNoticeKey: AddByRssItemActionNoticeKey | null;
  addToPlaylist: (target: AddByRssItemActionTarget) => void;
  addToPlaylistSheet: ReactNode;
  markAsPlayed: (target: AddByRssItemActionTarget) => void;
  queue: (target: AddByRssItemActionTarget, position: QueueActionPosition) => void;
} {
  const [actionNoticeKey, setActionNoticeKey] = useState<AddByRssItemActionNoticeKey | null>(null);
  const { status } = useAuth();
  const { addAddByRssToQueueLast, addAddByRssToQueueNext, markAddByRssAsPlayed } =
    useQueueMutations();
  const { handleGateError, openGate } = useMembershipGate();
  const didOpenQueueHistoryGate = useQueueHistoryGate();
  const { addToPlaylistSheet, requestAddToPlaylist } = useAddToPlaylist();

  const queue = useCallback(
    (target: AddByRssItemActionTarget, position: QueueActionPosition) => {
      const resolved = resolveTarget(target);
      if (resolved === null) {
        return;
      }
      if (didOpenQueueHistoryGate()) {
        return;
      }

      void (async () => {
        try {
          const added = await (position === 'next'
            ? addAddByRssToQueueNext(resolved.resourceData, resolved.playlistTarget.medium)
            : addAddByRssToQueueLast(resolved.resourceData, resolved.playlistTarget.medium));
          setActionNoticeKey(added ? 'features.queue.added_to_queue' : 'features.queue.add_error');
        } catch (error) {
          if (handleGateError(error)) {
            return;
          }
          setActionNoticeKey('features.queue.add_error');
        }
      })();
    },
    [addAddByRssToQueueLast, addAddByRssToQueueNext, didOpenQueueHistoryGate, handleGateError]
  );

  const markAsPlayed = useCallback(
    (target: AddByRssItemActionTarget) => {
      const resolved = resolveTarget(target);
      if (resolved === null) {
        return;
      }
      if (didOpenQueueHistoryGate()) {
        return;
      }

      void (async () => {
        try {
          const marked = await markAddByRssAsPlayed(
            resolved.resourceData,
            resolved.playlistTarget.medium
          );
          setActionNoticeKey(
            marked ? 'features.history.marked_as_played' : 'features.history.mark_as_played_error'
          );
        } catch (error) {
          if (handleGateError(error)) {
            return;
          }
          setActionNoticeKey('features.history.mark_as_played_error');
        }
      })();
    },
    [didOpenQueueHistoryGate, handleGateError, markAddByRssAsPlayed]
  );

  const addToPlaylist = useCallback(
    (target: AddByRssItemActionTarget) => {
      const resolved = resolveTarget(target);
      if (resolved === null) {
        return;
      }
      if (status !== 'authenticated') {
        openGate('needs_account');
        return;
      }
      requestAddToPlaylist(resolved.playlistTarget);
    },
    [openGate, requestAddToPlaylist, status]
  );

  return {
    actionNoticeKey,
    addToPlaylist,
    addToPlaylistSheet,
    markAsPlayed,
    queue,
  };
}
