import { useCallback } from 'react';

import type { AddByRSSResourceData } from '@podverse/helpers';
import { toNonEmptyTrimmedString } from '@podverse/helpers/guards';
import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';

import { toAddByRssLiveItemPlaybackResourceData } from '../lib/addByRss/domain';
import { addByRssEpisodePlayEntry } from '../lib/addByRss/feedWalk';
import { addByRssPlaybackMediaId } from '../lib/addByRss/resourceData';
import { usePlaybackRowDisplay } from '../playback/crossDevice/useCrossDevicePlayerDisplay';
import { usePlaybackSession } from '../playback/PlaybackProvider';
import type { MobileAddByRSSFeedRecord } from '../prefs/addByRSSFeeds';

type UseAddByRssPlaybackOptions = {
  onNotice: (messageKey: string | null) => void;
};

/**
 * Plays a device-local add-by-RSS episode or livestream through the shared player, so the mini
 * player, queue advance, and car surfaces all describe what is actually playing. A finished
 * download of an episode plays from the device. A livestream has no download. Loading the native
 * engine from a screen would leave whatever the provider last loaded (for example the queue head
 * adopted at sign-in) as the now-playing item, and its `ended` event would finish that item
 * instead. Pressing play on the active row pauses or resumes it, as other rows do.
 */
export function useAddByRssPlayback({ onNotice }: UseAddByRssPlaybackOptions) {
  const { pause, playAddByRssResourceData, resume } = usePlaybackSession();
  const { activeMediaId, isPlaying } = usePlaybackRowDisplay();

  const playLoadedResource = useCallback(
    async (resourceData: AddByRSSResourceData, localDownloadItemIdText?: string) => {
      if (activeMediaId !== null && activeMediaId === addByRssPlaybackMediaId(resourceData)) {
        if (isPlaying) {
          pause();
        } else {
          await resume();
        }
        return;
      }

      onNotice(null);
      await playAddByRssResourceData(
        resourceData,
        localDownloadItemIdText === undefined ? undefined : { localDownloadItemIdText }
      );
    },
    [activeMediaId, isPlaying, onNotice, pause, playAddByRssResourceData, resume]
  );

  const playItem = useCallback(
    async (
      feed: MobileAddByRSSFeedRecord,
      mappedFeed: AddByRSSMappedFeed,
      itemBundle: AddByRSSMappedFeed['items'][number],
      itemIndex: number
    ) => {
      const entry = addByRssEpisodePlayEntry(feed, mappedFeed, itemBundle, itemIndex);
      if (entry === null) {
        onNotice('features.add_by_rss.status_processing');
        return;
      }

      await playLoadedResource(entry.resourceData, entry.localDownloadItemIdText);
    },
    [onNotice, playLoadedResource]
  );

  const playLiveItem = useCallback(
    async (
      feed: MobileAddByRSSFeedRecord,
      mappedFeed: AddByRSSMappedFeed,
      liveBundle: AddByRSSMappedFeed['liveItems'][number],
      liveIndex: number
    ) => {
      if (toNonEmptyTrimmedString(liveBundle.item.enclosure.url) === null) {
        onNotice('features.add_by_rss.status_processing');
        return;
      }

      await playLoadedResource(
        toAddByRssLiveItemPlaybackResourceData(feed, mappedFeed, liveBundle, liveIndex)
      );
    },
    [onNotice, playLoadedResource]
  );

  return { playItem, playLiveItem };
}
