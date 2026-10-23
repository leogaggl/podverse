import { canonicalAddByRSSFeedUrl } from '@podverse/helpers-validation/client';
import { toAddByRSSResourceType } from '@podverse/parser-mapping';

import type {
  AddByRSSAlbumSource,
  AddByRSSFeedRecord,
  AddByRSSItemIndexItem,
  AddByRSSListedFeedRecord,
  AddByRSSLivestreamIndexItem,
  AddByRSSPublisherLinkRecord,
  AddByRSSResourceType,
} from './types';

const DB_NAME = 'add-by-rss';
/** Bump when object stores change; prior local cache may be reset on upgrade. */
const DB_VERSION = 8;
const FEEDS_STORE = 'feeds';
const ITEMS_STORE = 'items';
const ITEMS_META_STORE = 'itemsMeta';
const LIVE_ITEMS_STORE = 'liveItems';
const PUBLISHER_LINKS_STORE = 'publisherLinks';
const LISTED_FEEDS_STORE = 'listedFeeds';

const isIndexedDbAvailable = (): boolean =>
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const openAddByRSSDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(FEEDS_STORE)) {
        const store = db.createObjectStore(FEEDS_STORE, { keyPath: 'idText' });
        store.createIndex('feedUrl', 'feedUrl', { unique: true });
        store.createIndex('resourceType', 'resourceType', { unique: false });
      }

      // Create items store if it doesn't exist
      if (!db.objectStoreNames.contains(ITEMS_STORE)) {
        const store = db.createObjectStore(ITEMS_STORE, { keyPath: 'id' });
        store.createIndex('pubDateMs', 'pubDateMs', { unique: false });
        store.createIndex('itemGuid', 'itemGuid', { unique: false });
        store.createIndex('idText', 'idText', { unique: true });
        store.createIndex('mediumId', 'mediumId', { unique: false });
      }

      // Create items meta store if it doesn't exist
      if (!db.objectStoreNames.contains(ITEMS_META_STORE)) {
        db.createObjectStore(ITEMS_META_STORE, { keyPath: 'key' });
      }

      // Create live items store if it doesn't exist (v6)
      if (!db.objectStoreNames.contains(LIVE_ITEMS_STORE)) {
        const store = db.createObjectStore(LIVE_ITEMS_STORE, { keyPath: 'id' });
        store.createIndex('itemGuid', 'itemGuid', { unique: false });
        store.createIndex('idText', 'idText', { unique: true });
        store.createIndex('startTimeMs', 'startTimeMs', { unique: false });
      }

      if (!db.objectStoreNames.contains(PUBLISHER_LINKS_STORE)) {
        db.createObjectStore(PUBLISHER_LINKS_STORE, { keyPath: 'publisherFeedUrl' });
      }

      if (!db.objectStoreNames.contains(LISTED_FEEDS_STORE)) {
        const store = db.createObjectStore(LISTED_FEEDS_STORE, { keyPath: 'idText' });
        store.createIndex('feedUrl', 'feedUrl', { unique: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

let dbPromise: Promise<IDBDatabase> | null = null;

const getDb = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = openAddByRSSDb();
  }
  return dbPromise;
};

const withStore = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => Promise<T>
): Promise<T> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);

    handler(store)
      .then((result) => {
        tx.oncomplete = () => resolve(result);
      })
      .catch((error) => {
        tx.onabort = () => reject(error);
        tx.onerror = () => reject(error);
        tx.abort();
      });
  });
};

const withKnownResourceType = <T extends AddByRSSFeedRecord>(record: T): T => {
  const resourceType = toAddByRSSResourceType(record.resourceType);
  return resourceType === record.resourceType ? record : { ...record, resourceType };
};

export const getAllAddByRSSFeeds = async (): Promise<AddByRSSFeedRecord[]> => {
  if (!isIndexedDbAvailable()) {
    return [];
  }

  return withStore(FEEDS_STORE, 'readonly', async (store) => {
    const records = await requestToPromise(store.getAll());
    return records.map(withKnownResourceType);
  });
};

