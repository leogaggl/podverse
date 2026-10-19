# 03 — Seed, surfaces, E2E

**Cursor model:** Cursor Grok 4.7 · **Reasoning:** high

## Summary

Prove a slimmed archived episode still reads well through its clip on web and mobile, and that
empty sections hide. Fix any surface that shows an empty chip or tab.

Depends on 02. Do not edit ORM services or the parser.

## Seed — `tools/web/seed-e2e.mjs`

Add one archived, slimmed episode to an existing seeded podcast:

- Title **E2E Archived Clip Episode**, `item_flag_status_id` Archived, `archived_slimmed_at`
  set.
- The same enclosure fixture the other seeded episodes use. One image.
- `item_about.website_link_url`: `https://example.com/e2e-archived-clip-episode`.
- `item_description`: the reduced form of a short seeded preview, `is_truncated` true,
  `source_length` 9000.
- No chapters, transcripts, people, funding, value, or soundbites.
- One public clip by the seeded E2E user, title **E2E Archived Clip**, 30 to 60 seconds.
- Fixed `id_text` values for the episode and the clip (**e2e-seed-nano-id-limits**). Export
  them from `apps/web/e2e/helpers/seedConstants.ts` and
  `apps/mobile/src/lib/e2e/e2eSeedConstants.ts`.

Channel episode lists show Active episodes only, so tests reach this episode and clip by URL or
deep link, never by browsing the podcast. `mobile_e2e_seed` reuses this seed, so mobile gets the
same fixture.

## Surfaces to check

For each, open the code, confirm the empty state hides the control, and fix it when it does
not. Do not add copy.

| Surface | Must hide when empty |
| --- | --- |
| Web episode page tabs (`app/episode/[item_id]`) | Chapters, Transcript, People, Funding |
| Web clip page (`app/clip/[clip_id]`) | Same sections, if it shows them |
| Mobile `EpisodeDetailScreen` chips | Chapters, Transcript, People, Funding |
| Mobile `ClipDetailScreen` | Same |
| Mobile full player panes | Chapters, Transcript |

The Summary on each shows the preview and the **Read Full Show Notes** link from
`feed-description-tiers`. That needs no new work here; the E2E asserts it.

## Web E2E — `apps/web/e2e/archived-clip.spec.ts`

1. Open **E2E Archived Clip**'s page. The clip title and the episode title are visible.
2. The Summary shows the preview and a link named **Read Full Show Notes** with `href`
   `https://example.com/e2e-archived-clip-episode`. Do not click it.
3. No Chapters, Transcript, People, or Funding tab is visible.

Screenshot each verified element (**e2e-screenshot-verified-element**).

## Mobile Maestro — `apps/mobile/e2e/archived-clip.yaml`

1. Open the episode by deep link, built with the `APP_ROUTES` episode path and the seeded id.
   Use the same deep-link step other flows use. The Summary shows the preview.
2. Open the clip by deep link the same way.
3. The clip detail shows its title. No Chapters or Transcript chip.

## Scratchpad

Only if a surface needed a fix:

```markdown
## Episode pages hide empty sections

- Surfaces: web, mobile
- Change: <which tabs or chips now hide when they have no rows>
- Who notices: listeners opening archived episodes or clips
```

## Done when

- The seeded archived clip renders on both surfaces with no empty sections.
- Comments must not cite this plan or any plan number.

## Operator verification

**Root** — do not set `E2E_API_GATE_MODE`.

```bash
make e2e_test_web_report_spec SPEC=e2e/archived-clip.spec.ts
open .artifacts/e2e-reports/latest/index.html
```

**Mobile**

```bash
make mobile_e2e_seed
```

**Mobile Maestro**: **Mobile E2E Metro**, **Mobile E2E API**, **Mobile E2E test-assets**, and
**Mobile E2E iOS** / **Mobile E2E Android** must already be running.

```bash
npm run mobile:e2e:test -- archived-clip
open .artifacts/mobile-e2e-reports/latest/failures.json
open .artifacts/mobile-e2e-reports/latest/ios-phone/index.html
open .artifacts/mobile-e2e-reports/latest/android-phone/index.html
```
