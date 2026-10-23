**Cursor model:** Cursor Grok 4.7 · **Reasoning:** medium

# 42 — Legal copy: how each list counts, which counts stay, and the opt-out cooldown

Plan 41 counts the day, week, and month lists from stored listen and open records, as distinct
listeners. When a listener's records are deleted (opting out, account deletion), that listener
leaves those three lists at the next refresh. Only all-time counts stay. Plan 40 makes all-time
add a listener again only after a set period. Today both documents say every count already on
the public lists stays. This plan narrows those sentences to all-time counts and adds one
sentence on how each list counts, in all four locales.

It also adds one sentence on plan 14's cooldown: after Taste Profile is turned off, listens do
not count toward the public lists for a set period, while the Taste Profile keeps using them, and
turning it off and on does not reset the daily limits.

## Rows

R13, R16, R26

## Runs after

13, 14, 33

Plan 20 has run before plan 13: the agreement files live in
`apps/api/legal/taste-profile-agreement/`, the feature is named Taste Profile, and the Greek name
is neuter ("το Προφίλ γούστου").

## Versions stay the same

Do not change `TASTE_PROFILE_AGREEMENT_VERSION` or `TERMS_OF_SERVICE_VERSION`. The change
keeps less of a listener in public counts after deletion, not more, and stores nothing new; the
cooldown sentence describes listens counting toward less, not more being recorded. Bumping the
agreement would pause tracking for every account until it accepts again. The operator kept this
choice (no bump) in the review of the first planning pass.

## Edits

Each paragraph is one line in the source files; keep it one line. Change nothing else. The
agreement files are `apps/api/legal/taste-profile-agreement/<locale>.md`; the terms files are
`apps/api/legal/terms/<locale>.md`. Plans 13, 20, and 33 edit other sentences in these files;
none of the sentences below, except that plan 20 changed the Greek pronoun in the anchor of
edit 4.

