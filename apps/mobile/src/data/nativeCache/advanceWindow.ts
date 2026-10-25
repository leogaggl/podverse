/**
 * The native advance window: the play order after the playing item, as the app would play it.
 * The manual queue for the playing medium comes first, then up to
 * {@link NATIVE_ADVANCE_WINDOW_AUTO_ROWS} automatic rows the app already resolved: auto-queue rows
 * for a regular item, or the next feed episodes for an Add by RSS episode. Native steps through it
 * while JS is not running. It is a prefix of the in-app order: a row native cannot play as given
 * ends it, and nothing is skipped.
 */

import type { AddByRSSResourceData, DTOQueueResource } from '@podverse/helpers/dto';
import type { PlaybackTarget } from '@podverse/playback-core';
import { selectAddByRSSAdjacentIdTexts } from '@podverse/playback-core/addByRSSListWalk';
import type { AutoQueueResourcesMap } from '@podverse/playback-core/autoQueue';
import {
  autoQueueSeedFromPlaybackTarget,
  selectAutoQueueRowsAhead,
} from '@podverse/playback-core/autoQueue';

import { resolveLocalAddByRssResourceData } from '../../lib/addByRss/localResourceData';
import {
  hasUrlUserinfo,
  isAddByRssResourceData,
  resolveAddByRssPlaybackUrl,
} from '../../lib/addByRss/playbackUrl';
import {
  addByRssPlaybackMediaId,
  isAddByRssLivestreamResourceData,
} from '../../lib/addByRss/resourceData';
import { playbackTargetRowMediaId } from '../../lib/playback/buildPlaybackTarget';
import {
  engineSourceIdentityFromTarget,
  queueMediumFromTarget,
} from '../../lib/playback/mediaEngineSourceMeta';
import {
  addByRssFeedUrlForTarget,
  createAddByRssPlainUrlCheck,
} from '../../playback/addByRssMediaAuth';
import type { AddByRssFeedWalkState } from '../../playback/useAddByRssFeedWalk';
import { addByRssRepository } from '../repositories/addByRssRepository';
import type {
  ItemPlaybackProgress,
  ItemProgressLookup,
} from '../repositories/queueProjectionHelpers';
import {
  readAddByRssProgressForProjection,
  readCachedQueueIds,
  readQueueCachesForProjection,
} from '../repositories/queueProjectionHelpers';
import { completeDownloadMap, readAccountIdText, readProgressLookup } from './carCacheReproject';
import type { AdvanceWindowProjection, NativeCacheQueueEntry } from './projection';
import {
  autoQueueRowFromQueueResource,
  nativeAdvanceIdentityKey,
  nativeQueueEntryFromAddByRss,
  nativeQueueEntryFromAutoQueueRow,
  nativeResumeSeconds,
  positiveSecondsOrNull,
} from './queueEntryMapping';

/** Automatic rows the window carries past the manual queue. */
export const NATIVE_ADVANCE_WINDOW_AUTO_ROWS = 10;

export type AdvanceWindowAutoQueueState = {
  resources: AutoQueueResourcesMap;
  activeRow: number;
  disabled: boolean;
};

/** An Add by RSS episode the composer already resolved; `mediaUrl` is null when unsafe to write. */
export type AdvanceWindowAddByRssMedia = {
  resourceData: AddByRSSResourceData;
  mediaUrl: string | null;
  downloadFileName: string | null;
  startPositionSeconds: number | null;
};

export type AdvanceWindowManualRow =
  | { kind: 'resource'; resource: DTOQueueResource }
  | { kind: 'add-by-rss'; media: AdvanceWindowAddByRssMedia };

const emptyWindow = (
  mediumBucket: AdvanceWindowProjection['mediumBucket']
): AdvanceWindowProjection => ({
  mediumBucket,
  anchorIdText: null,
  anchorKind: null,
  entries: [],
});

/** Entries in order up to the first row that maps to null, and whether one did. */
const takeUntilNull = <T>(
  rows: readonly T[],
  toEntry: (row: T) => NativeCacheQueueEntry | null
): { entries: NativeCacheQueueEntry[]; ended: boolean } => {
  const entries: NativeCacheQueueEntry[] = [];
  for (const row of rows) {
    const entry = toEntry(row);
    if (entry === null) {
      return { entries, ended: true };
    }
    entries.push(entry);
  }
  return { entries, ended: false };
};

