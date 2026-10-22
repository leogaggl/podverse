# 35 — Add by RSS chapters and transcript: the mobile loading layer

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** extra high

Rows: R55 (the mobile work to load Chapters and Transcript for Add by RSS items). Shared helpers,
web (no behavior change), and mobile. No UI in this plan; plan 36 renders what this loads.

Runs after `33-add-by-rss-episode-detail.md` (it creates `src/screens/home/addByRss/`, where the
tab helper goes). Plan 36 runs after this one.

## Answers

**What already exists.** The API endpoint `POST /account/add-by-rss/chapters-transcript`
(`apps/api/src/controllers/account/accountAddByRSSChaptersTranscript.ts`) fetches an item's
chapters JSON and first transcript server-side and returns
`{ chapters: AddByRSSChapterResponse[]; transcriptText?: string }`. It needs a signed-in account
(`ensureAuthenticated`) but no membership (`skipMembershipStatus: true`). It applies Basic Auth
only to URLs in the feed's credential scope and re-checks scope per redirect hop. The request
client is `ApiRequestService.reqAccountAddByRSSChaptersTranscript` in `@podverse/helpers-requests`;
the bundle-to-URL and chapter mappers are `getChaptersAndTranscriptUrls` and
`mapAddByRSSChaptersToDTOItemChapters` in `@podverse/parser-mapping`. Web already uses all three
(`apps/web/src/app/add-by-rss/episode/AddByRSSEpisodePageClient.tsx`).

**What mobile lacks.** A repository call that sends the request with device-held credentials and
maps the answer, and a rule for which chips the Add by RSS episode page shows. No API, catalog,
or request-client change is needed.

## Locked decisions

1. **Credentials rule is shared.** Web's `getAddByRSSChaptersTranscriptCredentials` sends stored
   credentials only when some chapters or transcript URL is in the feed's credential scope
   (`resolveCredentialScope(feedUrl, url, { allowInsecure: true }) !== 'withheld_other_domain'`;
   the API owns the insecure-scheme rule). Move that check into `@podverse/helpers` as
   `hasUrlInCredentialScope` and call it from web and mobile.
2. **Repository home.** `segmentsRepository` (`src/data/repositories/segmentsRepository.ts`)
   already loads catalog chapters through `requestWithMobileAuthRefresh`. Add the Add by RSS
   method there; widen its doc comment from "the full player" to "the full player and the episode
   pages".
3. **Item id sent to the API** is the Add by RSS row id, `AddByRssHomeEpisode.id`
   (`${feed.idText}-${itemKey}`). The API only uses it to build chapter `id_text` values.
4. **No module-level cache.** Plan 36 keeps the answer in screen state for one visit. Web's
   in-memory cache is keyed by item only; on a shared phone that could show one account's private
   transcript to another, so mobile does not copy it.
5. **Chapters filter** drops `table_of_contents === false`, as the episode page and
   `getChaptersByItemIdText` do.
6. **Chip rule.** Chips come from the parsed bundle, which is on the device: Summary always,
   Chapters when the bundle has a chapters URL, Transcript when it has a transcript URL, People
   when the item lists people. Order follows `EPISODE_TABS` in `src/prefs/detailListPrefs.ts`.
   This matches web, which shows the two tabs only when the URL exists.

## Files

| File                                                                | Change                     |
| ------------------------------------------------------------------- | -------------------------- |
| `packages/helpers/src/lib/addByRSS/credentialScope.ts`              | `hasUrlInCredentialScope`  |
| `packages/helpers/src/lib/addByRSS/credentialScope.test.ts`         | Cover it                   |
| `apps/web/src/utils/addByRSS/chaptersTranscript.ts`                 | Call the helper            |
| `apps/mobile/src/lib/addByRss/itemSections.ts`                      | New: builder and mapper    |
| `apps/mobile/src/lib/addByRss/itemSections.test.ts`                 | New                        |
| `apps/mobile/src/data/repositories/segmentsRepository.ts`           | Add by RSS chapters method |
| `apps/mobile/src/screens/home/addByRss/addByRssEpisodeTabs.ts`      | New: chip rule             |
| `apps/mobile/src/screens/home/addByRss/addByRssEpisodeTabs.test.ts` | New                        |
| `apps/mobile/vitest.config.ts`                                      | Include the two new tests  |

