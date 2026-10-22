# 68 — Web sidebar, removed list routes, and guidance

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

Rows: R46, R50 (livestream lists and the remaining old-route callers), R63 (Library has no
Profiles link). Web, helpers-config, k8s base env, and guidance. Paths are under `apps/web/src/`
unless stated. Runs after plans 61–67. Shares `utils/localSettings/localSettings.ts` with plan 71
(which adds `bae`); edit only the `sba` parts named here.

Parity source: mobile tabs and My Library. `LibraryHubScreen` in
`apps/mobile/src/navigation/index.tsx` lists Downloads, Queue, History, Playlists, My Clips, Add
by RSS, and has no Profiles row. Public profiles are Browse's Users chip
(`BROWSE_MEDIA_TYPE_ORDER` in `apps/mobile/src/screens/browse/browseTypes.ts`). Web has no
Downloads.

## Locked decisions

1. **Sidebar layout.** The sticky top (brand, Search) is unchanged. The scrollable area is: a
   divider, **Subscribed** (`ROUTES.HOME`), **Browse** (`ROUTES.BROWSE`), a divider, then the
   **Library** accordion. Subscribed and Browse are plain `SideBarLink`s, no icons. The Podcasts,
   Music, and Add by RSS accordions are deleted.
1. **Library links, in order:** Queues, History, Playlists, My Clips, **Add by RSS**
   (`ROUTES.ADD_BY_RSS`, `tFeatures('add_by_rss.label')`). No Profiles link (R63). Delete the
   `SideBarLink` whose `href` is `ROUTES.PROFILES` (`SideBar.tsx` line 127, label
   `tFeatures('profiles')`). Public profiles are Browse › Users (`/browse?tab=users`, plan 63).
   Keep `ROUTES.PROFILES`, `app/profiles/`, and the `profiles` catalog key:
   `ProfilesPageHeader` still titles that page with `tFeatures('profiles')`. The Add Feed link
   moves to the Add by RSS page header (plan 67).
1. **Accordion state.** `SidebarAccordionState` becomes `{ library: boolean }`, default open. An
   older cookie that still has `podcasts`, `music`, and `addByRSS` stays valid (so no other
   setting resets) and its `library` value is kept; the extra keys are dropped on the next write.
1. **Group order setting removed.** With one accordion there is nothing to order.
   `NEXT_PUBLIC_SIDEBAR_GROUP_ORDER`, its parser, its sidecar validation, and its config entry are
   deleted.
1. **Livestream list routes removed.** `app/podcasts/livestreams/page.tsx` and
   `app/music/livestreams/page.tsx` are deleted, so `/podcasts/livestreams` and
   `/music/livestreams` return not found. The Livestreams modules (`LivestreamsPage*.tsx` in
   `app/podcasts/livestreams/`) stay where they are, unrouted, for area H's Livestreams chip. So
   do `ROUTES.PODCASTS_LIVESTREAMS` and `ROUTES.MUSIC_LIVESTREAMS`, which those modules use; area
   H removes them when it rewires the modules. Livestream detail routes stay.
1. **Old-route callers** point at Browse chips (list in § Callers).
1. **Guidance** says Subscribed includes Add by RSS and the library is one page.

## Files

| File                                                      | Change                            |
| --------------------------------------------------------- | --------------------------------- |
| `components/SideBar/SideBar.tsx`                          | Rewrite the groups                |
| `utils/localSettings/localSettings.ts`                    | `sba` is `{ library }`            |
| `utils/localSettings/localSettings.sba.test.ts`           | One-key cases, old cookie case    |
| `config/index.ts`                                         | Remove `sidebar`                  |
| `config/runtime-config.ts`                                | Remove the key (lines 51, 125)    |
| `config/sidebarGroupOrder.test.ts`                        | Delete                            |
| `apps/web/sidecar/src/server.ts`                          | Remove the key (§ Config and env) |
| `apps/web/sidecar/.env.example`                           | Remove line 51                    |
| `infra/k8s/base/web/source/web-sidecar.env`               | Remove line 47                    |
| `packages/helpers-config/src/sidebarGroupOrder.ts`        | Delete                            |
| `packages/helpers-config/src/index.ts`                    | Remove line 6                     |
| `app/podcasts/livestreams/page.tsx`                       | Delete                            |
| `app/music/livestreams/page.tsx`                          | Delete                            |
| `lib/seo/curatedPageMetadata.ts`                          | Remove two livestream ids         |
| `lib/seo/routeSeoPolicy.ts`                               | Remove two livestream entries     |
| `app/sitemap.ts`                                          | Remove two livestream paths       |
| `packages/i18n-catalog/consumer/originals/*.json`         | Remove two `seo.pages` blocks     |
| `constants/routes.ts`                                     | Remove old list constants         |
| `components/Clip/RemovedClipPage.tsx`                     | Line 53                           |
| `components/Clip/ClipForm.tsx`                            | Line 109                          |
| `components/Core/Podcast/CorePodcastHeaderCategories.tsx` | Line 22                           |
| `.cursor/rules/mobile-tab-stack-isolation.mdc`            | Web bullet                        |
| `docs/features/ADD-BY-RSS.md`                             | Two web sentences                 |

