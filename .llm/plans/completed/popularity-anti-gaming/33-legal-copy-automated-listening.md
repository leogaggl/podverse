**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 33 — Legal copy: listening that looks automated

Plan 30 stores two new things on the pseudonymous listener id: a flag (reason and time) and the
listener's latest run of minutes in which a new listen arrived too soon (its length and its last
minute). While a listener is flagged, its listens and opens are left out of the public lists, and
the ones recorded while it was flagged stay out after the flag is cleared. Both rows stay with the
id when Taste Profile is turned off (plan 14 keeps the id) and are deleted with the account. This
plan says so, in general terms, in the Taste Profile agreement and the terms, in all four locales.
It never tells a listener that they are flagged; nothing in the product does.

## Rows

R9, R23, R24

## Runs after

13, 30

Plan 20 has moved the agreement Markdown to `apps/api/legal/taste-profile-agreement/` and renamed
the terms heading to `## Taste Profile` (`es` `## Perfil de gustos`, `fr` `## Profil de goûts`,
`el-GR` `## Προφίλ γούστου`). Plan 13 has rewritten the listen sentence and added the opens
sentence. Run this plan on the files as those plans leave them.

## Versions stay the same

Do not change `TASTE_PROFILE_AGREEMENT_VERSION` or `TERMS_OF_SERVICE_VERSION`. The flag and the
too-soon run record nothing about what was played, and a flag can only make a listener count
less. Bumping the agreement would pause tracking for every account until it accepts again.

## Edits

Each paragraph is one line in the source files; keep it one line. Change nothing else. The
agreement files are `apps/api/legal/taste-profile-agreement/<locale>.md`; the terms files are
`apps/api/legal/terms/<locale>.md`.

### 1. The automated-listening sentence (agreement and terms)

Append it right after plan 13's listen sentences (in `en-US` those end "listens past it still
update your Taste Profile."; `es` "siguen actualizando tu Perfil de gustos."; `fr` "mettent quand
même à jour votre Profil de goûts."; `el-GR` "εξακολουθούν να ενημερώνουν το Προφίλ γούστου
σας.").

- In the agreement, that is the end of the first paragraph under the "How a Listen Is Counted"
  heading (`es` "Cómo se cuenta una escucha", `fr` "Comment une écoute est comptée", `el-GR`
  "Πώς μετράται μια ακρόαση").
- In the terms, it is the paragraph under the `## Taste Profile` heading (or its translation) that
  starts "When it is on" (`es` "Cuando está activado", `fr` "Lorsqu'il est activé", `el-GR`
  "Όταν είναι ενεργό"). Insert it right after plan 13's listen sentences, before the sentence
  about opening profiles on the website.

The sentence:

- `en-US`: "Listening that looks automated can be left out of the public lists; it still updates
  your Taste Profile."
- `es`: "Las escuchas que parecen automatizadas pueden quedar fuera de las listas públicas; siguen
  actualizando tu Perfil de gustos."
- `fr`: "Les écoutes qui semblent automatisées peuvent être exclues des listes publiques ; elles
  mettent quand même à jour votre Profil de goûts."
- `el-GR`: "Ακροάσεις που μοιάζουν αυτοματοποιημένες μπορεί να μένουν εκτός των δημόσιων λιστών·
  εξακολουθούν να ενημερώνουν το Προφίλ γούστου σας."

### 2. What is stored (agreement only)

In the first paragraph under the "What We Store" heading (`es` "Qué guardamos", `fr` "Ce que
nous enregistrons", `el-GR` "Τι αποθηκεύουμε"), insert these sentences right after the sentence
about what an open on the website records (`en-US` "An open on the website records the id, what
you opened, and when."; `es` "Una apertura en el sitio web registra el id, qué abriste y
cuándo."; `fr` "Une ouverture sur le site web enregistre l'id, ce que vous avez ouvert, et
quand."; `el-GR` "Ένα άνοιγμα στον ιστότοπο καταγράφει το id, τι ανοίξατε, και πότε.").

- `en-US`: "If listening looks automated, the id also gets a mark with the reason and the time.
  While the mark is in place, the id's listens and opens are left out of the public lists.
  Listens and opens recorded while the mark was in place stay left out after it is removed. We
  also keep a count of recent minutes in which a new listen arrived too soon, and when the last
  one was. The mark and that count stay with the id when you turn Taste Profile off, and are
  deleted when you delete your account."
- `es`: "Si las escuchas parecen automatizadas, el id también recibe una marca con el motivo y la
  hora. Mientras la marca está puesta, las escuchas y aperturas del id quedan fuera de las listas
  públicas. Las escuchas y aperturas registradas mientras la marca estaba puesta siguen fuera
  después de retirarla. También guardamos un recuento de los minutos recientes en los que una
  escucha nueva llegó demasiado pronto, y cuándo fue el último. La marca y ese recuento siguen con
  el id cuando desactivas el Perfil de gustos, y se eliminan cuando eliminas tu cuenta."
- `fr`: "Si l'écoute semble automatisée, l'id reçoit aussi une marque avec le motif et l'heure.
  Tant que la marque est en place, les écoutes et ouvertures de l'id sont exclues des listes
  publiques. Les écoutes et ouvertures enregistrées pendant que la marque était en place restent
  exclues après sa levée. Nous gardons aussi un décompte des minutes récentes où une nouvelle
  écoute est arrivée trop tôt, et l'heure de la dernière. La marque et ce décompte restent
  attachés à l'id quand vous désactivez le Profil de goûts, et sont supprimés quand vous supprimez
  votre compte."
- `el-GR`: "Αν η ακρόαση μοιάζει αυτοματοποιημένη, το id λαμβάνει επίσης μια σήμανση με τον λόγο
  και την ώρα. Όσο υπάρχει η σήμανση, οι ακροάσεις και τα ανοίγματα του id μένουν εκτός των
  δημόσιων λιστών. Οι ακροάσεις και τα ανοίγματα που καταγράφηκαν όσο υπήρχε η σήμανση μένουν
  εκτός και μετά την άρση της. Κρατάμε επίσης μια μέτρηση των πρόσφατων λεπτών στα οποία μια νέα
  ακρόαση έφτασε πολύ σύντομα, και πότε έγινε η τελευταία. Η σήμανση και αυτή η μέτρηση παραμένουν
  με το id όταν απενεργοποιείτε το Προφίλ γούστου, και διαγράφονται όταν διαγράφετε τον
  λογαριασμό σας."

The Greek feature name is neuter ("το Προφίλ γούστου"); the only reference to it here is the
accusative "το Προφίλ γούστου". "της" refers to "σήμανση" and "η τελευταία" to "ακρόαση".

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
assert phrases this plan does not touch.

## Release scratchpad

```markdown
## Taste Profile agreement and terms mention automated listening

- Surfaces: api (Taste Profile agreement and terms, all four locales)
- Change: both documents say listening that looks automated can be left out of the public lists
  while it still updates the Taste Profile. The agreement's "What We Store" adds the mark on the
  pseudonymous id, says listens and opens recorded while the mark was in place stay out of the
  public lists after it is removed, and describes the count of recent too-soon minutes. It says
  both stay with the id when Taste Profile is turned off and are deleted with the account. The
  agreement and terms versions do not change, so nobody is asked to accept again.
- Who notices: anyone reading the Taste Profile agreement or the terms
- Operator steps: none
```
