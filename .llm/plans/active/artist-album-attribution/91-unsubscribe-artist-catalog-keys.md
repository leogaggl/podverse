**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 91 — Catalog keys for the unsubscribe-from-artist dialog

Web (plans 92, 93) and mobile (plans 94, 95) show the same dialog with the same words. This plan
adds its keys once, in the consumer layer both apps read, so the two app plans never edit a
catalog file at the same time.

## Rows

R58

## Runs after

40

Plan 40 also inserts consumer keys (under `media.music`); this plan edits the same four files.

## Files

packages/i18n-catalog/consumer/originals/en-US.json
packages/i18n-catalog/consumer/originals/es.json
packages/i18n-catalog/consumer/originals/fr.json
packages/i18n-catalog/consumer/originals/el-GR.json

## Decisions this plan fixes

- **"Unsubscribe" is the word on every surface.** The web headers, the mobile artist screen, and
  the mobile Add by RSS detail and row actions all say `features.unsubscribe` today. The title
  key repeats that word; there is no "Remove" variant.
- **Two body keys, not an ICU plural.** Web reads the catalog through next-intl (ICU), mobile
  through i18next with single-brace interpolation and no ICU plugin. Each app picks the key with
  `count === 1`. The dialog only opens with a count of at least 1, so no zero form is needed.
- Key names avoid the `_one` / `_other` suffixes so i18next never treats them as plural forms of
  another key.
- Cancel reuses `misc.cancel`.

## Keys

Insert an object `unsubscribe_artist` in `features`, immediately after the `"unsubscribe"` string,
in all four originals. Do not reformat the files. Do not edit `overrides/` or `compiled/`. Then run
`npm run i18n:compile` from the repo root; `apps/*/i18n/compiled/` is gitignored, do not commit it.

| Key | en-US | es | fr | el-GR |
| --- | --- | --- | --- | --- |
| `title` | Unsubscribe from {artist}? | ¿Darse de baja de {artist}? | Se désabonner de {artist} ? | Απογραφή από {artist}; |
| `followed_one_album` | You also follow 1 album by this artist. | También sigues 1 álbum de este artista. | Vous suivez aussi 1 album de cet artiste. | Ακολουθείτε επίσης 1 άλμπουμ αυτού του καλλιτέχνη. |
| `followed_albums` | You also follow {count} albums by this artist. | También sigues {count} álbumes de este artista. | Vous suivez aussi {count} albums de cet artiste. | Ακολουθείτε επίσης {count} άλμπουμ αυτού του καλλιτέχνη. |
| `artist_only` | Artist Only | Solo el artista | Artiste uniquement | Μόνο τον καλλιτέχνη |
| `artist_and_albums` | Artist and Albums | Artista y álbumes | Artiste et albums | Καλλιτέχνη και άλμπουμ |

English labels are title case and the body is a sentence (**ui-copy-casing**). Each locale's title
uses that locale's existing `features.unsubscribe` word. The Greek question mark is `;`.

## Must stay true

- No key is an empty string.
- `{artist}` and `{count}` are the only placeholders.

## Tests

None. Plans 92–97 render these keys; `npm run i18n:compile` checks the JSON.

## Release scratchpad

none