The legal copy names no number for any configurable limit: the daily limits (plan 13) say "a
daily limit", and only the event retention is interpolated (`{retention_days}`). Plan 14 adds no
interpolation for `STATS_ALL_TIME_RECOUNT_DAYS`. So the cooldown, like the all-time period in
edit 1, is "a set period" (`es` "un periodo fijo", `fr` "une période fixe", `el-GR` "μια
καθορισμένη περίοδο").

### 1. How each list counts (agreement and terms)

Append these sentences to the end of the paragraph under the "What the Lists Show" heading in the
agreement (`es` "Qué muestran las listas", `fr` "Ce que les listes affichent", `el-GR` "Τι
δείχνουν οι λίστες"). That paragraph ends `en-US` "Those counts are not tied to your account.".
In the terms, append them to the end of the paragraph that ends `en-US` "They do not show who
listened, and those counts are not tied to your account." (`es` "No muestran quién escuchó, y
esos recuentos no están ligados a tu cuenta.", `fr` "Elles ne montrent pas qui a écouté, et ces
décomptes ne sont pas liés à votre compte.", `el-GR` "Δεν δείχνουν ποιος άκουσε, και αυτές οι
μετρήσεις δεν συνδέονται με τον λογαριασμό σας.").

- `en-US`: "Each list counts you at most once per episode, show, clip, profile, or playlist. The
  day, week, and month lists are counted from stored records, so when your records are deleted,
  your listening leaves those lists. The all-time count adds you again only after a set period."
- `es`: "Cada lista te cuenta como máximo una vez por episodio, programa, clip, perfil o lista de
  reproducción. Las listas del día, la semana y el mes se cuentan a partir de los registros
  guardados, así que, cuando se eliminan tus registros, tus escuchas salen de esas listas. El
  recuento de todo el tiempo vuelve a sumarte solo después de un periodo fijo."
- `fr`: "Chaque liste vous compte au plus une fois par épisode, émission, clip, profil ou
  playlist. Les listes du jour, de la semaine et du mois sont calculées à partir des
  enregistrements conservés : quand vos enregistrements sont supprimés, vos écoutes sortent de
  ces listes. Le décompte de tout le temps ne vous ajoute à nouveau qu'après une période fixe."
- `el-GR`: "Κάθε λίστα σας μετρά το πολύ μία φορά ανά επεισόδιο, εκπομπή, απόσπασμα, προφίλ ή
  λίστα αναπαραγωγής. Οι λίστες της ημέρας, της εβδομάδας και του μήνα μετριούνται από τις
  αποθηκευμένες εγγραφές, οπότε, όταν διαγράφονται οι εγγραφές σας, οι ακροάσεις σας βγαίνουν από
  αυτές τις λίστες. Η μέτρηση όλου του διαστήματος σας προσθέτει ξανά μόνο μετά από μια
  καθορισμένη περίοδο."

### 2. Counts that stay are all-time counts (agreement)

Replace each sentence exactly. A sentence that appears twice is replaced both times (the opt-out
paragraph near the top and the paragraph under "Changing Your Mind", `es` "Si cambias de
opinión", `fr` "Si vous changez d'avis", `el-GR` "Αν αλλάξετε γνώμη").

`en-US`:

- "Counts already on the public lists stay." → "All-time counts already on the public lists
  stay." (two places)
- "Counts already added to the public lists stay after a record is deleted." → "All-time counts
  already added to the public lists stay after a record is deleted."
- "The public counts stay." → "The public all-time counts stay."

`es`:

- "Los recuentos que ya están en las listas públicas permanecen." → "Los recuentos de todo el
  tiempo que ya están en las listas públicas permanecen." (two places)
- "Los recuentos ya añadidos a las listas públicas permanecen después de que se elimine un
  registro." → "Los recuentos de todo el tiempo ya añadidos a las listas públicas permanecen
  después de que se elimine un registro."
- "Los recuentos públicos permanecen." → "Los recuentos públicos de todo el tiempo permanecen."

`fr`:

- "Les décomptes déjà présents sur les listes publiques restent." → "Les décomptes de tout le
  temps déjà présents sur les listes publiques restent." (two places)
- "Les décomptes déjà ajoutés aux listes publiques restent après la suppression d'un
  enregistrement." → "Les décomptes de tout le temps déjà ajoutés aux listes publiques restent
  après la suppression d'un enregistrement."
- "Les décomptes publics restent." → "Les décomptes publics de tout le temps restent."

`el-GR`:

- "Οι μετρήσεις που βρίσκονται ήδη στις δημόσιες λίστες μένουν." → "Οι μετρήσεις όλου του
  διαστήματος που βρίσκονται ήδη στις δημόσιες λίστες μένουν." (two places)
- "Οι μετρήσεις που έχουν ήδη προστεθεί στις δημόσιες λίστες μένουν μετά τη διαγραφή μιας
  εγγραφής." → "Οι μετρήσεις όλου του διαστήματος που έχουν ήδη προστεθεί στις δημόσιες λίστες
  μένουν μετά τη διαγραφή μιας εγγραφής."
- "Οι δημόσιες μετρήσεις μένουν." → "Οι δημόσιες μετρήσεις όλου του διαστήματος μένουν."

### 3. Counts that stay are all-time counts (terms)

`en-US`:

- "Counts already published stay as numbers, without a list of who listened." → "All-time
  counts already published stay as numbers, without a list of who listened."
- "Public counts already published stay." → "Public all-time counts already published stay."
- "The public counts stay." → "The public all-time counts stay."

`es`:

- "Los recuentos ya publicados permanecen como números, sin una lista de quién escuchó." → "Los
  recuentos de todo el tiempo ya publicados permanecen como números, sin una lista de quién
  escuchó."
- "Los recuentos públicos ya publicados permanecen." → "Los recuentos públicos de todo el tiempo
  ya publicados permanecen."
- "Los recuentos públicos permanecen." → "Los recuentos públicos de todo el tiempo permanecen."

`fr`:

- "Les décomptes déjà publiés demeurent sous forme de nombres, sans liste de qui a écouté." →
  "Les décomptes de tout le temps déjà publiés demeurent sous forme de nombres, sans liste de qui
  a écouté."
- "Les décomptes publics déjà publiés restent." → "Les décomptes publics de tout le temps déjà
  publiés restent."
- "Les décomptes publics restent." → "Les décomptes publics de tout le temps restent."

`el-GR`:

- "Οι μετρήσεις που έχουν ήδη δημοσιευτεί μένουν ως αριθμοί, χωρίς λίστα με το ποιος άκουσε." →
  "Οι μετρήσεις όλου του διαστήματος που έχουν ήδη δημοσιευτεί μένουν ως αριθμοί, χωρίς λίστα με
  το ποιος άκουσε."
- "Οι δημόσιες μετρήσεις που έχουν ήδη δημοσιευτεί μένουν." → "Οι δημόσιες μετρήσεις όλου του
  διαστήματος που έχουν ήδη δημοσιευτεί μένουν."
- "Οι δημόσιες μετρήσεις μένουν." → "Οι δημόσιες μετρήσεις όλου του διαστήματος μένουν."

### 4. The cooldown after turning Taste Profile off (agreement and terms)

Insert one sentence right after the sentence that says recommendations start from scratch when
Taste Profile is turned on later. In the agreement it is in the paragraph under "Changing Your
Mind" (the heading names in edit 2); in the terms it is in the paragraph that starts "Turning
Taste Profile off asks you to confirm." (as plan 20 leaves it). The anchor sentence, in both
documents:

- `en-US`: "If you turn it on later, recommendations start from scratch."
- `es`: "Si lo activas más adelante, las recomendaciones empiezan de cero."
- `fr`: "Si vous l'activez plus tard, les recommandations repartent de zéro."
- `el-GR`: "Αν το ενεργοποιήσετε αργότερα, οι προτάσεις ξεκινούν από την αρχή." (plan 20 changed
  "την" to "το"; if the file still has "την", plan 20 has not run, so stop and report.)

The sentence, the same in both documents of a locale:

- `en-US`: "If you turn it on again, the daily limits do not start over, and for a set period
  after you turned it off, your new listens update your Taste Profile but do not count toward the
  public lists, and opening a profile or a playlist is not recorded."
- `es`: "Si lo vuelves a activar, los límites diarios no se reinician, y durante un periodo fijo
  después de desactivarlo, tus escuchas nuevas actualizan tu Perfil de gustos pero no cuentan
  para las listas públicas, y abrir un perfil o una lista de reproducción no se registra."
- `fr`: "Si vous le réactivez, les limites quotidiennes ne sont pas remises à zéro, et pendant une
  période fixe après sa désactivation, vos nouvelles écoutes mettent à jour votre Profil de goûts
  mais ne comptent pas pour les listes publiques, et l'ouverture d'un profil ou d'une playlist
  n'est pas enregistrée."
- `el-GR`: "Αν το ενεργοποιήσετε ξανά, τα ημερήσια όρια δεν ξεκινούν από την αρχή, και για μια
  καθορισμένη περίοδο μετά την απενεργοποίησή του οι νέες ακροάσεις σας ενημερώνουν το Προφίλ
  γούστου σας αλλά δεν μετρούν για τις δημόσιες λίστες, ενώ το άνοιγμα ενός προφίλ ή μιας λίστας
  αναπαραγωγής δεν καταγράφεται."

Why the sentence says what it does (plan 14): the cooldown starts when Taste Profile is turned
off after a Yes and lasts `STATS_ALL_TIME_RECOUNT_DAYS` days; listens in it are stored for the
Taste Profile with `popularity_counted = false`; profile and playlist opens in it are not stored;
the listener id, the daily limits, and the minimum interval are kept across the opt-out. In
Greek, "το" and "του" refer to the neuter "Προφίλ γούστου", and "τα ημερήσια όρια" matches plan
13's "ημερήσιο όριο".

After the edits, search each file for the old sentences; none may remain. Each new sentence
appears exactly once per file.

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

None. `apps/api/src/test/legal-taste-profile-agreement.test.ts` and
`apps/api/src/lib/legal/termsContent.test.ts` assert phrases this plan does not touch.

## Release scratchpad

```markdown
## Taste Profile agreement and terms say how each list counts and describe the opt-out cooldown

- Surfaces: api (Taste Profile agreement and terms, all four locales)
- Change: both documents say each list counts a listener at most once per episode, show, clip,
  profile, or playlist; that the day, week, and month lists come from stored records, so deleting
  them removes the listener from those lists; and that all-time adds a listener again only after
  a set period. Sentences that said every published count stays now say all-time counts stay.
  A new sentence says that turning Taste Profile off and on again does not reset the daily
  limits, and that for a set period after turning it off, new listens update the Taste Profile
  but do not count toward the public lists and profile and playlist opens are not recorded. No
  number appears. The agreement and terms versions do not change, so nobody is asked to accept
  again.
- Who notices: anyone reading the Taste Profile agreement or the terms
- Operator steps: none
```
