**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 13 — Legal copy for the listen interval, the two listen caps, and the open cap

The Taste Profile agreement and the terms each say "There is a daily limit on how many listens
count." Nothing in either document gives a number, and neither TypeScript loader
(`apps/api/src/lib/legal/tasteProfileAgreementContent.ts`, `termsContent.ts`) interpolates a cap.
Those loaders do not change. This plan rewrites that sentence in the Markdown so it describes the
minimum interval, the stored and popularity caps, and the open cap, in all four locales of both
documents. No number goes into the copy, because every limit is a server setting.

The cooldown after an opt-out (plan 14) is not described here; plan 42 adds that sentence.

## Rows

R2, R5, R6, R18

## Runs after

20

Plan 20 renames the opt-in to Taste Profile, moves the agreement Markdown from
`apps/api/legal/popularity-tracking/` to `apps/api/legal/taste-profile-agreement/`, renames the
terms heading, and keeps the anchors this plan uses word for word, except one Greek word noted
below. Run this plan on the files as plan 20 leaves them.

## Versions stay the same

Do not change `TASTE_PROFILE_AGREEMENT_VERSION` or `TERMS_OF_SERVICE_VERSION`. The
agreement promises to ask again when "we later change what we record or how long we keep it".
These limits record less than before and keep it for the same time, and the copy already said
there was a daily limit. Bumping the agreement would pause tracking for every account until it
accepts again; bumping the terms would block every authenticated route until each account accepts
again.

## Edits

Use the same new sentences in both documents of a locale. Change nothing else in these files.

### The listen sentence

In each file below, replace the locale's "daily limit" sentence (shown first) with the new text
(shown second). In the agreement it is the last sentence of the first paragraph under the
"How a Listen Is Counted" heading (or its translation). In the terms it is in the paragraph under
the `## Taste Profile` heading (`es` `## Perfil de gustos`, `fr` `## Profil de goûts`, `el-GR`
`## Προφίλ γούστου`) that starts "When it is on" (`es` "Cuando está activado", `fr` "Lorsqu'il est
activé", `el-GR` "Όταν είναι ενεργό"; plan 20 changed the Greek word from "ενεργή" to "ενεργό").

- `en-US`: "There is a daily limit on how many listens count." becomes "A new listen that arrives
  too soon after your last recorded one is not recorded. There is a daily limit on how many
  listens are recorded. A lower daily limit sets how many of them count toward the public lists;
  listens past it still update your Taste Profile."
- `es`: "Hay un límite diario de cuántas escuchas cuentan." becomes "Una escucha nueva que llega
  demasiado pronto después de la última registrada no se registra. Hay un límite diario de
  cuántas escuchas se registran. Un límite diario más bajo fija cuántas de ellas cuentan para las
  listas públicas; las escuchas que lo superan siguen actualizando tu Perfil de gustos."
- `fr`: "Il y a une limite quotidienne au nombre d'écoutes qui comptent." becomes "Une nouvelle
  écoute qui arrive trop tôt après la dernière écoute enregistrée n'est pas enregistrée. Il y a
  une limite quotidienne au nombre d'écoutes enregistrées. Une limite quotidienne plus basse fixe
  combien d'entre elles comptent pour les listes publiques ; les écoutes au-delà mettent quand
  même à jour votre Profil de goûts."
- `el-GR`: "Υπάρχει ημερήσιο όριο στο πόσες ακροάσεις μετρούν." becomes "Μια νέα ακρόαση που
  φτάνει πολύ σύντομα μετά την τελευταία καταγεγραμμένη δεν καταγράφεται. Υπάρχει ημερήσιο όριο
  στο πόσες ακροάσεις καταγράφονται. Ένα χαμηλότερο ημερήσιο όριο ορίζει πόσες από αυτές μετρούν
  για τις δημόσιες λίστες· οι ακροάσεις πέρα από αυτό εξακολουθούν να ενημερώνουν το Προφίλ
  γούστου σας."

Each paragraph is one line in the source files. Keep it one line; the wrapping above is only for
this plan.

The Greek feature name is neuter ("το Προφίλ γούστου"). The new Greek sentences name it only as
"το Προφίλ γούστου σας", and "αυτό" in the listen sentence refers to "όριο", so no pronoun or
adjective refers to the feature with another gender.

### The opens sentence

Insert one sentence right after the sentence that says opens do not update the Taste Profile:

- Agreement: in the paragraph after the listen paragraph (`en-US` starts "On the website, two
  more things are recorded"), after "Those opens do not update your Taste Profile." (`es`: "Esas
  aperturas no actualizan tu Perfil de gustos."; `fr`: "Ces ouvertures ne mettent pas à jour
  votre Profil de goûts."; `el-GR`: "Αυτά τα ανοίγματα δεν ενημερώνουν το Προφίλ γούστου σας.").
- Terms: in the same "When it is on" paragraph, after "They do not update your Taste Profile."
  (or its translation in that paragraph).

The sentence:

- `en-US`: "There is a daily limit on how many of those opens are recorded."
- `es`: "Hay un límite diario de cuántas de esas aperturas se registran."
- `fr`: "Il y a une limite quotidienne au nombre de ces ouvertures qui sont enregistrées."
- `el-GR`: "Υπάρχει ημερήσιο όριο στο πόσα από αυτά τα ανοίγματα καταγράφονται."

## Files

apps/api/legal/taste-profile-agreement/en-US.md
apps/api/legal/taste-profile-agreement/es.md
apps/api/legal/taste-profile-agreement/fr.md
apps/api/legal/taste-profile-agreement/el-GR.md
apps/api/legal/terms/en-US.md
apps/api/legal/terms/es.md
apps/api/legal/terms/fr.md
apps/api/legal/terms/el-GR.md
release-notes/scratchpad.md

## Tests

None. `apps/api/src/test/legal-taste-profile-agreement.test.ts` and `termsContent.test.ts`
assert phrases this plan does not touch (plan 20 sets those phrases).

## Release scratchpad

```markdown
## Taste Profile agreement and terms describe the new limits

- Surfaces: api (Taste Profile agreement and terms, all four locales)
- Change: the "daily limit on how many listens count" sentence now says a new listen sent too
  soon after the last one is not recorded, that a daily limit caps recorded listens, that a lower
  one caps those counting toward public lists while the rest still update the Taste Profile, and
  that profile and playlist opens have a daily limit. No numbers appear; the agreement and terms
  versions do not change, so nobody is asked to accept again.
- Who notices: anyone reading the Taste Profile agreement or the terms
- Operator steps: none
```
