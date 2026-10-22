# 37 — Add by RSS music feeds are music on mobile; shared track header

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

Rows: R65 (groundwork) and R69. R24 and R54 need a feed the phone knows is music. Mobile only.

Runs after `32-item-detail-header.md` (`itemDetailDateLabel`) and before
`38-add-by-rss-track-detail.md`, which renders the shared header. Plan 88 (R62) removes
`'livestreams'` from mobile `isResourceType` in `addByRssRepository.ts`; never run that plan and
this one in one phase.

## Why

**Mobile never stores a music resource type.** Web sets a feed's type from the parsed medium
(`getAddByRSSResourceTypeFromMappedFeed` in `AddByRSSAddFeedPageClient.tsx` and
`AddByRSSCredentialsPageClient.tsx`). Mobile hard-codes `resourceType: 'podcasts'` in all three
record builders in `src/lib/addByRss/domain.ts` (`mergeLocalAndRemoteAddByRssFeeds`,
`localFeedForServerFollow`, `buildAddByRssFeedRecord`). So no mobile feed is music:
`isAddByRssMusicFeed` (plan 20) is never true, the Library's Artists, Albums, and Tracks chips
stay empty, and Home's Tracks chip gets no Add by RSS rows (plan 41). The operator's answer is
that a feed stays on its medium's chips, "regular and Add by RSS" (`00-REQUEST.md`, livestreams
flag answer). Track rows with Go to Track (R65) need this first.

**The track page header is private.** `TrackPlayChrome` in
`src/screens/track/TrackDetailScreen.tsx` takes a catalog `DTOItem`. Plan 38's Add by RSS track
must look identical. That header differs from plan 32's `ItemDetailHeader`: the album link is
accent-colored `typography.label` (muted when not pressable), the root has `marginTop: md`, there
is no artwork viewer, and the play bar ids are `track-detail-*`, not `home-row-*`. Split it the
way plan 32 split `EpisodePlayChrome`.

## Locked decisions

1. **The parsed medium sets the type.** Each time `upsertFeed` stores a non-null bundle, it
   stores `getAddByRSSResourceTypeFromMappedFeed(mappedFeed)` (`@podverse/parser-mapping`) as
   `resource_type`: `'artists'`, `'albums'`, or `'podcasts'`, the same values web stores.
2. **Nothing else overwrites it.** A follow-list merge and a record built from a preview keep
   the stored type (`localFeed?.resourceType ?? 'podcasts'`). A new follow with no parse yet is
   `'podcasts'`, as today.
3. **Existing rows are retyped once, locally, when this build first opens the database (R69).**
   The stored bundle is `mapped_feed_json`, an `AddByRSSMappedFeed`. Its medium is
   `channel.channel.medium_id` (`compatChannelDto` always writes that number;
   `getMappedFeedByUrl` reads it back). The pass calls `getAddByRSSResourceTypeFromMappedFeed`
   and writes `resource_type` when the result differs. No network request. A null or unreadable
   bundle keeps its stored type. A follow with no parse yet stays `'podcasts'` until
   `upsertFeed` stores a bundle (decision 2). Lapsed and signed-out phones are included.
4. **New component** `src/components/content/TrackDetailHeader.tsx`, exported from
   `src/components/content/index.ts`. It owns the layout, styles, and testIDs `TrackPlayChrome`
   renders today, under a `testIDPrefix`.
5. **`TrackPlayChrome` stays** as the catalog wrapper in `TrackDetailScreen.tsx`, with the same
   props. The track page must look and behave exactly as before; every `track-detail-*` testID
   is unchanged.

## Files

| File                                           | Change                               |
| ---------------------------------------------- | ------------------------------------ |
| `src/data/repositories/addByRssRepository.ts`  | Type from the bundle in `upsertFeed` |
| `src/lib/addByRss/domain.ts`                   | Keep the stored type in two builders |
| `src/lib/addByRss/domain.test.ts`              | Cover both builders                  |
| `src/lib/addByRss/storedResourceType.ts`       | Which stored rows change type        |
| `src/lib/addByRss/storedResourceType.test.ts`  | Those cases                          |
| `src/data/db/applyAddByRssResourceTypes.ts`    | One-time local write                 |
| `src/data/db/index.ts`                         | Call it after `runMigrations`        |
| `vitest.config.ts`                             | Include the new test                 |
| `src/components/content/TrackDetailHeader.tsx` | New                                  |
| `src/components/content/index.ts`              | Export it                            |
| `src/screens/track/TrackDetailScreen.tsx`      | `TrackPlayChrome` renders it         |

