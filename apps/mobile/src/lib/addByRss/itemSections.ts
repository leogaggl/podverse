import type { DTOItemChapter } from '@podverse/helpers';
import type {
  AddByRSSChapterResponse,
  ReqAccountAddByRSSChaptersTranscriptParams,
} from '@podverse/helpers-requests';
import type { AddByRSSMappedFeed } from '@podverse/parser-mapping';
import {
  getChaptersAndTranscriptUrls,
  mapAddByRSSChaptersToDTOItemChapters,
} from '@podverse/parser-mapping';

import type { AddByRssCredentials } from './credentials';

/** Chapters and transcript text for one Add by RSS item, as its episode page shows them. */
export type AddByRssItemSections = {
  chapters: DTOItemChapter[];
  transcriptText: string;
};

export type AddByRssItemSectionUrls = {
  chaptersFeedUrl: string | undefined;
  transcriptUrl: string | undefined;
};

/** Chapters and transcript URLs the parsed item links, or null when it links neither. */
export const addByRssItemSectionUrls = (
  itemBundle: AddByRSSMappedFeed['items'][number]
): AddByRssItemSectionUrls | null => {
  const urls = getChaptersAndTranscriptUrls(itemBundle);
  if (urls.chaptersFeedUrl === undefined && urls.transcriptUrl === undefined) {
    return null;
  }
  return urls;
};

/** Request body for the chapters-transcript endpoint; credentials ride only when given. */
export const buildAddByRssItemSectionsRequest = (input: {
  credentials: AddByRssCredentials | null;
  feedUrl: string;
  itemIdText: string;
  urls: AddByRssItemSectionUrls;
}): ReqAccountAddByRSSChaptersTranscriptParams => ({
  itemIdText: input.itemIdText,
  feedUrl: input.feedUrl,
  ...(input.urls.chaptersFeedUrl !== undefined
    ? { chaptersFeedUrl: input.urls.chaptersFeedUrl }
    : {}),
  ...(input.urls.transcriptUrl !== undefined ? { transcriptUrl: input.urls.transcriptUrl } : {}),
  ...(input.credentials !== null
    ? {
        basic_auth_password: input.credentials.password,
        basic_auth_username: input.credentials.username,
      }
    : {}),
});

/** Maps the endpoint's answer; table-of-contents-suppressed chapters are dropped. */
export const toAddByRssItemSections = (response: {
  chapters: AddByRSSChapterResponse[];
  transcriptText?: string;
}): AddByRssItemSections => ({
  chapters: mapAddByRSSChaptersToDTOItemChapters(response.chapters).filter(
    (chapter) => chapter.table_of_contents !== false
  ),
  transcriptText: response.transcriptText ?? '',
});
