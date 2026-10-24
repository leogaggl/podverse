**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 82 — Docs and guidance made false by this set's code removals

Three sentences describe fallbacks that other plans in this set remove. Each file belongs to no
area that planned it, so they are fixed here after those plans land.

## Rows

R10, R15

## Runs after

34, 62, 71

- Plan 34 removes the mobile `WEB_BASE_URL` fallback.
- Plan 62 removes the local env path that upgrades an older checkout.
- Plan 71 stops the embed builder from accepting combined `type` values.

## Files

docs/features/EMBED-PLAYER.md
docs/development/env/LOCAL-ENV-OVERRIDES.md
.cursor/rules/mobile-deep-links-and-prod-cutover.mdc

## Edits

1. `docs/features/EMBED-PLAYER.md`, under "Builder URL shape": delete the line
   "Legacy builder URLs may still use combined `type=compact-list|responsive-list` or
   `audio-list`/`video-list`; those map to `type` + `list=1`." and the blank line after it, so the
   URL shape line is followed by the `### List content types and sort (list=1)` heading with one
   blank line between them. Change nothing else in the file.

2. `docs/development/env/LOCAL-ENV-OVERRIDES.md`, section
   `### Existing installs (seed home secrets from primary checkout)`:
   - Rename the heading to `### Seed home secrets from an existing checkout`. No other file links
     to the old anchor.
   - Replace "If you already had a working primary checkout before this flow, run **once from that
     checkout**:" with "To copy the passwords a checkout already uses into home
     `local-secrets.env`, run this from that checkout:".
   - Keep the `make local_env_export_secrets_to_home` block and the paragraph after it unchanged.

3. `.cursor/rules/mobile-deep-links-and-prod-cutover.mdc`: replace
   "When that URL is unset (and `WEB_BASE_URL` is unset), the build registers no https host:" with
   "When that URL is unset, the build registers no https host:". Keep the rest of that bullet and
   the file as it is.

## Self-check

- `rg -n "Legacy builder URLs" docs/features/EMBED-PLAYER.md` prints nothing.
- `rg -n "WEB_BASE_URL" .cursor/rules/mobile-deep-links-and-prod-cutover.mdc` prints only
  `EXPO_PUBLIC_MOBILE_WEB_BASE_URL`.
- `rg -n "before this flow|Existing installs" docs/development/env/LOCAL-ENV-OVERRIDES.md` prints
  nothing.
- Run Prettier on the two `docs/` files only.

## Tests

none. Docs and guidance only.

## Release scratchpad

none