## Implementation

### `SideBar.tsx`

- Delete `AccordionState`, `groupOrder`, `renderGroup`, and the `SidebarGroupKey` and
  `getConfig` imports. `accordionState` is `sidebarAccordion` (type `SidebarAccordionState`).
- Add `const tSubscriptions = useTranslations('subscriptions');`.
- The scrollable `div` renders, in order: `<SideBarDivider noMarginTop />`, `<SideBarLink
href={ROUTES.HOME}>{tSubscriptions('subscribed')}</SideBarLink>`, `<SideBarLink
href={ROUTES.BROWSE}>{tFeatures('browse.browse')}</SideBarLink>`, `<SideBarDivider />`, and the
  Library `Accordion` as today (same props, `open={accordionState.library}`,
  `onToggle={handleAccordionToggle('library')}`) with decision 2's links. Do not render a
  Profiles link.
- `handleAccordionToggle` keeps its shape with `key: keyof SidebarAccordionState`.
- Remove `tMedia` if it becomes unused. `tFeatures('profiles')` stays in use on the profiles
  page, so leave the catalog key.
- Check: `rg 'ROUTES\.PROFILES' apps/web/src/components/SideBar` finds nothing.

### `localSettings.ts` (`sba` only)

```typescript
export interface SidebarAccordionState {
  library: boolean;
}

export const DEFAULT_SIDEBAR_ACCORDION_STATE: SidebarAccordionState = { library: true };
```

- `isSidebarAccordionState`: an object whose `library` is a boolean (other keys allowed).
- `resolveSidebarAccordion(stored)`: `{ library: isSidebarAccordionState(stored) ?
stored.library : true }`. Do not spread `stored`.
- `isValidLocalSettings`, the `sba` clause: `sba === undefined || (typeof sba === 'object' &&
sba !== null && (sba.library === undefined || typeof sba.library === 'boolean'))`. Drop the
  `podcasts`, `music`, and `addByRSS` checks.

`contexts/LocalSettings.tsx` needs no change; it uses the type and the default.

### `localSettings.sba.test.ts`

`allClosed` and `allOpen` become `{ library: false }` and `{ library: true }`. Replace the
"keeps one saved close" case with: an old four-key cookie `{ podcasts: true, music: false,
addByRSS: true, library: false }` resolves to `{ library: false }`, and the same cookie's other
settings (for example `vs: 'grid'`) survive (`getParsedLocalSettings().vs` is `'grid'`).

### Config and env

- `config/index.ts`: delete the `sidebar: { groupOrder: … }` block and `parseSidebarGroupOrder`
  from the import. Search the web app for `public.sidebar` and remove any remaining use.
- `runtime-config.ts`: remove `'NEXT_PUBLIC_SIDEBAR_GROUP_ORDER'` from the key union and the list.
- Sidecar `server.ts`: remove the import (line 19), the list entry (line 91), the `if` branch in
  `validateOne` (lines 141–143), and the category map entry (line 351).
- Remove the env line from `apps/web/sidecar/.env.example` and the k8s base `web-sidecar.env`.
- Delete `packages/helpers-config/src/sidebarGroupOrder.ts` and its `export *` line, and
  `apps/web/src/config/sidebarGroupOrder.test.ts`.
- Check: `rg 'SIDEBAR_GROUP_ORDER|sidebarGroupOrder|SidebarGroupKey|groupOrder' --glob
'!**/node_modules/**' --glob '!.llm/**'` finds nothing.

### Livestream lists

Delete the two `page.tsx` files. Remove `podcastsLivestreams` and `musicLivestreams` from
`CURATED_PAGE_PATHS`, the `/podcasts/livestreams` and `/music/livestreams` entries from
`routeSeoPolicy.ts`, the two paths from `STATIC_SITEMAP_PATHS`, and the `podcastsLivestreams` and
`musicLivestreams` blocks under `seo.pages` in the four consumer catalogs.

