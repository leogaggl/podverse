# 06 — Web Advanced tab

**Cursor model:** Codex 5.3 · **Reasoning:** high

## Summary

Signed-in users get a Settings tab, Advanced, that lists Removed Content. It is a tab, not a
link on General, so it stays out of the way. Decisions: 00-SUMMARY 12. Copy is already in
the consumer catalog from 01. The seed row is already in 05.

Depends on 05. Can run beside 07. Do not edit catalogs, seed, mobile, or the API.

## Tab

`apps/web/src/components/Settings/Settings.tsx`.

- Add `'advanced'` to `TabKey` and `tabFromQueryParam`.
- Show the tab only when `loggedInAccount` is set, after OPML and before Keyboard.
- Label: `tSettings('advanced.advanced')`.
- `?tab=advanced` selects it. Signed-out visitors who open that URL fall through to General,
  the same way Account does today.
- Render a new panel when the tab is `advanced`.

## Panel

`apps/web/src/components/Settings/Panels/SettingsAdvanced/SettingsRemovedContent.tsx`.

On mount, call the `helpers-requests` function from 05. States:

- Loading: the same loading treatment other settings panels use. No layout shift that adds
  a second heading.
- Error: one sentence from an existing generic settings error key if one exists. If none
  does, add `settings.advanced.load_error` in all four consumer originals
  (`Could not load removed content.`) and the es, fr, and el-GR lines. This is the only
  catalog edit allowed, and only when no key fits.
- Empty: `settings.advanced.empty`.
- Rows: one block per row. Compose sentences from the 01 keys. Do not invent wording in
  the component.
  - `left_directory` or `taken_down`, with `{title}` set to `channel_title` or
    `unknown_show`.
  - `moved_to_add_by_rss` or `follow_ended` only when `follow_outcome` is set.
  - `clips` only when `clip_count > 0`. `playlist_entries` only when
    `playlist_entry_count > 0`. `{count}` is the number.

The row is text, not a link. The show may already be gone. Give the block an accessible
name that is the sentences joined, so a screen reader reads the reason once.

Follow **even-content-spacing**: one gap between rows, the same inset on both sides.
Follow **ui-copy-casing**. No `var()` fallbacks.

## E2E

`apps/web/e2e/removed-content-log.spec.ts`. Follow `settings-notifications.spec.ts` for
login (`e2e-user@example.com` / the password that file uses) and
`actionAndCapture` / `capturePageLoad`.

- Signed out, `/settings?tab=advanced` ends on General. The Advanced tab is absent.
- Signed in, the Advanced tab is present. Opening it shows the seeded channel title from
  `apps/web/e2e/helpers/seedConstants.ts` and the exact `left_directory` sentence.
- Assert the follow-ended sentence. Do not assert clip sentences; the fixture count is 0.

Top-level `test.describe` is a short title. Nested titles are sentences
(**e2e-suite-title**). Stay inside the 10 second budget.

## Scratchpad

```markdown
## Settings Advanced lists removed content

- Surfaces: web
- Change: signed-in Settings gains an Advanced tab at /settings?tab=advanced. It lists
  Removed Content from GET /account/content-log. Signed-out visitors do not see the tab.
- Who notices: signed-in web users who open Settings and choose Advanced
- Operator steps: none
```

## Done when

- The tab is absent for a signed-out user.
- A row with a null title uses the unknown-show sentence.
- Comments do not cite a plan or a step number.

## Operator verification

**Root.** Web report. Do not set `E2E_API_GATE_MODE`.

```bash
npm run build:packages
npm run build -w apps/web
make e2e_test_web_report_spec SPEC=e2e/removed-content-log.spec.ts
open .artifacts/e2e-reports/latest/index.html
```