/** The advance window for the playing target, from inputs the composer already read. Pure. */
export function buildAdvanceWindow(input: {
  target: PlaybackTarget | null;
  manual: AdvanceWindowManualRow[];
  autoQueue: AdvanceWindowAutoQueueState;
  addByRssAhead: AdvanceWindowAddByRssMedia[];
  downloadFileNameFor: (itemIdText: string) => string | null;
  progressFor: ItemProgressLookup;
}): AdvanceWindowProjection {
  const { target, downloadFileNameFor } = input;
  if (target === null) {
    return emptyWindow('av');
  }
  const mediumBucket = queueMediumFromTarget(target);
  const anchor = engineSourceIdentityFromTarget(target);
  if (anchor === null) {
    return emptyWindow(mediumBucket);
  }

  const manual = takeUntilNull(input.manual, (row) =>
    row.kind === 'resource'
      ? nativeQueueEntryFromAutoQueueRow(autoQueueRowFromQueueResource(row.resource), {
          downloadFileNameFor,
          startPositionSeconds: positiveSecondsOrNull(row.resource.playback_position),
          mediaFileDuration: row.resource.media_file_duration,
        })
      : nativeQueueEntryFromAddByRss(row.media)
  );

  const automatic = ((): NativeCacheQueueEntry[] => {
    if (manual.ended) {
      return [];
    }
    if (autoQueueSeedFromPlaybackTarget(target) !== null) {
      if (input.autoQueue.disabled) {
        return [];
      }
      const rows = selectAutoQueueRowsAhead(
        input.autoQueue.resources,
        input.autoQueue.activeRow,
        NATIVE_ADVANCE_WINDOW_AUTO_ROWS
      );
      return takeUntilNull(rows, (row) =>
        nativeQueueEntryFromAutoQueueRow(row, {
          downloadFileNameFor,
          startPositionSeconds:
            row.item === null || row.item === undefined
              ? null
              : nativeResumeSeconds(input.progressFor(row.item)),
        })
      ).entries;
    }
    if (target.kind === 'add-by-rss' && !isAddByRssLivestreamResourceData(target.resourceData)) {
      return takeUntilNull(
        input.addByRssAhead.slice(0, NATIVE_ADVANCE_WINDOW_AUTO_ROWS),
        nativeQueueEntryFromAddByRss
      ).entries;
    }
    return [];
  })();

  // A row in both parts plays once, at its manual position.
  const seen = new Set<string>([nativeAdvanceIdentityKey(anchor)]);
  const entries: NativeCacheQueueEntry[] = [];
  for (const entry of [...manual.entries, ...automatic]) {
    const key = nativeAdvanceIdentityKey({ kind: entry.kind ?? 'item', idText: entry.idText });
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    entries.push(entry);
  }

  return { mediumBucket, anchorIdText: anchor.idText, anchorKind: anchor.kind, entries };
}

export type AdvanceWindowComposition = {
  projection: AdvanceWindowProjection;
  /** Feed URL of each Add by RSS entry in the window, by its `idText`. Never written to native. */
  addByRssFeedUrls: ReadonlyMap<string, string>;
};

const readManualUpcoming = async (target: PlaybackTarget): Promise<DTOQueueResource[]> => {
  const { avQueueIdText, musicQueueIdText } = await readCachedQueueIds();
  const queueIdText = queueMediumFromTarget(target) === 'music' ? musicQueueIdText : avQueueIdText;
  if (queueIdText === null) {
    return [];
  }
  return (await readQueueCachesForProjection(queueIdText)).upcoming;
};

const readAddByRssProgressLookup = async (): Promise<
  (mediaId: string) => ItemPlaybackProgress | null
> => {
  try {
    return await readAddByRssProgressForProjection(await readAccountIdText());
  } catch {
    return () => null;
  }
};

/**
 * Read the stores the window needs and build it. Reads only, never the network. Feed URLs stay
 * in JS: each Add by RSS entry is written with a remote URL only when the app would load that URL
 * without the feed's credentials.
 */
