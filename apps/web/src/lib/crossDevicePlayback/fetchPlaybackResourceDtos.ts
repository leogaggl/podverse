import type {
  DTOChannel,
  DTOClip,
  DTOItem,
  DTOItemSoundbite,
  DTOPlaybackResourceRef,
} from '@podverse/helpers';

import { getApiRequestService } from '../../factories/apiRequestService';

export type PlaybackResourceDtos = {
  channel: DTOChannel;
  item: DTOItem;
  clip: DTOClip | null;
  itemSoundbite: DTOItemSoundbite | null;
};

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function idTextOf(value: { id_text?: string | null } | null | undefined): string | null {
  if (!isPresent(value) || typeof value.id_text !== 'string' || value.id_text === '') {
    return null;
  }
  return value.id_text;
}

async function fetchItemAndChannel(
  itemIdText: string
): Promise<{ item: DTOItem; channel: DTOChannel } | null> {
  const apiRequestService = getApiRequestService();
  const item = await apiRequestService.reqItemGetByIdOrIdText(itemIdText);
  if (!isPresent(item)) {
    return null;
  }
  const channel = await apiRequestService.reqChannelGetByIdOrIdText(item.channel_id);
  if (!isPresent(channel)) {
    return null;
  }
  return { item, channel };
}

/**
 * Channel and item records (plus the clip or official clip) for a database ref; null for an Add
 * by RSS ref or when any request returns nothing. Request errors propagate.
 */
export async function fetchPlaybackResourceDtos(
  ref: DTOPlaybackResourceRef
): Promise<PlaybackResourceDtos | null> {
  switch (ref.kind) {
    case 'add_by_rss':
      return null;
    case 'item': {
      const loaded = await fetchItemAndChannel(ref.item_id_text);
      if (loaded === null) {
        return null;
      }
      return {
        channel: loaded.channel,
        item: loaded.item,
        clip: null,
        itemSoundbite: null,
      };
    }
    case 'clip': {
      const clip = await getApiRequestService().reqClipGet(ref.clip_id_text);
      const clipItemIdText = idTextOf(clip?.item);
      if (!isPresent(clip) || clipItemIdText === null) {
        return null;
      }
      const loaded = await fetchItemAndChannel(clipItemIdText);
      if (loaded === null) {
        return null;
      }
      return {
        channel: loaded.channel,
        item: loaded.item,
        clip,
        itemSoundbite: null,
      };
    }
    case 'soundbite': {
      const soundbite = await getApiRequestService().reqItemSoundbiteGet(
        ref.item_soundbite_id_text
      );
      const soundbiteItemIdText = idTextOf(soundbite?.item);
      if (!isPresent(soundbite) || soundbiteItemIdText === null) {
        return null;
      }
      const loaded = await fetchItemAndChannel(soundbiteItemIdText);
      if (loaded === null) {
        return null;
      }
      return {
        channel: loaded.channel,
        item: loaded.item,
        clip: null,
        itemSoundbite: soundbite,
      };
    }
    default: {
      const _unhandled: never = ref;
      void _unhandled;
      return null;
    }
  }
}
