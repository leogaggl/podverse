# 64 — Web Subscribed chips page (Home)

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

Rows: R47 (server half), R22 (server half). Web only. Paths are under `apps/web/src/` unless
stated. Runs after plans 60, 61, 62, and 63 (it follows the Browse page's shape). Plan 65 adds
this browser's Add by RSS follows to the same lists, and plan 66 adds their items.

Parity source: mobile Home (`apps/mobile/src/screens/home/HomeScreen.tsx`), whose chips are
Podcasts, Episodes, Clips, Artists, Albums, and Tracks over the account's follows. On web each
chip is that list in subscribed scope (plans 61 and 62). Today's Home (`app/page.tsx` and
`app/HomePage*.tsx`) shows one combined channel list with a medium dropdown (All, Podcasts,
Music). That dropdown goes away; the chips replace it, and there is no Music chip.

## Locked decisions

1. **Route.** `/` stays the Subscribed page. `app/page.tsx` is rewritten on the Browse page's
   pattern (plan 63 § `app/browse/page.tsx`) with `SUBSCRIBED_CHIPS`, chips page `'subscribed'`,
   and list scope `'subscribed'`.
1. **Metadata.** `generateMetadata` keeps `getCuratedStaticPageMetadata('home')`. `/` stays in the
   sitemap.
1. **Signed out.** Each chip shows its list's existing sign-in message and `HowToStartInfo`. The
   loaders send no request (plan 61 decision 3).
1. **Old Home code is deleted.** That is the five `app/HomePage*.tsx` files, the `home` filter
   default and its type, and `homeListViewModeScope`. A cookie that still holds `fd.home` is
   valid and its entry is ignored; no migration.
1. **`HowToStartInfo` links point at Browse.** Podcasts goes to `ROUTES.BROWSE` (Podcasts is the
   default chip and `type=global&sort=recent` are Browse's defaults). Music goes to
   `buildMediaListChipPath('browse', 'artists')`. Videos keeps `ROUTES.VIDEOS`.

## Files

| File                                           | Change                               |
| ---------------------------------------------- | ------------------------------------ |
| `app/page.tsx`                                 | Rewrite as the Subscribed chips page |
| `app/HomePageClient.tsx`                       | Delete                               |
| `app/HomePageContext.tsx`                      | Delete                               |
| `app/HomePageDropdownConfig.tsx`               | Delete                               |
| `app/HomePageHeader.tsx`                       | Delete                               |
| `app/HomePageList.tsx`                         | Delete                               |
| `utils/localSettings/localSettings.ts`         | Remove `home` / `HomeFilterDefaults` |
| `hooks/listViewMode.ts`                        | Remove `homeListViewModeScope`       |
| `hooks/listViewMode.test.ts`                   | Remove its `describe` block          |
| `components/HowToStartInfo/HowToStartInfo.tsx` | Browse links                         |

## Implementation

### `app/page.tsx`

```tsx
type SubscribedPageProps = { searchParams: Promise<MediaListSearchParams> };

export async function generateMetadata() {
  return getCuratedStaticPageMetadata('home');
}

export default async function SubscribedPage({ searchParams }: SubscribedPageProps) { … }
```

Body, as on Browse:

1. `params` and `ssr` (`getMediaListSsr()`).
1. `resolveMediaListChip({ chips: SUBSCRIBED_CHIPS, urlValue: params[MEDIA_LIST_CHIP_QUERY_PARAM],
storedValue: readStoredMediaListChip(ssr.localSettings, 'subscribed'), defaultChip:
DEFAULT_MEDIA_LIST_CHIP })`.
1. `chipsNode` is `<MediaListChips page="subscribed" chips={SUBSCRIBED_CHIPS} selected={chip}
urlChip={urlChip} />`.
1. A `switch (chip)` over the six chips returns `<…PageClient key={chip} chipsNode={chipsNode}
{...await load…ListProps('subscribed', params, ssr)} />`, with a `never` default.

Imports come from `./_media-lists/<media>/…`.

### `utils/localSettings/localSettings.ts`

Delete `HomeFilterDefaults`, the `home?:` member of `FilterDefaults`, and the
`QueryParamsHomeSort` import if nothing else uses it. `FilterDefaultsPage` is `keyof
FilterDefaults` since plan 60, so it drops `home` by itself.

### `hooks/listViewMode.ts`

Delete `homeListViewModeScope` and its now-unused imports (`QueryParamsMedium`, `SortPrefScope`,
`homeListViewModeScopeForMedium`, if unused). `resolveListViewMode` and `isListViewMode` stay. In
`listViewMode.test.ts`, delete the `describe('homeListViewModeScope', …)` block and its import.

### `components/HowToStartInfo/HowToStartInfo.tsx`

- `podcastsLink`: `href={ROUTES.BROWSE}`
- `musicLink`: `href={buildMediaListChipPath('browse', 'artists')}`
- `videosLink`: unchanged

Keep `fullPageLoad`.

## Reuse

The subscribed-scope list modules from plans 61 and 62, the Browse page's structure, and
`MediaListChips`. Mobile Home's chip order is the reference; nothing is copied from mobile code.

## Tests

**Unit** — `hooks/listViewMode.test.ts` loses the removed function's block; nothing else changes.
The chip resolver is covered by plan 60.

Playwright coverage is in plan 69 (Subscribed chips, the signed-out state, and the specs that
used to open `/podcasts?type=subscribed`).

## Release scratchpad

```markdown
## Web Home becomes Subscribed, with chips

- Surfaces: web
- Change: The home page (`/`) is now Subscribed. Chips, in the mobile app's order (Podcasts,
  Episodes, Clips, Artists, Albums, Tracks), replace the All/Podcasts/Music dropdown; there is no
  Music chip. Each chip lists what the account follows, with that list's own sort, range, and
  list/grid choice remembered in this browser. The chip is in the URL (`?tab=`) and the last chip
  is remembered. Signed-out visitors see the same getting-started message as before, now linking
  to Browse.
- Who notices: every signed-in web user
- Operator steps: none
```