All paths are under `apps/mobile/`. `TrackDetailScreen.tsx` is about 850 lines: Grep
`function TrackPlayChrome` and read to the `export function TrackDetailScreen` line.

## Implementation

### `addByRssRepository.ts`

Anchor: `upsertFeed`. In the `mappedFeed !== undefined` branch, `parsedValues` gains one key:

```typescript
const parsedValues = {
  latestItemPubDateMs: record.latestItemPubDateMs,
  mappedFeedJson: mappedFeed === null ? null : JSON.stringify(mappedFeed),
  resourceType:
    mappedFeed === null ? record.resourceType : getAddByRSSResourceTypeFromMappedFeed(mappedFeed),
};
```

`parsedValues` is spread after `baseValues` in both `values` and `set`, so it wins. Import
`getAddByRSSResourceTypeFromMappedFeed` as a value from `@podverse/parser-mapping` beside the
existing type import (**type-imports-separate-line**). Extend the method's doc comment: the
resource type is derived from the bundle at the same moment, as web derives it after a parse.
The one-time pass uses this same helper. Leave `isResourceType` and `rowToRecord` alone (plan
88 owns them). Plan 82 adds `mayHaveLivestreams` to this same `parsedValues` object later;
keep the `resourceType` key.

### `domain.ts`

- `mergeLocalAndRemoteAddByRssFeeds`: `resourceType: localFeed?.resourceType ?? 'podcasts'` in
  place of `'podcasts' as const`. Add a comment beside it: the follow list carries no medium, so
  the type comes from this device's last parse.
- `buildAddByRssFeedRecord`: `resourceType: existingFeed?.resourceType ?? 'podcasts'`.
- `localFeedForServerFollow` keeps `'podcasts'` (no row exists yet).

### One-time pass

The pass runs inside `initialize()` in `src/data/db/index.ts`, immediately after
`await runMigrations(sqlite)` and before the chrome reads. `initializeDatabase` is what the
first feed query already awaits, and this work is local, so Home cannot paint the old chips
first. Do not add a sync job, and do not put it in `createAddByRssRefreshJob`:
`planSyncRun` omits `add-by-rss-refresh` when signed out, the job returns when the account
snapshot is null, and a lapsed membership returns before any parse.

Do not add a SQLite migration. `resource_type` already exists (version 4). Plan 82 appends
version 24 for `may_have_livestreams`. Copying the medium sets into SQL would diverge from
`getAddByRSSResourceTypeFromMappedFeed`.

`src/lib/addByRss/storedResourceType.ts` stays free of `expo-sqlite`:

```typescript
export const ADD_BY_RSS_RESOURCE_TYPE_PASS_KEY = 'add_by_rss.resource_type_from_bundle';

export type StoredAddByRssResourceTypeRow = {
  feedUrl: string;
  mappedFeedJson: string | null;
  resourceType: string;
};

export type AddByRssResourceTypeUpdate = {
  feedUrl: string;
  resourceType: AddByRSSResourceType;
};

export const resourceTypeUpdatesFromStoredRows = (
  rows: readonly StoredAddByRssResourceTypeRow[]
): AddByRssResourceTypeUpdate[] => {
  const updates: AddByRssResourceTypeUpdate[] = [];
  for (const row of rows) {
    if (row.mappedFeedJson === null) {
      continue;
    }
    const mappedFeed = safeJsonParse<AddByRSSMappedFeed>(row.mappedFeedJson);
    if (mappedFeed === null) {
      continue;
    }
    const resourceType = getAddByRSSResourceTypeFromMappedFeed(mappedFeed);
    if (resourceType === row.resourceType) {
      continue;
    }
    updates.push({ feedUrl: row.feedUrl, resourceType });
  }
  return updates;
};
```

Value-import `getAddByRSSResourceTypeFromMappedFeed` and `import type` `AddByRSSMappedFeed`
from `@podverse/parser-mapping` on separate lines. `import type` `AddByRSSResourceType` from
`@podverse/helpers`, as `prefs/addByRSSFeeds.ts` does. `safeJsonParse` comes from
`../../data/db/serialization`.