export async function composeAdvanceWindow(input: {
  target: PlaybackTarget | null;
  autoQueue: AdvanceWindowAutoQueueState;
  addByRssFeedWalk: AddByRssFeedWalkState | null;
}): Promise<AdvanceWindowComposition> {
  const { target, autoQueue, addByRssFeedWalk } = input;
  const addByRssFeedUrls = new Map<string, string>();
  if (target === null) {
    return {
      addByRssFeedUrls,
      projection: buildAdvanceWindow({
        addByRssAhead: [],
        autoQueue,
        downloadFileNameFor: () => null,
        manual: [],
        progressFor: () => null,
        target: null,
      }),
    };
  }

  const [upcoming, downloadById, progressFor, addByRssProgressFor] = await Promise.all([
    readManualUpcoming(target),
    completeDownloadMap(),
    readProgressLookup(),
    readAddByRssProgressLookup(),
  ]);
  const downloadFileNameFor = (itemIdText: string): string | null =>
    downloadById.get(itemIdText) ?? null;

  const plainUrlChecks = new Map<string, Promise<(mediaUrl: string) => boolean>>();
  const isPlainUrl = async (feedUrl: string | null, url: string): Promise<boolean> => {
    if (feedUrl === null) {
      return true;
    }
    const check = plainUrlChecks.get(feedUrl) ?? createAddByRssPlainUrlCheck(feedUrl);
    plainUrlChecks.set(feedUrl, check);
    return (await check)(url);
  };

  const toAddByRssMedia = async (
    resourceData: AddByRSSResourceData,
    downloadFileName: string | null,
    startPositionSeconds: number | null
  ): Promise<AdvanceWindowAddByRssMedia> => {
    const feedUrl = await addByRssFeedUrlForTarget({ kind: 'add-by-rss', resourceData });
    if (feedUrl !== null) {
      addByRssFeedUrls.set(addByRssPlaybackMediaId(resourceData), feedUrl);
    }
    const url = resolveAddByRssPlaybackUrl(resourceData);
    const mediaUrl =
      url !== null && !hasUrlUserinfo(url) && (await isPlainUrl(feedUrl, url)) ? url : null;
    return { downloadFileName, mediaUrl, resourceData, startPositionSeconds };
  };

  const manual: AdvanceWindowManualRow[] = [];
  for (const resource of upcoming) {
    if (isAddByRssResourceData(resource.add_by_rss_resource_data)) {
      const resourceData = await resolveLocalAddByRssResourceData(
        resource.add_by_rss_resource_data,
        addByRssRepository
      );
      manual.push({
        kind: 'add-by-rss',
        media: await toAddByRssMedia(
          resourceData,
          null,
          positiveSecondsOrNull(resource.playback_position)
        ),
      });
    } else {
      manual.push({ kind: 'resource', resource });
    }
  }

  const addByRssAhead: AdvanceWindowAddByRssMedia[] = [];
  if (target.kind === 'add-by-rss') {
    const anchorFeedUrl = await addByRssFeedUrlForTarget(target);
    if (anchorFeedUrl !== null) {
      addByRssFeedUrls.set(addByRssPlaybackMediaId(target.resourceData), anchorFeedUrl);
    }
    const walk = addByRssFeedWalk?.walk;
    if (
      !isAddByRssLivestreamResourceData(target.resourceData) &&
      addByRssFeedWalk?.mediaId === playbackTargetRowMediaId(target) &&
      walk !== undefined &&
      walk.context !== null
    ) {
      const idTexts = selectAddByRSSAdjacentIdTexts(
        walk.context,
        'next',
        NATIVE_ADVANCE_WINDOW_AUTO_ROWS
      );
      for (const idText of idTexts) {
        const entry = walk.entries.get(idText);
        if (entry === undefined) {
          break;
        }
        const downloadFileName =
          entry.localDownloadItemIdText === undefined
            ? null
            : (downloadById.get(entry.localDownloadItemIdText) ?? null);
        addByRssAhead.push(
          await toAddByRssMedia(
            entry.resourceData,
            downloadFileName,
            nativeResumeSeconds(addByRssProgressFor(entry.idText))
          )
        );
      }
    }
  }

  return {
    addByRssFeedUrls,
    projection: buildAdvanceWindow({
      addByRssAhead,
      autoQueue,
      downloadFileNameFor,
      manual,
      progressFor,
      target,
    }),
  };
}
