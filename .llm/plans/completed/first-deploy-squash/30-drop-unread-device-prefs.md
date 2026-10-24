**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# Drop unread Home and Library source-filter prefs

Home and Library no longer have a source filter. Two AsyncStorage keys and one sort scope exist only so an older v5 install still parses a value nothing reads. A fresh install never writes them. Remove those reads and writes. Per-type list/grid stays.

## Rows

R19, R26

## Runs after

none

## Files

- apps/mobile/src/prefs/prefsStore.ts
- apps/mobile/src/prefs/prefsStore.test.ts
- apps/mobile/src/prefs/index.ts
- apps/mobile/src/prefs/homeListPrefs.ts
- apps/mobile/src/prefs/homeListPrefs.test.ts

## Tests

Update the Vitest files listed above. No Maestro flow. No API integration test. The change is which stored keys a pure reader honors.

## Release scratchpad

Do not edit `release-notes/scratchpad.md` in this prompt. The set's last prompt appends this entry:

```markdown
## Mobile drops unread Home and Library source-filter prefs

- Surfaces: mobile
- Change: AsyncStorage no longer reads or writes `home.subscriptionFilter` or
  `library.subscriptionFilter`. Home no longer applies a stored `sort.home-layout` view mode.
  Per-type list/grid stays, including the podcasts view mode used when another channel type has
  none of its own.
- Who notices: an install that still has those keys. A fresh install looks the same. The one
  mobile tester deletes the app.
- Operator steps: none beyond that reinstall
```

## What to remove

### Source-filter keys

In `prefsStore.ts`, remove `home.subscriptionFilter` and `library.subscriptionFilter` from `PrefKey`, `PrefValueMap`, `PREF_KEYS`, `createEmptySnapshot`, the `getPref` / `setPref` overloads, the parse branch in `getPref`, and the matching arms in `hydratePrefs`.

Nothing outside this module calls `getPref` or `setPref` for either key. `SubscriptionListFilter`, `SUBSCRIPTION_FILTERS`, `isSubscriptionListFilter`, and `DEFAULT_SUBSCRIPTION_FILTER` exist only for those keys. Remove them, and remove their exports from `prefs/index.ts`.

In `prefsStore.test.ts`, drop the two keys from the invalid-enum case, the write case, and the hydrate snapshot.

In `homeListPrefs.test.ts`, delete `ignores a legacy Home source-filter preference` and `does not react to a source-filter preference change`. Those tests only lock that Home ignores the old key.

### `sort.home-layout`

`writeHomeViewMode` writes `directoryListViewModeScope(mediaType)` (`sort.podcasts`, `sort.artists`, `sort.albums`). Nothing writes `{ kind: 'list', name: 'home-layout' }`. `readHomeViewMode` still reads that scope between the per-type value and the podcasts value.

Remove `HOME_VIEW_MODE_SCOPE` and the `readSortPref` call that uses it.

Rewrite the comment on `readHomeViewMode` so the read order is: this type's stored `viewMode`, then the podcasts `viewMode` when this type has none, then the default list. Drop the sentence on `subscribeHomeListPrefs` that calls `home-layout` a read-only fallback.

In `homeListPrefs.test.ts`:

- Delete `uses a stored home-layout grid when the media type has no viewMode of its own`.
- Delete `lets a per-type viewMode override home-layout`. Per-type behavior is already covered by `remembers grid on artists without changing podcasts`.
- Point `ignores a stored view mode it does not recognise` at `sort.podcasts` with `{ viewMode: 'carousel' }` instead of `sort.home-layout`. Podcasts then open on `DEFAULT_HOME_VIEW_MODE`.
- Rename `keeps a legacy podcasts-scoped grid after layout becomes Home-wide` to `uses the podcasts view mode for a channel type that has none of its own`. Keep the body: `sort.podcasts` `{ viewMode: 'grid' }` makes albums open on grid.

## Leave in place

- The podcasts `viewMode` fallback. `writeHomeViewMode('podcasts', 'grid')` writes `sort.podcasts`, and albums with no view mode of their own still read it. That is current behavior, not an older-install reader.
- `pmt` and `preferred_media_type`. Both are current prefs (playback medium and Home chip).
- `downloads.auto_delete`. Plan 31 owns that file.
- v4 deep-link scheme `podverse`. Out of scope.
