import type { LiveItemStatusEnum } from '@podverse/helpers';
import { DATABASE_CONSTANTS, getLiveItemStatusEnumValue } from '@podverse/helpers';
import { isValidHttpUrl } from '@podverse/helpers-validation';

import type { Phase4PodcastLiveItem } from '../../types/partytime.js';

export type CompatLiveItemDto = {
  liveItem: {
    live_item_status: LiveItemStatusEnum;
    start_time: Date;
    end_time: Date | null;
    chat_web_url: string | null;
  };
  item: Phase4PodcastLiveItem;
};

function getChatWebUrl(chat: Phase4PodcastLiveItem['chat']): string | null {
  if (!chat) return null;
  const chatUrl = 'url' in chat ? chat.url : chat.embedUrl;
  return chatUrl && isValidHttpUrl(chatUrl)
    ? chatUrl.slice(0, DATABASE_CONSTANTS.varchar_url)
    : null;
}

export const compatLiveItemsDtos = (parsedLiveItems: Phase4PodcastLiveItem[]) => {
  const dtos: CompatLiveItemDto[] = [];
  for (const parsedLiveItem of parsedLiveItems) {
    const liveItemStatus = getLiveItemStatusEnumValue(parsedLiveItem.status ?? null);
    if (liveItemStatus === null) {
      continue;
    }

    dtos.push({
      liveItem: {
        live_item_status: liveItemStatus,
        start_time: parsedLiveItem.start,
        end_time: parsedLiveItem.end || null,
        chat_web_url: getChatWebUrl(parsedLiveItem.chat),
      },
      item: parsedLiveItem,
    });
  }

  return dtos;
};