`src/data/db/applyAddByRssResourceTypes.ts` imports `getDb` from `./client` and `schema` from
`./schema`. It must not import `initializeDatabase` or call `upsertFeed` (that rewrites the
row, live status, and may seed auto-download). Steps:

1. Read `kv_meta` for `ADD_BY_RSS_RESOURCE_TYPE_PASS_KEY`. A row means return.
2. Select `feedUrl`, `resourceType`, and `mappedFeedJson` from `add_by_rss_feed` where
   `mapped_feed_json` is not null.
3. For each `resourceTypeUpdatesFromStoredRows` result, `update` that feed's `resourceType`
   only. Leave `updated_at` alone so list order does not change.
4. Insert the marker (`value: '1'`, `updatedAt: Date.now()`) with `onConflictDoUpdate` on
   `kvMeta.key`, after the updates. A throw before that insert leaves the marker unset, and
   the next open retries. Do not catch. Doc comment: the medium on each stored bundle is
   applied to `resource_type` once at open; later opens read the marker; a later parse sets
   the type in `upsertFeed`.

### `TrackDetailHeader.tsx`

```typescript
export type TrackDetailHeaderProps = {
  /** Album or feed name; a link when `onAlbumPress` is set. */
  albumTitle: string;
  /** Feed URL of a private Add by RSS feed's artwork; set wherever `artworkHeaders` is set. */
  artworkAddByRssFeedUrl?: string | null;
  artworkHeaders?: Record<string, string>;
  artworkUri: string | null;
  dateLabel: string | null;
  /** Drives the one-tap download control beside the artwork; null hides it. */
  downloadItem: DTOItem | null;
  durationLabel: string | null;
  /** Suffix for the play bar ids and the playback match. */
  mediaIdText: string;
  moreActions: MediaRowMoreAction[];
  onAlbumPress?: () => void;
  onPlayPress: () => void;
  testIDPrefix: string;
  title: string;
};

export function TrackDetailHeader(props: TrackDetailHeaderProps) { … }
```

Move from `TrackPlayChrome`, unchanged except for these substitutions:

- `TRACK_ARTWORK_SIZE` (96) and the whole `StyleSheet.create` block (`artwork`, `artworkRow`,
  `date`, `playChrome`, `root`, `subtitleLink`, `subtitleMuted`, `title`, `titles`), with the same
  `useTheme` and `typography` inputs.
- Root `View` `accessible={false}`, `testID={`${testIDPrefix}-playback-chrome`}`.
- `CoverImage`: `accessibilityLabel={title}`, `addByRssFeedUrl={artworkAddByRssFeedUrl}`,
  `headers={artworkHeaders}`, `style={styles.artwork}`, `testID={`${testIDPrefix}-artwork`}`,
  `uri={artworkUri}`. No `viewerUri`, as today.
- `DownloadRowControl` only when `downloadItem !== null`: `item={downloadItem}`,
  `testID={`${testIDPrefix}-download`}`, `completeTestID={`${testIDPrefix}-download-complete`}`.
- Album line, testID `${testIDPrefix}-album-title` in both forms: with `onAlbumPress`, a
  `Pressable` (`accessibilityLabel={albumTitle}`, `accessibilityRole="link"`) around
  `Text style={styles.subtitleLink}`; without it, `Text style={styles.subtitleMuted}`.
- Title `Text accessibilityRole="header"` (`${testIDPrefix}-title`); date (`${testIDPrefix}-date`)
  when `dateLabel !== null`.
- `MediaRowActions` in `styles.playChrome`: `appearance="icons"`, `durationLabel`,
  `durationTestID={`${testIDPrefix}-duration-${mediaIdText}`}`, `idSuffix={`-${mediaIdText}`}`,
  `moreActions`, `moreTestID={`${testIDPrefix}-more-${mediaIdText}`}`, `onPlayPress`,
  `playbackMediaId={mediaIdText}`, `playLabel={t('media_player.play')}`,
  `playTestID={`${testIDPrefix}-play-${mediaIdText}`}`.
- Doc comment: the track page header (artwork with download, album link, title, date, play bar),
  shared by the track page and the Add by RSS track page.

