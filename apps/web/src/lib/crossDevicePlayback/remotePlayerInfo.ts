import type { DTOPlaybackResourceSummary } from '@podverse/helpers';
import { buildEpisodePath, buildTrackPath, MediumEnum } from '@podverse/helpers';

import type { MediaPlayerInfoResolution } from '../../utils/mediaPlayer/mediaPlayerInfoResolution';
import { getMediaPlayerInfoResolution } from '../../utils/mediaPlayer/mediaPlayerInfoResolution';
import type { MediaPlayerSegmentStripSegment } from '../../utils/mediaPlayer/mediaPlayerSegmentStrip';
import { resolveMediaPlayerSegmentStripSegment } from '../../utils/mediaPlayer/mediaPlayerSegmentStrip';
import type { RemotePlayerDisplay } from './remotePlayerDisplay';
import type { RemotePlayerResource } from './remotePlayerResourceStore';

export type RemotePlayerInfo = {
  display: RemotePlayerDisplay;
  /** Same shape the local player computes, so the same markup renders both. */
  resolution: MediaPlayerInfoResolution;
  segment: MediaPlayerSegmentStripSegment | null;
};

/** Item page for a ref, from `medium` alone; '' when the ref alone cannot name it. */
export function remoteItemLinkUrlFromSummary(resource: DTOPlaybackResourceSummary): string {
  const ref = resource.ref;
  if (ref.kind !== 'item') {
    return '';
  }
  if (resource.medium === MediumEnum.Podcast || resource.medium === MediumEnum.Video) {
    return buildEpisodePath(ref.item_id_text);
  }
  if (resource.medium === MediumEnum.Music) {
    return buildTrackPath(ref.item_id_text);
  }
  return '';
}

export function resolveRemotePlayerInfo(params: {
  display: RemotePlayerDisplay;
  resource: RemotePlayerResource | null;
  positionSeconds: number | null;
}): RemotePlayerInfo {
  const { display, resource, positionSeconds } = params;
  const resolution = withSummaryTitleFallbacks(
    resolutionForResource(display.resource, resource, positionSeconds ?? 0),
    display.resource
  );
  const databaseResource = resource?.kind === 'database' ? resource : null;
  return {
    display,
    resolution,
    segment: display.state.is_live
      ? null
      : resolveMediaPlayerSegmentStripSegment({
          hasContent: true,
          mpClip: databaseResource?.clip ?? null,
          mpItemSoundbite: databaseResource?.itemSoundbite ?? null,
          subsectionTitle: resolution.subsectionTitle,
        }),
  };
}

/**
 * Titles from the shared summary until records resolve. `compactChannelLine` is the bar's
 * second line; with no artist yet it is the show title.
 */
function resolutionFromSummary(summary: DTOPlaybackResourceSummary): MediaPlayerInfoResolution {
  return {
    itemTitle: summary.title,
    displayItemTitle: summary.title,
    channelTitle: summary.channel_title,
    channelLinkUrl: '',
    itemLinkUrl: remoteItemLinkUrlFromSummary(summary),
    subsectionTitle: null,
    subsectionUrl: '',
    subsectionStartTime: null,
    subsectionEndTime: null,
    chapterWebUrl: null,
    resolvedLikeTarget: null,
    artistLine: { kind: 'hidden' },
    compactChannelLine: summary.channel_title,
  };
}

function resolutionForResource(
  summary: DTOPlaybackResourceSummary,
  resource: RemotePlayerResource | null,
  currentTimeSeconds: number
): MediaPlayerInfoResolution {
  if (resource === null) {
    return resolutionFromSummary(summary);
  }
  switch (resource.kind) {
    case 'database':
      return getMediaPlayerInfoResolution({
        mpChannel: resource.channel,
        mpItem: resource.item,
        mpAddByRSS: null,
        mpClip: resource.clip,
        mpItemSoundbite: resource.itemSoundbite,
        mpItemChapter: null,
        mpItemChapters: resource.itemChapters,
        currentTimeSeconds,
      });
    case 'add_by_rss':
      return getMediaPlayerInfoResolution({
        mpChannel: null,
        mpItem: null,
        mpAddByRSS: { idText: resource.idText, resourceData: resource.resourceData },
        mpClip: null,
        mpItemSoundbite: null,
        mpItemChapter: null,
        mpItemChapters: null,
        currentTimeSeconds,
      });
    default: {
      const _unhandled: never = resource;
      return _unhandled;
    }
  }
}

function withSummaryTitleFallbacks(
  resolution: MediaPlayerInfoResolution,
  summary: DTOPlaybackResourceSummary
): MediaPlayerInfoResolution {
  const itemTitle = resolution.itemTitle ?? summary.title;
  const channelTitle = resolution.channelTitle ?? summary.channel_title;
  const displayItemTitle = resolution.displayItemTitle ?? itemTitle;
  const compactChannelLine =
    resolution.compactChannelLine ?? (resolution.channelTitle === null ? channelTitle : null);
  return {
    ...resolution,
    itemTitle,
    displayItemTitle,
    channelTitle,
    compactChannelLine,
  };
}
