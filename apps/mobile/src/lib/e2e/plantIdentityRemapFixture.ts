import { getDb, initializeDatabase, schema } from '../../data/db';
import { rememberChannelSubscribed } from '../../data/repositories/channelActionChromeRepository';
import { downloadsRepository } from '../../data/repositories/downloadsRepository';
import {
  E2E_IDENTITY_REMAP_FILE_PATH,
  E2E_MERGED_OLD_CHANNEL_ID_TEXT,
  E2E_MERGED_OLD_ITEM_ID_TEXT,
} from './e2eSeedConstants';

const OLD_TITLE = 'E2E Merged Podcast';

/** Signed-out follow plus a finished download for the absorbed show. */
export const plantIdentityRemapFixture = async (): Promise<void> => {
  await initializeDatabase();
  const now = Date.now();
  await getDb()
    .insert(schema.subscribedChannel)
    .values({
      idText: E2E_MERGED_OLD_CHANNEL_ID_TEXT,
      imageUrl: null,
      kind: 'podcasts',
      medium: 'podcasts',
      popularityRank: null,
      source: 'directory',
      title: OLD_TITLE,
      updatedAt: now,
    })
    .onConflictDoNothing();
  rememberChannelSubscribed(E2E_MERGED_OLD_CHANNEL_ID_TEXT, true);
  await downloadsRepository.upsert({
    artworkUrl: null,
    byteSize: 128,
    bytesDownloaded: 128,
    channelIdText: E2E_MERGED_OLD_CHANNEL_ID_TEXT,
    channelTitle: OLD_TITLE,
    createdAt: now,
    dismissedFromList: false,
    enclosureMime: 'audio/mpeg',
    enclosureUri: 'https://e2e.example/identity-remap.mp3',
    enclosureUrlHash: 'e2e-identity-remap',
    errorReason: null,
    fileExtension: 'mp3',
    filePath: E2E_IDENTITY_REMAP_FILE_PATH,
    itemIdText: E2E_MERGED_OLD_ITEM_ID_TEXT,
    mediaType: 'audio',
    status: 'complete',
    title: 'E2E Merged Episode',
    updatedAt: now,
  });
};
