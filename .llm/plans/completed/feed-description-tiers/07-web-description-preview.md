# 07 — Web: previews in rows, truncation notice on detail

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Summary

Web list rows read the stored `preview` instead of stripping full HTML on every render. Item
Summary and channel About say when notes were shortened and link to the full notes. Web pages
render on the server from detail endpoints, so web needs no lazy fetch.

Depends on 01 (`getDescriptionPreviewText`, `isDescriptionTruncated`) and 06 (copy keys, seed).
Do not edit the catalog, the seed, mobile, or `@podverse/ui` copy. Runs in parallel with 08.

## Rows

Replace `stripAndDecodeHtml(item.item_description?.value)` with
`getDescriptionPreviewText(item.item_description)` in:

- `apps/web/src/components/List/Podcasts/Episodes/ListEpisodeRow.tsx` (both uses)
- `apps/web/src/components/Common/Podcast/Episode/CommonEpisodeRow.tsx`
- `apps/web/src/components/List/LiveItem/ListLiveItemRow.tsx`

Search `apps/web/src` for other row or card components that strip `item_description` or
`channel_description` for a snippet, and switch them too. Keep the existing CSS line clamp.

## Truncation notice

New app-local component `apps/web/src/components/Content/Description/DescriptionTruncationNotice.tsx`:

```tsx
type DescriptionTruncationNoticeProps = {
  kind: 'item' | 'channel';
  linkUrl: string | null | undefined;
};
```

- With a valid `http(s)` `linkUrl`: an external link (new tab, `rel="noopener noreferrer"`)
  labeled `info.truncation.read_full_show_notes` (item) or
  `info.truncation.read_full_description` (channel).
- Without one: a muted sentence, `info.truncation.show_notes_shortened` or
  `info.truncation.description_shortened`.
- Render below the description with the same spacing token as the description's paragraph gap
  (**even-content-spacing**). Use existing link styles; add no new tokens
  (**styles-source-of-truth**).
- The link has an accessible name from its visible label (**screen-reader-accessibility**).

Render it only when `isDescriptionTruncated(description)` is true.

## Wire it in

- `apps/web/src/components/Core/Podcast/Episodes/CoreEpisodeSummary.tsx`: add props
  `isTruncated?: boolean` and `fullNotesUrl?: string | null`. Callers:
  - `app/episode/[item_id]/EpisodePageList.tsx`
  - `app/track/[item_id]/TrackPageList.tsx`
  - `app/podcast/livestream/[item_id]/LivestreamPageList.tsx`

  Each passes `isDescriptionTruncated(ssrItem.item_description)` and
  `ssrItem.item_about?.website_link_url`.
- `apps/web/src/components/Media/Livestream/LivestreamSummary.tsx`: the same two props, from its
  callers.
- `apps/web/src/components/Content/About/ContentAboutDescription.tsx`: channel About. Pass
  `channel_description` truncation and `channel_about.website_link_url` from its callers
  (podcast, album, and artist side content and list pages).
- Add-by-RSS pages (`app/add-by-rss/**`, `components/AddByRSS/Detail/AddByRSSDetailClient.tsx`)
  show the notice when their mapped description carries `is_truncated`. They use the mapped
  item or feed link. When the mapped data has no flag, show nothing.

Clip, official-clip, and chapter pages that show the parent item's Summary get the same props.

## Alignment

Mobile adds the same notice in 08 and updates **about-summary-web-mobile-alignment**. Use the
same keys and the same placement (after the prose, before People).

## E2E

New `apps/web/e2e/episode-show-notes.spec.ts` (**e2e-page-tests**, **e2e-readability**):

1. Open the seeded **E2E Long Show Notes** episode. The Summary shows the seeded heading and a
   list (rich markup survived).
2. A link named **Read Full Show Notes** has `href` `https://example.com/e2e-long-show-notes`.
   Do not click it.
3. On the podcast page, the episode row shows the seeded preview's first words.
4. Another seeded episode, not shortened, shows no notice.

Screenshot the verified element in each step (**e2e-screenshot-verified-element**).

## Scratchpad

Append to `release-notes/scratchpad.md`:

```markdown
## Web shows when show notes were shortened

- Surfaces: web
- Change: Episode, track, and livestream Summary and channel About show "Read Full Show Notes"
  or "Read Full Description" linking to the episode or show website when Podverse shortened the
  notes, or a short sentence when there is no link. List rows use the stored preview.
- Who notices: web listeners on episodes with very long notes
```

## Done when

- No web row strips full description HTML for a snippet.
- The notice appears only for shortened descriptions.
- No hardcoded English.
- Code comments must not cite this plan or any plan number.

## Operator verification

**Root** — do not set `E2E_API_GATE_MODE`.

```bash
make e2e_test_web_report_spec SPEC=e2e/episode-show-notes.spec.ts,e2e/about-summary-people.spec.ts
open .artifacts/e2e-reports/latest/index.html
```
