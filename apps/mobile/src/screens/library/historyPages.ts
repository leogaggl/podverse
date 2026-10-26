import type { DTOQueueResource } from '@podverse/helpers/dto';

import { appendUniqueBy, fullPageHasMore } from '../../lib/pagination/pagedList';

export type HistoryPagesRead = {
  hasMore: boolean;
  pagesRead: number;
  resources: DTOQueueResource[];
};

const historyResourceKey = (resource: DTOQueueResource): string => String(resource.id);

/**
 * Read history pages 1 through `pageCount` (at least page 1) one after another, stopping after a
 * short page. A resource repeated across pages keeps its first position. A rejected page rejects
 * the whole read.
 */
export const readHistoryPages = async (
  fetchPage: (page: number) => Promise<DTOQueueResource[]>,
  pageCount: number
): Promise<HistoryPagesRead> => {
  const lastPage = Math.max(1, pageCount);
  let resources: DTOQueueResource[] = [];
  let pagesRead = 0;
  let hasMore = false;

  for (let page = 1; page <= lastPage; page += 1) {
    const pageResources = await fetchPage(page);
    resources = appendUniqueBy(resources, pageResources, historyResourceKey);
    pagesRead = page;
    hasMore = fullPageHasMore(pageResources.length);
    if (!hasMore) {
      break;
    }
  }

  return { hasMore, pagesRead, resources };
};