### `constants/routes.ts`

Delete `ALBUMS`, `ARTISTS`, `CLIPS`, `EPISODES`, `PODCASTS`, and `TRACKS`, and any of
`ADD_BY_RSS_ALBUMS`, `ADD_BY_RSS_ARTISTS`, `ADD_BY_RSS_EPISODES`, `ADD_BY_RSS_LIVESTREAMS`,
`ADD_BY_RSS_PODCASTS`, `ADD_BY_RSS_TRACKS` plan 67 left. Keep `PROFILES`,
`PODCASTS_LIVESTREAMS`, `MUSIC_LIVESTREAMS`, `VIDEOS`, and every detail route. `/profiles`
stays a working page (plan 63).

### Callers

- `RemovedClipPage.tsx:53`: `router.push(ROUTES.CLIPS)` becomes
  `router.push(buildMediaListChipPath('browse', 'clips'))`.
- `ClipForm.tsx:109`: `router.push('/clips')` becomes the same call.
- `CorePodcastHeaderCategories.tsx:22`: `` `/podcasts?category=${…}` `` becomes
  `` `${ROUTES.BROWSE}?category=${…}` ``.

Podcasts is the default Browse chip, so the category link needs no `tab`. Then this search must
find nothing outside tests:

```bash
rg "ROUTES\.(PODCASTS|EPISODES|CLIPS|ARTISTS|ALBUMS|TRACKS)\b" apps/web/src
rg "'/(podcasts|episodes|clips|artists|albums|tracks)['?\`]" apps/web/src
```

### `.cursor/rules/mobile-tab-stack-isolation.mdc`

§ Add-by-RSS surface ownership. Replace "Web keeps add-by-RSS on its own sidebar library routes;
those pages stay separate from Home." with:

```markdown
- Web Subscribed (`/`) lists directory follows and this browser's ready add-by-RSS follows
  together; Clips stays directory only. The web Add by RSS library is one page, `/add-by-rss`,
  linked from the sidebar's Library section.
```

Plan 40 edits another bullet in the same section; keep its text.

### `docs/features/ADD-BY-RSS.md`

- First paragraph: replace "On web, the add-by-RSS sidebar routes keep the same separation from
  Home." with "Web Subscribed (`/`) does the same with this browser's feeds, and the web library
  is one page, `/add-by-rss`, with the same chips." Plan 40 rewrites the sentence before it.
- § Feeds that need credentials on this device: replace "the web add-by-RSS library routes" with
  "the web Add by RSS page, `/add-by-rss`".

## Reuse

`SideBarLink`, `SideBarDivider`, the Library `Accordion`, and `buildMediaListChipPath` (plan 60).

## Tests

**Unit** — `localSettings.sba.test.ts` as above. `config/sidebarGroupOrder.test.ts` is deleted
with the code it tested.

Playwright coverage is in plan 69 (`navbar-chrome.spec.ts` for the sidebar, including no
`#sidebar a[href="/profiles"]`, the removed URLs, and the SEO and sitemap specs).
`seo-profile-sharable-status.spec.ts` still fetches `/profiles`; leave it.

## Release scratchpad

```markdown
## Web sidebar: Subscribed, Browse, and Library

- Surfaces: web, web sidecar, k8s base env
- Change: The web sidebar shows Subscribed (the home page) and Browse in place of the Podcasts,
  Music, and Add by RSS sections. Library lists Queues, History, Playlists, My Clips, and one
  Add by RSS link to the Add by RSS page. The Profiles link is removed; public profiles are on
  Browse, under Users. The `/profiles` page keeps its URL. The list pages `/podcasts`,
  `/episodes`, `/clips`, `/artists`, `/albums`, `/tracks`, `/podcasts/livestreams`, and
  `/music/livestreams` now return not found and are out of the sitemap; podcast, episode, clip,
  artist, album, track, and livestream pages keep their URLs. Category links on podcast pages
  open Browse. The `NEXT_PUBLIC_SIDEBAR_GROUP_ORDER` setting is removed.
- Who notices: every web visitor; bookmarks to the old list pages stop working
- Operator steps: remove `NEXT_PUBLIC_SIDEBAR_GROUP_ORDER` from web sidecar env in GitOps
  overlays and local `apps/web/sidecar/.env` files (a leftover value is ignored)
```