export const getAddByRSSFeedsByResourceType = async (
  resourceType: AddByRSSResourceType
): Promise<AddByRSSFeedRecord[]> => {
  if (!isIndexedDbAvailable()) {
    return [];
  }

  return (await getAllAddByRSSFeeds()).filter((feed) => feed.resourceType === resourceType);
};

export const getAddByRSSFeedByIdText = async (
  idText: string
): Promise<AddByRSSFeedRecord | null> => {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  return withStore(FEEDS_STORE, 'readonly', async (store) => {
    const record = await requestToPromise(store.get(idText));
    if (record === null || record === undefined) {
      return record;
    }
    return withKnownResourceType(record);
  });
};

export const getAddByRSSFeedByUrl = async (feedUrl: string): Promise<AddByRSSFeedRecord | null> => {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  return withStore(FEEDS_STORE, 'readonly', async (store) => {
    const index = store.index('feedUrl');
    const record = await requestToPromise(index.get(feedUrl));
    if (record === null || record === undefined) {
      return record;
    }
    return withKnownResourceType(record);
  });
};

export const upsertAddByRSSFeed = async (record: AddByRSSFeedRecord): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await withStore(FEEDS_STORE, 'readwrite', async (store) => {
    await requestToPromise(store.put(record));
  });
};

/**
 * Stores each record whose feed URL has no row yet and skips the rest. The lookup and the write
 * share one readwrite transaction, and the browser runs those one at a time per store across
 * tabs, so two syncs that both saw a feed as missing cannot both insert it.
 */
export const insertMissingAddByRSSFeeds = async (
  records: readonly AddByRSSFeedRecord[]
): Promise<void> => {
  if (!isIndexedDbAvailable() || records.length === 0) {
    return;
  }

  await withStore(FEEDS_STORE, 'readwrite', async (store) => {
    const index = store.index('feedUrl');
    for (const record of records) {
      const existingKey = await requestToPromise(index.getKey(record.feedUrl));
      if (existingKey !== undefined) {
        continue;
      }
      await requestToPromise(store.put(record));
    }
  });
};

export type AddByRSSFollowMetadataPatch = {
  feedUrl: string;
  title: string | null;
  imageUrl: string | null;
  requiresCredentials: boolean;
};

/**
 * Writes follow metadata onto the current stored row. An unparsed feed takes the follow's title
 * and artwork. A parsed feed keeps the title and artwork from its parse. Other fields stay as
 * they are on the row read in this write.
 */
export const patchAddByRSSFollowMetadata = async (
  patches: readonly AddByRSSFollowMetadataPatch[]
): Promise<string[]> => {
  if (!isIndexedDbAvailable() || patches.length === 0) {
    return [];
  }

  const changedFeedUrls: string[] = [];
  await withStore(FEEDS_STORE, 'readwrite', async (store) => {
    const index = store.index('feedUrl');
    for (const patch of patches) {
      const current = await requestToPromise<AddByRSSFeedRecord | undefined>(
        index.get(patch.feedUrl)
      );
      if (current === undefined) {
        continue;
      }
      const isUnparsed = current.mappedFeed === undefined;
      const title = isUnparsed ? (patch.title ?? current.title) : current.title;
      const imageUrl = isUnparsed ? (patch.imageUrl ?? current.imageUrl) : current.imageUrl;
      const requiresCredentials = patch.requiresCredentials;
      if (
        title === current.title &&
        imageUrl === current.imageUrl &&
        current.requiresCredentials === requiresCredentials
      ) {
        continue;
      }
      if (title !== current.title || imageUrl !== current.imageUrl) {
        changedFeedUrls.push(current.feedUrl);
      }
      const updated: AddByRSSFeedRecord = {
        ...current,
        title,
        imageUrl,
        requiresCredentials,
        updatedAt: new Date().toISOString(),
      };
      await requestToPromise(store.put(updated));
    }
  });
  return changedFeedUrls;
};

