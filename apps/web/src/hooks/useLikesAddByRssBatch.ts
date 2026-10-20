'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { buildAddByRSSResourceData, getAddByRSSHashIds } from '@podverse/parser-mapping';

import { useAccount } from '../contexts/Account';
import { getApiRequestService } from '../factories/apiRequestService';
import type { AddByRSSItemIndexItem } from '../utils/addByRSS/types';

type RowEntry = { hashId: string; indexItem: AddByRSSItemIndexItem };

/** A like stored under any of the item's hashes (feed form or legacy form) counts. */
export function useLikesAddByRssBatch(rows: RowEntry[]) {
  const { loggedInAccount } = useAccount();
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const hashIdsByRow = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of rows) {
      if (r.hashId.length > 0) {
        m.set(r.hashId, getAddByRSSHashIds(r.indexItem));
      }
    }
    return m;
  }, [rows]);
  const hashList = useMemo(
    () => [...new Set([...hashIdsByRow.values()].flat())].sort(),
    [hashIdsByRow]
  );
  const sortedKey = useMemo(() => hashList.join('\u0001'), [hashList]);
  const rowByHash = useMemo(() => {
    const m = new Map<string, AddByRSSItemIndexItem>();
    for (const r of rows) {
      m.set(r.hashId, r.indexItem);
    }
    return m;
  }, [rows]);

  useEffect(() => {
    if (!loggedInAccount || hashList.length === 0) {
      setLikedSet(new Set());
      return;
    }

    let cancelled = false;
    setIsBatchLoading(true);
    (async () => {
      const res = await getApiRequestService().reqPlaylistLikesMembership({
        add_by_rss_hash_ids: hashList,
      });
      if (cancelled) {
        return;
      }
      setLikedSet(new Set(res.add_by_rss_hash_ids));
      setIsBatchLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [hashList, loggedInAccount, sortedKey]);

  const isLikedIn = useCallback(
    (set: Set<string>, hashId: string): boolean =>
      (hashIdsByRow.get(hashId) ?? [hashId]).some((id) => set.has(id)),
    [hashIdsByRow]
  );

  const isLiked = useCallback(
    (hashId: string) => !isBatchLoading && isLikedIn(likedSet, hashId),
    [isBatchLoading, isLikedIn, likedSet]
  );

  const toggle = useCallback(
    async (hashId: string) => {
      if (!loggedInAccount) {
        return;
      }
      const indexItem = rowByHash.get(hashId);
      if (!indexItem) {
        return;
      }
      const rowHashIds = hashIdsByRow.get(hashId) ?? [hashId];
      const setLiked = (liked: boolean) => {
        setLikedSet((s) => {
          const n = new Set(s);
          for (const id of rowHashIds) {
            n.delete(id);
          }
          if (liked) {
            n.add(hashId);
          }
          return n;
        });
      };
      const was = isLikedIn(likedSet, hashId);
      setLiked(!was);
      try {
        const addByRssResourceData = buildAddByRSSResourceData(indexItem);
        const r = await getApiRequestService().reqPlaylistToggleLike({
          resource_type: 'add_by_rss',
          add_by_rss_hash_id: hashId,
          add_by_rss_resource_data: { ...addByRssResourceData },
        });
        setLiked(r.liked);
      } catch {
        setLiked(was);
      }
    },
    [hashIdsByRow, isLikedIn, loggedInAccount, likedSet, rowByHash]
  );

  return { isLiked, toggle, isBatchLoading, likedSet };
}
