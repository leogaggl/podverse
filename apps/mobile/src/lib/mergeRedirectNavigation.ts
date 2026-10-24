import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { DTOChannel, DTOItem } from '@podverse/helpers';
import { primaryChannelListArtworkUrl, primaryListArtworkUrl } from '@podverse/helpers';

import type { ChannelBrowseStackParamList } from '../navigation';
import { buildAlbumDetailParams } from '../navigation/albumDetailParams';
import { buildArtistDetailParams } from '../navigation/artistDetailParams';
import { buildPodcastDetailParams } from '../navigation/podcastDetailParams';
import { buildTrackDetailParams } from '../navigation/trackDetailParams';
import type { MergedDetailTarget, MergedInto } from './mergeRedirect';
import {
  mergedChannelDetailTarget,
  mergedItemDetailTarget,
  readMergedIntoRedirect,
} from './mergeRedirect';

/** A chain of absorbs is followed this many times, then the screen stays and shows its own error. */
const MERGE_REDIRECT_HOP_LIMIT = 4;

type MergeRedirectNavigation = NativeStackNavigationProp<ChannelBrowseStackParamList>;

const replaceMergedDetail = (
  navigation: MergeRedirectNavigation,
  target: MergedDetailTarget
): void => {
  const previewImageUrl = target.imageUrl;
  const previewTitle = target.title;
  if (target.screen === 'ArtistDetail') {
    navigation.replace(
      'ArtistDetail',
      buildArtistDetailParams({
        artistId: target.idText,
        previewImageUrl,
        previewTitle,
      })
    );
    return;
  }
  if (target.screen === 'AlbumDetail') {
    navigation.replace(
      'AlbumDetail',
      buildAlbumDetailParams({
        albumId: target.idText,
        previewImageUrl,
        previewTitle,
      })
    );
    return;
  }
  if (target.screen === 'PodcastDetail') {
    navigation.replace(
      'PodcastDetail',
      buildPodcastDetailParams({
        podcastId: target.idText,
        previewImageUrl,
        previewTitle,
      })
    );
    return;
  }
  if (target.screen === 'TrackDetail') {
    navigation.replace(
      'TrackDetail',
      buildTrackDetailParams({
        previewImageUrl,
        previewTitle,
        trackId: target.idText,
      })
    );
    return;
  }
  navigation.replace('EpisodeDetail', { episodeId: target.idText });
};

const followMerged = async <T>(
  startIdText: string,
  kind: MergedInto['kind'],
  load: (idText: string) => Promise<T>
): Promise<T | null> => {
  const seen = new Set<string>();
  let idText = startIdText;
  for (let hop = 0; hop < MERGE_REDIRECT_HOP_LIMIT; hop += 1) {
    if (seen.has(idText)) {
      return null;
    }
    seen.add(idText);
    try {
      return await load(idText);
    } catch (error) {
      const merged = readMergedIntoRedirect(error);
      if (merged === null || merged.kind !== kind) {
        return null;
      }
      idText = merged.idText;
    }
  }
  return null;
};

/**
 * An absorbed show or episode answers 410 with the surviving id. Replace this screen with that
 * survivor on the same tab stack. A repeat of the id already on screen, or a 410 that does not
 * name a survivor, leaves the screen to show its own error.
 */
export const replaceScreenIfMerged = async (input: {
  currentIdText: string;
  error: unknown;
  loadChannel: (idText: string) => Promise<DTOChannel>;
  loadItem: (idText: string) => Promise<DTOItem>;
  navigation: MergeRedirectNavigation;
}): Promise<boolean> => {
  const merged = readMergedIntoRedirect(input.error);
  if (merged === null || merged.idText === input.currentIdText) {
    return false;
  }

  if (merged.kind === 'channel') {
    const channel = await followMerged(merged.idText, 'channel', input.loadChannel);
    if (channel === null || channel.id_text === input.currentIdText) {
      return false;
    }
    replaceMergedDetail(
      input.navigation,
      mergedChannelDetailTarget({
        idText: channel.id_text,
        imageUrl: primaryChannelListArtworkUrl(channel.channel_images),
        mediumId: channel.medium_id,
        title: channel.title,
      })
    );
    return true;
  }

  const item = await followMerged(merged.idText, 'item', input.loadItem);
  if (item === null || item.id_text === input.currentIdText) {
    return false;
  }
  let mediumId = item.channel?.medium_id ?? null;
  let channelImages = item.channel?.channel_images;
  if (mediumId === null) {
    const channel = await followMerged(String(item.channel_id), 'channel', input.loadChannel);
    if (channel !== null) {
      mediumId = channel.medium_id;
      channelImages = channel.channel_images;
    }
  }
  replaceMergedDetail(
    input.navigation,
    mergedItemDetailTarget({
      idText: item.id_text,
      imageUrl: primaryListArtworkUrl(item.item_images, channelImages),
      mediumId,
      title: item.title ?? null,
    })
  );
  return true;
};