export const removeAddByRSSFeed = async (idText: string): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await withStore(FEEDS_STORE, 'readwrite', async (store) => {
    await requestToPromise(store.delete(idText));
  });
};

export const bulkRemoveAddByRSSFeeds = async (idTexts: string[]): Promise<void> => {
  if (!isIndexedDbAvailable() || idTexts.length === 0) {
    return;
  }

  await withStore(FEEDS_STORE, 'readwrite', async (store) => {
    for (const idText of idTexts) {
      await requestToPromise(store.delete(idText));
    }
  });
};

export const getAllAddByRSSPublisherLinks = async (): Promise<AddByRSSPublisherLinkRecord[]> => {
  if (!isIndexedDbAvailable()) {
    return [];
  }

  return withStore(PUBLISHER_LINKS_STORE, 'readonly', async (store) =>
    requestToPromise<AddByRSSPublisherLinkRecord[]>(store.getAll())
  );
};

export const getAddByRSSPublisherLink = async (
  publisherFeedUrl: string
): Promise<AddByRSSPublisherLinkRecord | null> => {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  return withStore(PUBLISHER_LINKS_STORE, 'readonly', async (store) => {
    const record = await requestToPromise<AddByRSSPublisherLinkRecord | undefined>(
      store.get(publisherFeedUrl)
    );
    return record ?? null;
  });
};

export const upsertAddByRSSPublisherLink = async (
  record: AddByRSSPublisherLinkRecord
): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await withStore(PUBLISHER_LINKS_STORE, 'readwrite', async (store) => {
    await requestToPromise(store.put(record));
  });
};

export const removeAddByRSSPublisherLinks = async (
  publisherFeedUrls: readonly string[]
): Promise<void> => {
  if (!isIndexedDbAvailable() || publisherFeedUrls.length === 0) {
    return;
  }

  await withStore(PUBLISHER_LINKS_STORE, 'readwrite', async (store) => {
    for (const publisherFeedUrl of publisherFeedUrls) {
      await requestToPromise(store.delete(publisherFeedUrl));
    }
  });
};

export const getAllListedAddByRSSFeeds = async (): Promise<AddByRSSListedFeedRecord[]> => {
  if (!isIndexedDbAvailable()) {
    return [];
  }

  return withStore(LISTED_FEEDS_STORE, 'readonly', async (store) => {
    const records = await requestToPromise<AddByRSSListedFeedRecord[]>(store.getAll());
    return records.map(withKnownResourceType);
  });
};

export const getListedAddByRSSFeedByIdText = async (
  idText: string
): Promise<AddByRSSListedFeedRecord | null> => {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  return withStore(LISTED_FEEDS_STORE, 'readonly', async (store) => {
    const record = await requestToPromise<AddByRSSListedFeedRecord | undefined>(store.get(idText));
    return record === undefined ? null : withKnownResourceType(record);
  });
};

export const getListedAddByRSSFeedByUrl = async (
  feedUrl: string
): Promise<AddByRSSListedFeedRecord | null> => {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  return withStore(LISTED_FEEDS_STORE, 'readonly', async (store) => {
    const index = store.index('feedUrl');
    const record = await requestToPromise<AddByRSSListedFeedRecord | undefined>(index.get(feedUrl));
    return record === undefined ? null : withKnownResourceType(record);
  });
};

export const upsertListedAddByRSSFeed = async (record: AddByRSSListedFeedRecord): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await withStore(LISTED_FEEDS_STORE, 'readwrite', async (store) => {
    await requestToPromise(store.put(record));
  });
};

export const bulkRemoveListedAddByRSSFeeds = async (idTexts: readonly string[]): Promise<void> => {
  if (!isIndexedDbAvailable() || idTexts.length === 0) {
    return;
  }

  await withStore(LISTED_FEEDS_STORE, 'readwrite', async (store) => {
    for (const idText of idTexts) {
      await requestToPromise(store.delete(idText));
    }
  });
};