`packages/helpers/src/index.ts` already re-exports `./lib/addByRSS/credentialScope.js`; no edit.

## Implementation

### `credentialScope.ts`

Add after `resolveCredentialScope`:

```typescript
/**
 * Whether device-held credentials for `feedUrl` may usefully go with a request for these URLs:
 * true when at least one non-empty URL is on the feed's credential scope. Insecure schemes count
 * as in scope here because the server that fetches the URLs owns that rule.
 */
export function hasUrlInCredentialScope(
  feedUrl: string,
  urls: readonly (string | null | undefined)[]
): boolean {
  return urls.some(
    (url) =>
      typeof url === 'string' &&
      url.trim() !== '' &&
      resolveCredentialScope(feedUrl, url, { allowInsecure: true }) !== 'withheld_other_domain'
  );
}
```

### `apps/web/src/utils/addByRSS/chaptersTranscript.ts`

Replace the `inScope` computation with `hasUrlInCredentialScope(feedUrl, resourceUrls)` and
import it from `@podverse/helpers` in place of `resolveCredentialScope` (drop that import if it
becomes unused). Keep the early return for no account, no feed URL, or an empty `resourceUrls`,
and keep the rest of the function. `chaptersTranscript.test.ts` stays as is and must still pass.

### `lib/addByRss/itemSections.ts`

```typescript
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
): AddByRssItemSectionUrls | null => { … };

/** Request body for the chapters-transcript endpoint; credentials ride only when given. */
export const buildAddByRssItemSectionsRequest = (input: {
  credentials: AddByRssCredentials | null;
  feedUrl: string;
  itemIdText: string;
  urls: AddByRssItemSectionUrls;
}): ReqAccountAddByRSSChaptersTranscriptParams => { … };

/** Maps the endpoint's answer; table-of-contents-suppressed chapters are dropped. */
export const toAddByRssItemSections = (response: {
  chapters: AddByRSSChapterResponse[];
  transcriptText?: string;
}): AddByRssItemSections => { … };
```

- `addByRssItemSectionUrls`: call `getChaptersAndTranscriptUrls(itemBundle)`; return `null` when
  both fields are `undefined`, else the object.
- `buildAddByRssItemSectionsRequest`: `{ itemIdText, feedUrl }`, plus `chaptersFeedUrl` and
  `transcriptUrl` only when defined, plus `basic_auth_username` / `basic_auth_password` from
  `credentials.username` / `credentials.password` only when `credentials !== null`. Use
  conditional spreads, as `addByRssRepository.parseNow` does.
- `toAddByRssItemSections`: `mapAddByRSSChaptersToDTOItemChapters(response.chapters)` filtered
  with `chapter.table_of_contents !== false`; `transcriptText: response.transcriptText ?? ''`.
- `AddByRssCredentials` is the type `addByRssCredentialStore` returns; confirm its export in
  `src/lib/addByRss/credentials.ts` (`mediaAuth.ts` imports it from there).

### `segmentsRepository.ts`

Add beside `getChaptersByItemIdText`:

```typescript
/**
 * Chapters and transcript for one Add by RSS item, fetched by the API from the URLs its parsed
 * bundle links. The device's stored feed credentials go along only when one of those URLs is on
 * the feed's credential scope. An item that links neither resolves to empty sections without a
 * request.
 */
getAddByRssChaptersAndTranscript: async (
  context: MobileAuthRequestContext,
  input: {
    feedUrl: string;
    itemBundle: AddByRSSMappedFeed['items'][number];
    itemIdText: string;
  }
): Promise<AddByRssItemSections> => { … },
```

1. `const urls = addByRssItemSectionUrls(input.itemBundle)`; `null` → return
   `{ chapters: [], transcriptText: '' }`.
2. `credentials`: when `hasUrlInCredentialScope(input.feedUrl, [urls.chaptersFeedUrl,
   urls.transcriptUrl])`, `await addByRssCredentialStore.getForCurrentAccount(input.feedUrl)`
   inside `try`; a thrown read becomes `null` (no logging: an unreadable store before first unlock
   is expected). Otherwise `null`.
3. `const response = await requestWithMobileAuthRefresh(context, async (api) =>
   api.reqAccountAddByRSSChaptersTranscript(buildAddByRssItemSectionsRequest({ credentials,
   feedUrl: input.feedUrl, itemIdText: input.itemIdText, urls })))`. `apiRequest` resolves to the
   body itself (no `.data`), as `addByRssRepository.parseNow` shows.
