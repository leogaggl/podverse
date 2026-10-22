'use client';

import { useEffect, useRef, useState } from 'react';

import { useAccount } from '../contexts/Account';
import { partitionAddByRSSFeedsByCredentials } from '../utils/addByRSS/credentialsStatus';
import { listFeedsWithCredentials } from '../utils/addByRSS/credentialStore';
import { onAddByRSSFeedChanged } from '../utils/addByRSS/feedChangedEvent';
import { enqueueAddByRSSFirstParses } from '../utils/addByRSS/firstParse';
import { getAddByRSSFeedsByResourceType } from '../utils/addByRSS/storage';
import { syncAddByRSSFollowStubs } from '../utils/addByRSS/sync';
import type { AddByRSSFeedRecord, AddByRSSResourceType } from '../utils/addByRSS/types';

/** Bursts of feed updates collapse into one re-read. */
const FEED_CHANGED_REFRESH_DELAY_MS = 250;

const EMPTY_FEEDS: AddByRSSFeedRecord[] = [];

export type ReadyAddByRSSFeeds = {
  feeds: AddByRSSFeedRecord[];
  /** False until the first read finishes; true at once when the hook is inactive. */
  isReady: boolean;
};

const INACTIVE_RESULT: ReadyAddByRSSFeeds = { feeds: EMPTY_FEEDS, isReady: true };
const LOADING_RESULT: ReadyAddByRSSFeeds = { feeds: EMPTY_FEEDS, isReady: false };

type ReadyState = {
  key: string;
  value: ReadyAddByRSSFeeds;
};

/**
 * Ready Add by RSS feeds for the given resource types on this browser.
 *
 * Inactive — signed out, an account with no Add by RSS follows, or no resource types — it
 * returns no feeds and does not read storage or send a request. Callers pass module-level arrays
 * so the effect key stays stable.
 */
export function useReadyAddByRSSFeeds(
  resourceTypes: readonly AddByRSSResourceType[]
): ReadyAddByRSSFeeds {
  const { loggedInAccount } = useAccount();
  const accountId = loggedInAccount?.id_text ?? null;
  const hasFollows = (loggedInAccount?.account_following_add_by_rss_channels?.length ?? 0) > 0;
  const resourceTypeKey = resourceTypes.join('|');
  const isActive = resourceTypeKey !== '' && accountId !== null && hasFollows;
  const activeKey = isActive ? `${accountId}|${resourceTypeKey}` : '';

  const resourceTypesRef = useRef(resourceTypes);
  resourceTypesRef.current = resourceTypes;

  const [state, setState] = useState<ReadyState>({ key: '', value: INACTIVE_RESULT });

  useEffect(() => {
    if (accountId === null || activeKey === '') {
      setState((previous) =>
        previous.key === '' ? previous : { key: '', value: INACTIVE_RESULT }
      );
      return;
    }

    let cancelled = false;
    let initialFinished = false;
    let sawChangeDuringLoad = false;
    let refreshGeneration = 0;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const readCredentialUrls = async (): Promise<ReadonlySet<string>> => {
      try {
        return new Set(await listFeedsWithCredentials(accountId));
      } catch (error) {
        console.error(error);
        return new Set();
      }
    };

    const readReadyFeeds = async (
      credentialUrls: ReadonlySet<string>
    ): Promise<AddByRSSFeedRecord[]> => {
      const feeds: AddByRSSFeedRecord[] = [];
      for (const resourceType of resourceTypesRef.current) {
        feeds.push(...(await getAddByRSSFeedsByResourceType(resourceType)));
      }
      return partitionAddByRSSFeedsByCredentials(feeds, credentialUrls).ready;
    };

    const publish = (feeds: AddByRSSFeedRecord[]) => {
      if (cancelled) {
        return;
      }
      setState({
        key: activeKey,
        value: { feeds: feeds.length === 0 ? EMPTY_FEEDS : feeds, isReady: true },
      });
    };

    const scheduleRefresh = () => {
      if (refreshTimer !== null) {
        clearTimeout(refreshTimer);
      }
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        const generation = ++refreshGeneration;
        if (cancelled) {
          return;
        }
        void (async () => {
          try {
            const credentialUrls = await readCredentialUrls();
            if (cancelled || generation !== refreshGeneration) {
              return;
            }
            const ready = await readReadyFeeds(credentialUrls);
            if (cancelled || generation !== refreshGeneration) {
              return;
            }
            publish(ready);
          } catch (error) {
            console.error(error);
          }
        })();
      }, FEED_CHANGED_REFRESH_DELAY_MS);
    };

    const unsubscribe = onAddByRSSFeedChanged(() => {
      if (!initialFinished) {
        sawChangeDuringLoad = true;
        return;
      }
      scheduleRefresh();
    });

    void (async () => {
      const credentialUrls = await readCredentialUrls();
      if (cancelled) {
        return;
      }
      try {
        await syncAddByRSSFollowStubs(accountId);
      } catch (error) {
        console.error(error);
      }
      if (cancelled) {
        return;
      }
      try {
        publish(await readReadyFeeds(credentialUrls));
      } catch (error) {
        console.error(error);
        publish(EMPTY_FEEDS);
      }
      if (cancelled) {
        return;
      }
      initialFinished = true;
      if (sawChangeDuringLoad) {
        scheduleRefresh();
      }
      void enqueueAddByRSSFirstParses({ accountId });
    })();

    return () => {
      cancelled = true;
      unsubscribe();
      if (refreshTimer !== null) {
        clearTimeout(refreshTimer);
      }
    };
  }, [accountId, activeKey]);

  if (activeKey === '') {
    return INACTIVE_RESULT;
  }
  if (state.key !== activeKey) {
    return LOADING_RESULT;
  }
  return state.value;
}