/** The followed record with this `idText`, else the listed one. */
export const getAddByRSSAlbumSourceByIdText = async (
  idText: string
): Promise<AddByRSSAlbumSource | null> => {
  const followed = await getAddByRSSFeedByIdText(idText);
  if (followed) {
    return { followed: true, feed: followed };
  }
  const listed = await getListedAddByRSSFeedByIdText(idText);
  return listed ? { followed: false, feed: listed } : null;
};

const getAddByRSSAlbumSourceByExactUrl = async (
  feedUrl: string
): Promise<AddByRSSAlbumSource | null> => {
  const followed = await getAddByRSSFeedByUrl(feedUrl);
  if (followed) {
    return { followed: true, feed: followed };
  }
  const listed = await getListedAddByRSSFeedByUrl(feedUrl);
  return listed ? { followed: false, feed: listed } : null;
};

/**
 * The followed record for this feed URL, else the listed one. When neither store has the URL as
 * given, both are tried again with its canonical form.
 */
export const getAddByRSSAlbumSourceByUrl = async (
  feedUrl: string
): Promise<AddByRSSAlbumSource | null> => {
  const exact = await getAddByRSSAlbumSourceByExactUrl(feedUrl);
  if (exact) {
    return exact;
  }
  const canonical = canonicalAddByRSSFeedUrl(feedUrl);
  if (canonical === null || canonical === feedUrl) {
    return null;
  }
  return getAddByRSSAlbumSourceByExactUrl(canonical);
};

type IndexItemWithFeed = { channelIdText: string; feedUrl?: string };

/**
 * Index items stored before feed identity have no `feedUrl`; take it from the owning feed record
 * so they hash in the feed form.
 */
const withFeedUrls = async <T extends IndexItemWithFeed>(items: T[]): Promise<T[]> => {
  if (items.every((item) => item.feedUrl)) {
    return items;
  }
  const feeds = await getAllAddByRSSFeeds();
  const feedUrlByIdText = new Map(feeds.map((feed) => [feed.idText, feed.feedUrl]));
  return items.map((item) => {
    if (item.feedUrl) {
      return item;
    }
    const feedUrl = feedUrlByIdText.get(item.channelIdText);
    return feedUrl ? { ...item, feedUrl } : item;
  });
};

const withFeedUrl = async <T extends IndexItemWithFeed>(item: T | undefined): Promise<T | null> => {
  if (!item) {
    return null;
  }
  if (item.feedUrl) {
    return item;
  }
  const feed = await getAddByRSSFeedByIdText(item.channelIdText);
  return feed?.feedUrl ? { ...item, feedUrl: feed.feedUrl } : item;
};

export const clearAddByRSSItemsIndex = async (): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await withStore(ITEMS_STORE, 'readwrite', async (store) => {
    await requestToPromise(store.clear());
  });
};

export const clearAddByRSSLivestreamIndex = async (): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await withStore(LIVE_ITEMS_STORE, 'readwrite', async (store) => {
    await requestToPromise(store.clear());
  });
};

export const getAllAddByRSSItems = async (): Promise<AddByRSSItemIndexItem[]> => {
  if (!isIndexedDbAvailable()) {
    return [];
  }

  return withFeedUrls<AddByRSSItemIndexItem>(
    await withStore(ITEMS_STORE, 'readonly', async (store) => requestToPromise(store.getAll()))
  );
};

export const getAllAddByRSSLivestreamItems = async (): Promise<AddByRSSLivestreamIndexItem[]> => {
  if (!isIndexedDbAvailable()) {
    return [];
  }

  return withFeedUrls<AddByRSSLivestreamIndexItem>(
    await withStore(LIVE_ITEMS_STORE, 'readonly', async (store) => requestToPromise(store.getAll()))
  );
};

export const bulkUpsertAddByRSSItemsIndexItems = async (
  items: AddByRSSItemIndexItem[]
): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await withStore(ITEMS_STORE, 'readwrite', async (store) => {
    for (const item of items) {
      await requestToPromise(store.put(item));
    }
  });
};

export const bulkUpsertAddByRSSLivestreamIndexItems = async (
  items: AddByRSSLivestreamIndexItem[]
): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await withStore(LIVE_ITEMS_STORE, 'readwrite', async (store) => {
    for (const item of items) {
      await requestToPromise(store.put(item));
    }
  });
};