4. `return toAddByRssItemSections(response);`. Request errors propagate; plan 36 shows them.

Imports: `hasUrlInCredentialScope` from `@podverse/helpers`, `AddByRSSMappedFeed` type from
`@podverse/parser-mapping`, `addByRssCredentialStore` from `./addByRssCredentialStore`, and the
three `itemSections` exports. Keep the `DTOItemChapter` import from `@podverse/helpers/dto`.

URLs go to the API unchanged. `resolveE2eMediaUrl` rewrites localhost only for requests the
device makes; the API runs on the host and reaches the test-assets server directly.

### `screens/home/addByRss/addByRssEpisodeTabs.ts`

```typescript
import type { EpisodeTab } from '../../../prefs/detailListPrefs';
import { EPISODE_TABS } from '../../../prefs/detailListPrefs';

/** The episode-page chips an Add by RSS item can have; the others need catalog data. */
export type AddByRssEpisodeTab = Extract<
  EpisodeTab,
  'chapters' | 'people' | 'summary' | 'transcript'
>;

/** Chips for one Add by RSS item, in the episode page's order. Summary is always first. */
export const resolveAddByRssEpisodeTabs = (input: {
  hasChapters: boolean;
  hasPeople: boolean;
  hasTranscript: boolean;
}): AddByRssEpisodeTab[] => { … };
```

- A private type guard `isAddByRssEpisodeTab(tab: EpisodeTab): tab is AddByRssEpisodeTab`
  (`tab === 'chapters' || tab === 'people' || tab === 'summary' || tab === 'transcript'`).
- Body: `EPISODE_TABS.filter(isAddByRssEpisodeTab).filter((tab) => …)` keeping `summary` always,
  `chapters` when `hasChapters`, `transcript` when `hasTranscript`, `people` when `hasPeople`.
- Plan 36 passes `hasChapters: urls?.chaptersFeedUrl !== undefined`,
  `hasTranscript: urls?.transcriptUrl !== undefined`, and `hasPeople: people.length > 0`.

## Tests

- `credentialScope.test.ts`, new `describe('hasUrlInCredentialScope')` with `it.each` rows:
  - a subdomain URL of the feed's domain → `true`;
  - every URL on another domain → `false`;
  - an `http` URL on the feed's domain with an `https` feed → `true` (insecure counts);
  - one other-domain URL and one in-scope URL → `true`;
  - an empty list, and a list of only `''`, `'  '`, `null`, `undefined` → `false`.
- `apps/mobile/src/lib/addByRss/itemSections.test.ts` (new):
  - `addByRssItemSectionUrls`: a bundle with neither URL → `null`; with only a transcript →
    `chaptersFeedUrl: undefined` and the transcript URL. Build bundles the way
    `localResourceData.test.ts` does.
  - `buildAddByRssItemSectionsRequest`: with credentials includes both `basic_auth_*` fields;
    without credentials has neither key (`not.toHaveProperty`); an undefined URL is omitted.
  - `toAddByRssItemSections`: a chapter with `table_of_contents: false` is dropped and the rest
    keep order; a missing `transcriptText` becomes `''`.
- `apps/mobile/src/screens/home/addByRss/addByRssEpisodeTabs.test.ts` (new): all flags false →
  `['summary']`; all true → `['summary', 'chapters', 'transcript', 'people']`; only transcript
  and people → `['summary', 'transcript', 'people']`.
- `apps/mobile/vitest.config.ts`: add `'src/lib/addByRss/itemSections.test.ts'` beside the other
  `src/lib/addByRss/` entries and `'src/screens/home/addByRss/addByRssEpisodeTabs.test.ts'`
  beside the other `src/screens/home/` entries, keeping each group alphabetical.
- `apps/web/src/utils/addByRSS/chaptersTranscript.test.ts`: unchanged; it proves the web refactor.
- No repository test: `segmentsRepository` calls SecureStore and the network, which the vitest
  suite does not load (**mobile-test-economics**). Plan 36's Maestro flow proves the request.

Mobile resolves `@podverse/helpers` from its built output (`file:` dependency), so the new export
needs `npm run build -w packages/helpers` before mobile type-check or tests see it.

## Release scratchpad

None for this plan alone. Plan 36 carries the entry for what users see; the web change keeps
behavior.