`index.ts`: add `export { TrackDetailHeader } from './TrackDetailHeader';` and
`export type { TrackDetailHeaderProps } from './TrackDetailHeader';` in alphabetical position.
Plans 32 and 36 also edit this file; keep their exports.

### `TrackDetailScreen.tsx`

`TrackPlayChrome` keeps its props, `usePlaybackSession`, `useEpisodeStoredProgress`, the
`explicitSelectedParams` / `useDownloadAction` block, `useActionError`, `artworkUri`,
`trackTitle`, `durationLabel`, and the `moreActions` memo. Changes:

- `dateLabel`: `useMemo(() => itemDetailDateLabel(item.pub_date, i18n.language), [i18n.language,
  item.pub_date])` (plan 32's helper, from `../../components/content`).
- Delete the styles and the JSX, and return:

```tsx
<TrackDetailHeader
  albumTitle={channel !== null ? (channel.title ?? channel.id_text) : (itemRow.subtitle ?? '')}
  artworkUri={artworkUri}
  dateLabel={dateLabel}
  downloadItem={item}
  durationLabel={durationLabel}
  mediaIdText={item.id_text}
  moreActions={moreActions}
  onAlbumPress={channel !== null ? onAlbumPress : undefined}
  onPlayPress={onPlayPress}
  testIDPrefix="track-detail"
  title={trackTitle}
/>
```

Today the muted form shows `channel?.title ?? itemRow.subtitle`; with `channel === null` that is
`itemRow.subtitle`, so the expression above renders the same text in both forms. Remove imports
left unused (likely `formatDateAbbrev`, `CoverImage`, `DownloadRowControl`, `MediaRowActions`,
`Pressable`, and `TRACK_ARTWORK_SIZE`). Keep `primaryChannelListArtworkUrl` and every import the
screen body still uses; check each before deleting it.

## Tests

- `domain.test.ts` (already in the vitest include): in `mergeLocalAndRemoteAddByRssFeeds`, a
  local feed with `resourceType: 'albums'` merged with its remote follow keeps `'albums'`, and a
  remote-only follow is `'podcasts'`. A `buildAddByRssFeedRecord` case: an existing `'artists'`
  record keeps `'artists'`; no existing record gives `'podcasts'`.
- No repository test: `upsertFeed` needs SQLite, which the vitest suite does not load
  (**mobile-test-economics**). Plan 39's Maestro flow adds a music fixture and proves a parsed
  album lands on the Tracks chip.
- `getAddByRSSResourceTypeFromMappedFeed` is already covered in `packages/parser-mapping`.
- `storedResourceType.test.ts` (add `'src/lib/addByRss/storedResourceType.test.ts'` to
  `vitest.config.ts` immediately after the `domain.test.ts` entry). Build bundles with
  `convertParsedRSSFeedToCompat`, then `JSON.stringify`, the same shape SQLite stores:
  - `medium: 'music'`, stored `'podcasts'` → one update, `'albums'`. Assert
    `channel.channel.medium_id` is `MediumEnum.Music` (`@podverse/helpers/medium`) before
    stringifying.
  - `medium: 'publisher'` and `podcastRemoteItems: [{ medium: 'music', feedGuid: 'g' }]`,
    stored `'podcasts'` → `'artists'`.
  - no `medium` (the compat helper stores podcast), stored `'podcasts'` → no update.
  - music bundle already stored as `'albums'` → no update.
  - `mappedFeedJson: null` and `mappedFeedJson: '{'` → no update.
- No new Maestro step. The decision is the pure function. Plan 39's flow covers a newly parsed
  album. `e2e/track.yaml`, `album.yaml`, and `artist.yaml` assert `track-detail-*` ids and
  must pass unchanged.

## Release scratchpad

```markdown
## Mobile Add by RSS music feeds are listed as music

- Surfaces: mobile
- Change: A feed added by RSS on the phone now takes its type from the feed's medium after each
  parse, as on web. Music albums and artists move from the Podcasts chips to Albums and Artists
  on Home and in the Add by RSS library, their songs list on the Tracks chips, and the feed page
  shows them as tracks. Feeds already stored on the phone take that type the first time this
  build opens its database, from the medium in the stored bundle, with no network request.
  That includes a phone that is offline and a membership that cannot refresh feeds.
- Who notices: anyone who adds music feeds by RSS on the phone
- Operator steps: none
```