export const getAddByRSSItemsIndexCount = async (): Promise<number> => {
  if (!isIndexedDbAvailable()) {
    return 0;
  }

  return withStore(ITEMS_STORE, 'readonly', async (store) => requestToPromise(store.count()));
};

export const getAddByRSSItemByGuid = async (
  itemGuid: string
): Promise<AddByRSSItemIndexItem | null> => {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  return withFeedUrl<AddByRSSItemIndexItem>(
    await withStore(ITEMS_STORE, 'readonly', async (store) => {
      const index = store.index('itemGuid');
      return requestToPromise(index.get(itemGuid));
    })
  );
};

export const getAddByRSSLivestreamByGuid = async (
  itemGuid: string
): Promise<AddByRSSLivestreamIndexItem | null> => {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  return withFeedUrl<AddByRSSLivestreamIndexItem>(
    await withStore(LIVE_ITEMS_STORE, 'readonly', async (store) => {
      const index = store.index('itemGuid');
      return requestToPromise(index.get(itemGuid));
    })
  );
};

export const getAddByRSSItemByIdText = async (
  idText: string
): Promise<AddByRSSItemIndexItem | null> => {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  return withFeedUrl<AddByRSSItemIndexItem>(
    await withStore(ITEMS_STORE, 'readonly', async (store) => {
      const index = store.index('idText');
      return requestToPromise(index.get(idText));
    })
  );
};

export const getAddByRSSLivestreamByIdText = async (
  idText: string
): Promise<AddByRSSLivestreamIndexItem | null> => {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  return withFeedUrl<AddByRSSLivestreamIndexItem>(
    await withStore(LIVE_ITEMS_STORE, 'readonly', async (store) => {
      const index = store.index('idText');
      return requestToPromise(index.get(idText));
    })
  );
};

export const getAddByRSSItemById = async (id: string): Promise<AddByRSSItemIndexItem | null> => {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  return withFeedUrl<AddByRSSItemIndexItem>(
    await withStore(ITEMS_STORE, 'readonly', async (store) => {
      return requestToPromise(store.get(id));
    })
  );
};

export const getAddByRSSItemsIndexPage = async (params: {
  sort: 'recent' | 'oldest';
  page: number;
  pageSize: number;
}): Promise<{ items: AddByRSSItemIndexItem[]; totalCount: number }> => {
  if (!isIndexedDbAvailable()) {
    return { items: [], totalCount: 0 };
  }

  const totalCount = await getAddByRSSItemsIndexCount();
  if (totalCount === 0) {
    return { items: [], totalCount };
  }

  const offset = Math.max(0, (params.page - 1) * params.pageSize);
  const items: AddByRSSItemIndexItem[] = [];
  const direction: IDBCursorDirection = params.sort === 'recent' ? 'prev' : 'next';

  await withStore(ITEMS_STORE, 'readonly', async (store) => {
    const index = store.index('pubDateMs');
    await new Promise<void>((resolve, reject) => {
      let skipped = 0;
      const request = index.openCursor(null, direction);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        if (skipped < offset) {
          skipped += 1;
          cursor.continue();
          return;
        }
        if (items.length < params.pageSize) {
          items.push(cursor.value as AddByRSSItemIndexItem);
          cursor.continue();
          return;
        }
        resolve();
      };
    });
    return items;
  });

  return { items: await withFeedUrls(items), totalCount };
};

export const getAddByRSSItemsIndexMeta = async <T = unknown>(key: string): Promise<T | null> => {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  return withStore(ITEMS_META_STORE, 'readonly', async (store) => {
    return requestToPromise(store.get(key));
  });
};

export const setAddByRSSItemsIndexMeta = async (record: {
  key: string;
  [key: string]: unknown;
}): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    return;
  }

  await withStore(ITEMS_META_STORE, 'readwrite', async (store) => {
    await requestToPromise(store.put(record));
  });
};
